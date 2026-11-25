import Link from 'next/link';
import { api, EnglishStats, Stats, TYPE_COLORS } from './lib/api';
import { AREA_COLOR, PlannerMeta, PTask, TaskListResponse } from './lib/planner';
import { Icon } from './components/icons';
import { Alert, EmptyState, PageHeader, StatCard } from './components/ui';

export const dynamic = 'force-dynamic';

const settle = <T,>(p: Promise<T>) => p.then((v) => v).catch(() => null);

function greeting(tz: string) {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function fmtTime(min: number | null) {
  if (min == null) return null;
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/** Home: what needs attention today across the planner, English practice and the knowledge base. */
export default async function HomePage() {
  const [stats, meta, english, today] = await Promise.all([
    settle<Stats>(api.stats()),
    settle<PlannerMeta>(api.planner.meta()),
    settle<EnglishStats>(api.english.stats()),
    settle<TaskListResponse>(api.planner.tasks({ view: 'today' })),
  ]);

  if (!stats && !meta && !english) {
    return (
      <>
        <PageHeader title="Home" />
        <Alert title="Could not reach the backend.">Make sure the API is running and reachable from the web server.</Alert>
      </>
    );
  }

  const tz = meta?.timeZone ?? 'Asia/Ho_Chi_Minh';
  const dateLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }).format(new Date());
  const left = meta ? meta.remainingToday.WORK + meta.remainingToday.PERSONAL : null;
  const overdue = meta?.overdue.total ?? 0;
  const tasks: PTask[] = (today?.tasks ?? [])
    .slice()
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.startTime ?? 9999) - (b.startTime ?? 9999));
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title={greeting(tz)}
        description={dateLabel}
        actions={
          <>
            <Link href="/english/new" className="btn btn-secondary">
              <Icon name="pen" /> Journal
            </Link>
            <Link href="/chat" className="btn btn-secondary">
              <Icon name="sparkles" /> Ask AI
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Left today" value={left ?? '—'} icon="planner" tone="accent" href="/planner" hint={tasks.length ? `${doneCount} of ${tasks.length} done` : 'Nothing planned'} />
        <StatCard label="Overdue" value={overdue} icon="alert" tone={overdue ? 'danger' : 'default'} href="/planner" hint={overdue ? 'Open them in Projects' : 'All caught up'} />
        <StatCard label="Cards to review" value={english?.dueForReview ?? '—'} icon="cards" tone="warning" href="/english/review" hint={english ? `${english.reviewAccuracy}% accuracy` : undefined} />
        <StatCard label="Knowledge entries" value={stats?.total ?? '—'} icon="book" href="/knowledge" hint={stats ? `+${stats.today} today` : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:items-start">
        {/* Today */}
        <section className="card lg:col-span-3">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="section-title">Today</h2>
            <Link href="/planner" className="inline-flex items-center gap-1 text-[13px] text-fg-muted hover:text-fg">
              Open projects <Icon name="arrow-right" className="h-3.5 w-3.5" />
            </Link>
          </div>
          {tasks.length === 0 ? (
            <EmptyState className="m-4 border-0" icon="planner" title="Nothing planned for today" description="Add tasks from a project's board." />
          ) : (
            <ul className="divide-y divide-line">
              {tasks.slice(0, 9).map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2"
                    style={{ borderColor: AREA_COLOR[t.area], background: t.done ? AREA_COLOR[t.area] : 'transparent' }}
                  >
                    {t.done && <Icon name="check" className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                  </span>
                  <span className={`min-w-0 flex-1 truncate ${t.done ? 'text-fg-subtle line-through' : 'text-fg'}`}>{t.title}</span>
                  {t.inProgress && !t.done && <span className="chip tone-accent">In progress</span>}
                  {fmtTime(t.startTime) && <span className="text-xs tabular-nums text-fg-muted">{fmtTime(t.startTime)}</span>}
                </li>
              ))}
              {tasks.length > 9 && (
                <li className="px-4 py-2.5 text-[13px] text-fg-muted">
                  <Link href="/planner" className="link">
                    +{tasks.length - 9} more
                  </Link>
                </li>
              )}
            </ul>
          )}
        </section>

        {/* Recent knowledge */}
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="section-title">Recent entries</h2>
            <Link href="/knowledge" className="inline-flex items-center gap-1 text-[13px] text-fg-muted hover:text-fg">
              All <Icon name="arrow-right" className="h-3.5 w-3.5" />
            </Link>
          </div>
          {!stats || stats.recent.length === 0 ? (
            <EmptyState
              className="m-4 border-0"
              icon="book"
              title="No entries yet"
              action={
                <Link href="/knowledge/new" className="btn btn-primary btn-sm">
                  <Icon name="plus" /> Add your first entry
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {stats.recent.slice(0, 6).map((k) => (
                <li key={k.id}>
                  <Link href={`/knowledge/${k.id}/edit`} className="block px-4 py-2.5 transition hover:bg-subtle">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-medium text-fg">{k.title}</span>
                      <span className={`chip ${TYPE_COLORS[k.type]}`}>{k.type.replace('_', ' ').toLowerCase()}</span>
                    </div>
                    {k.summary && <p className="mt-0.5 line-clamp-1 text-[13px] text-fg-muted">{k.summary}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {stats && stats.popularTags.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-title">Popular tags</h2>
          <div className="flex flex-wrap gap-1.5">
            {stats.popularTags.map((t) => (
              <Link
                key={t.tag}
                href={`/knowledge?tag=${encodeURIComponent(t.tag)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[13px] text-fg-secondary transition hover:border-line-strong hover:text-fg"
              >
                #{t.tag} <span className="text-xs tabular-nums text-fg-subtle">{t.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
