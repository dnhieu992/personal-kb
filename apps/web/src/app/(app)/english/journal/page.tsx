'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  api,
  CEFR_LEVELS,
  CollectedFromSource,
  EnglishStats,
  JournalWithItems,
  Knowledge,
  KIND_COLORS,
  KIND_LABELS,
  REVIEWABLE_KINDS,
  EnglishKind,
} from '@/features/english/api';
import { Icon } from '@/shared/ui/icons';
import { Alert, PageHeader, StatCard } from '@/shared/ui/kit';

/** CEFR levels share the accent hue; higher levels are more saturated. */
const LEVEL_OPACITY: Record<string, number> = { A1: 0.35, A2: 0.5, B1: 0.62, B2: 0.75, C1: 0.88, C2: 1 };

export default function EnglishPage() {
  const q = useQuery({
    queryKey: ['english', 'journal-page'],
    queryFn: () => Promise.all([api.english.stats(), api.english.journal(), api.english.collected(30)]),
  });
  if (q.isPending) return <PageHeader title="Journal" />;
  const error = q.error ? (q.error as Error).message : null;
  const [stats, timeline, collected]: [EnglishStats | null, JournalWithItems[], CollectedFromSource[]] = q.data ?? [null, [], []];

  if (error || !stats) {
    return (
      <>
        <PageHeader title="Journal" />
        <Alert title="Could not load the journal.">{error}</Alert>
      </>
    );
  }

  const maxLevel = Math.max(1, ...Object.values(stats.byLevel));

  return (
    <div className="space-y-10">
      <PageHeader
        title="English journal"
        back={{ href: '/english', label: 'English for IT' }}
        description="Viết tự do mỗi ngày — AI rút ra mục cần ôn và theo dõi trình độ."
        actions={
          <>
            <Link href="/english/review" className="btn btn-secondary">
              <Icon name="cards" /> Ôn tập
              {stats.dueForReview > 0 && <span className="chip tone-amber -mr-1 px-1.5">{stats.dueForReview}</span>}
            </Link>
            <Link href="/english/new" className="btn btn-primary">
              <Icon name="pen" /> Ghi nhật ký
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Buổi nhật ký" value={stats.journalCount} icon="pen" />
        <StatCard label="Mục cần nhớ" value={stats.itemCount} icon="book" />
        <StatCard label="Chờ ôn" value={stats.dueForReview} icon="cards" tone={stats.dueForReview ? 'warning' : 'default'} href="/english/review" />
        <StatCard label="Độ chính xác" value={`${stats.reviewAccuracy}%`} icon="target" tone="success" />
      </div>

      {stats.itemCount > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <section className="card p-5">
            <h2 className="section-title mb-4">Phân bố trình độ</h2>
            <div className="space-y-2.5">
              {CEFR_LEVELS.map((lvl) => {
                const count = stats!.byLevel[lvl] ?? 0;
                return (
                  <div key={lvl} className="flex items-center gap-3">
                    <span className="w-7 text-xs font-semibold text-fg-muted">{lvl}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(count / maxLevel) * 100}%`, opacity: LEVEL_OPACITY[lvl] }} />
                    </div>
                    <span className="w-8 text-right text-xs tabular-nums text-fg-muted">{count}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="section-title mb-4">Theo loại</h2>
            <div className="flex flex-wrap gap-2">
              {REVIEWABLE_KINDS.map((k) => (
                <span key={k} className={`chip px-2.5 py-1 text-[13px] ${KIND_COLORS[k]}`}>
                  {KIND_LABELS[k]} <span className="tabular-nums opacity-70">{stats!.byKind[k] ?? 0}</span>
                </span>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Collected while writing knowledge entries */}
      {collected.length > 0 && (
        <section>
          <h2 className="section-title mb-1">Thu thập từ entry, task & tech note</h2>
          <p className="mb-4 text-[13px] text-fg-muted">
            Ngữ pháp và từ vựng AI nhặt ra khi dịch các entry và task của bạn
            sang tiếng Anh — đã nằm sẵn trong hàng đợi ôn tập.
          </p>
          <div className="space-y-4">
            {collected.map(({ source, items }) => (
              <article key={source.id} className="card p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        source.kind === 'TASK'
                          ? 'tone-green'
                          : source.kind === 'NOTE'
                            ? 'tone-sky'
                            : 'tone-gray'
                      }`}
                    >
                      {source.kind === 'TASK' ? 'Task' : source.kind === 'NOTE' ? 'Note' : 'Other'}
                    </span>
                    {source.href ? (
                      <Link href={source.href} className="truncate font-medium link">
                        {source.title}
                      </Link>
                    ) : (
                      <span className="truncate font-medium">{source.title}</span>
                    )}
                  </div>
                  <time className="shrink-0 text-xs text-fg-subtle">
                    {new Date(source.createdAt).toLocaleDateString('vi-VN')}
                  </time>
                </div>
                <ul className="space-y-1.5 border-t pt-3">
                  {items.map((it) => (
                    <ItemLine key={it.id} item={it} />
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Diary timeline */}
      <section>
        <h2 className="section-title mb-3">Dòng thời gian</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-fg-muted">
            Chưa có gì —{' '}
            <Link className="text-accent-text underline" href="/english/new">
              ghi buổi học đầu tiên
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-4">
            {timeline.map(({ journal, items }) => (
              <article key={journal.id} className="card p-4">
                <div className="mb-2 flex items-center justify-between">
                  <time className="text-xs font-medium text-fg-subtle">
                    {new Date(journal.createdAt).toLocaleString('vi-VN')}
                  </time>
                  <span className="text-xs text-fg-subtle">
                    {items.length} mục
                  </span>
                </div>
                <p className="text-fg-secondary">{journal.summary}</p>

                {journal.images && journal.images.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {journal.images.map((img) => (
                      <a
                        key={img.key}
                        href={img.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block aspect-square overflow-hidden rounded-md border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt={img.name ?? ''}
                          className="h-full w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}

                {items.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t pt-3">
                    {items.map((it) => (
                      <ItemLine key={it.id} item={it} />
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** One reviewable item: kind badge, the item itself, then its meaning. */
function ItemLine({ item }: { item: Knowledge }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span
        className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
          KIND_COLORS[item.englishKind as EnglishKind]
        }`}
      >
        {KIND_LABELS[item.englishKind as EnglishKind]}
      </span>
      <span>
        <span className="font-medium">{item.content}</span>
        {item.summary && (
          <span className="text-fg-muted"> — {item.summary}</span>
        )}
        {item.hard && <span className="ml-1 text-warning-text">★</span>}
      </span>
    </li>
  );
}
