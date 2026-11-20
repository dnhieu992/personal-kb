'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import TaskQuickAdd from '../components/TaskQuickAdd';
import TaskRow from '../components/TaskRow';
import {
  api,
  CATEGORY_LABELS,
  DayPlan,
  isoDate,
  shiftDate,
  Task,
  TASK_CATEGORIES,
  TaskList,
  TaskStats,
} from '../lib/api';
import { Icon } from '../components/icons';
import { Alert, Loading, PageHeader, ProgressBar } from '../components/ui';

export default function PlanPage() {
  const today = isoDate();
  const [date, setDate] = useState(today);
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [backlog, setBacklog] = useState<Task[]>([]);
  const [showBacklog, setShowBacklog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [day, s, l, b] = await Promise.all([
        api.tasks.day(date),
        api.tasks.stats(date),
        api.taskLists.list(),
        api.tasks.list({ unplanned: true }),
      ]);
      setPlan(day);
      setStats(s);
      setLists(l);
      setBacklog(b);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  // Tasks are saved before the AI has finished correcting them, so poll until
  // every visible task has settled — then stop, so an idle tab stays idle.
  const pending = useMemo(
    () =>
      [...(plan?.tasks ?? []), ...(plan?.carriedOver ?? []), ...backlog].some(
        (t) => t.coachStatus === 'PENDING',
      ),
    [plan, backlog],
  );

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(load, 3000);
    return () => clearTimeout(timer);
  }, [pending, plan, backlog, load]);

  const progress = plan?.total ? Math.round((plan.done / plan.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily plan"
        description="Plan the day, tick things off — and let the AI fix the English you wrote it in."
        actions={
          <Link href="/plan/lists" className="btn btn-secondary">
            <Icon name="list" /> Long-term lists
          </Link>
        }
      />

      {/* Date navigation */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-lg border border-line-strong bg-surface shadow-xs">
          <button onClick={() => setDate(shiftDate(date, -1))} className="btn btn-ghost btn-icon btn-sm rounded-r-none" aria-label="Previous day">
            <Icon name="chevron-left" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || today)}
            className="h-8 border-x border-line bg-transparent px-2 text-[13px] text-fg outline-none"
          />
          <button onClick={() => setDate(shiftDate(date, 1))} className="btn btn-ghost btn-icon btn-sm rounded-l-none" aria-label="Next day">
            <Icon name="chevron-right" />
          </button>
        </div>
        {date !== today && (
          <button onClick={() => setDate(today)} className="btn btn-secondary btn-sm">
            Today
          </button>
        )}
        <span className="text-[15px] font-medium text-fg">
          {new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      {error && <Alert>{error}</Alert>}

      {/* Progress + pressure gauges */}
      {stats && (
        <div className="card p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-semibold text-fg">
              {plan?.done ?? 0} <span className="font-normal text-fg-muted">of {plan?.total ?? 0} done</span>
            </span>
            <span className="text-[13px] tabular-nums text-fg-muted">{progress}%</span>
          </div>
          <ProgressBar value={progress / 100} tone="success" className="mt-2.5" />
          <div className="mt-4 grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-5">
            <Gauge label="In progress" value={stats.inProgress} tone="text-accent-text" />
            <Gauge label="Overdue" value={stats.overdue} tone={stats.overdue ? 'text-danger-text' : undefined} />
            <Gauge label="Backlog" value={stats.backlog} />
            {TASK_CATEGORIES.map((c) => (
              <Gauge key={c} label={CATEGORY_LABELS[c]} value={`${stats.byCategory[c]?.done ?? 0}/${stats.byCategory[c]?.total ?? 0}`} />
            ))}
          </div>
        </div>
      )}

      {loading && <Loading />}

      {/* Unfinished from earlier days */}
      {plan && plan.carriedOver.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-warning-text">
            <Icon name="clock" className="h-3.5 w-3.5" />
            Carried over ({plan.carriedOver.length}) — unfinished from earlier days
          </h2>
          <div className="space-y-2">
            {plan.carriedOver.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                lists={lists}
                showPlanDate
                onChanged={load}
              />
            ))}
          </div>
        </section>
      )}

      {/* The day itself, split by where the work belongs */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {TASK_CATEGORIES.map((category) => {
          const tasks = (plan?.tasks ?? []).filter(
            (t) => t.category === category,
          );
          return (
            <section key={category} className="space-y-2">
              <h2 className="section-title flex items-baseline gap-2">
                {CATEGORY_LABELS[category]}
                <span className="text-[13px] font-normal tabular-nums text-fg-subtle">
                  {tasks.filter((t) => t.status === 'DONE').length}/{tasks.length}
                </span>
              </h2>
              <TaskQuickAdd
                defaults={{ planDate: date, category }}
                lists={lists}
                placeholder={
                  category === 'COMPANY'
                    ? 'Work task for this day…'
                    : 'Personal task for this day…'
                }
                onCreated={load}
              />
              {tasks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[13px] text-fg-subtle">Nothing planned yet.</p>
              ) : (
                tasks.map((t) => (
                  <TaskRow key={t.id} task={t} lists={lists} onChanged={load} />
                ))
              )}
            </section>
          );
        })}
      </div>

      {/* Backlog: things with no day yet */}
      <section>
        <button
          onClick={() => setShowBacklog((s) => !s)}
          className="flex items-center gap-1.5 text-[13px] font-semibold text-fg-secondary hover:text-fg"
        >
          <Icon name={showBacklog ? 'chevron-down' : 'chevron-right'} className="h-3.5 w-3.5" /> Backlog
          <span className="chip tone-gray">{backlog.length}</span>
        </button>
        {showBacklog && (
          <div className="mt-2 space-y-2">
            <TaskQuickAdd
              defaults={{ planDate: null }}
              lists={lists}
              showCategory
              placeholder="Something to do, some day…"
              onCreated={load}
            />
            {backlog.map((t) => (
              <TaskRow key={t.id} task={t} lists={lists} onChanged={load} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Gauge({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-lg bg-subtle px-3 py-2">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className={`mt-0.5 text-[15px] font-semibold tabular-nums ${tone ?? 'text-fg'}`}>{value}</p>
    </div>
  );
}
