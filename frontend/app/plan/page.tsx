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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Daily plan</h1>
          <p className="text-sm text-slate-500">
            Plan the day, tick things off — and let the AI fix the English you
            wrote it in.
          </p>
        </div>
        <Link
          href="/plan/lists"
          className="rounded-md border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
        >
          Long-term lists
        </Link>
      </div>

      {/* Date navigation */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setDate(shiftDate(date, -1))}
          className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-slate-50"
        >
          ←
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value || today)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
        <button
          onClick={() => setDate(shiftDate(date, 1))}
          className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-slate-50"
        >
          →
        </button>
        {date !== today && (
          <button
            onClick={() => setDate(today)}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Today
          </button>
        )}
        <span className="text-sm text-slate-500">
          {new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Progress + pressure gauges */}
      {stats && (
        <div className="space-y-3 rounded-lg border bg-white p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {plan?.done ?? 0} / {plan?.total ?? 0} done
            </span>
            <span className="text-slate-500">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-slate-100">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            <span>
              In progress <b className="text-indigo-700">{stats.inProgress}</b>
            </span>
            <span>
              Overdue <b className="text-red-600">{stats.overdue}</b>
            </span>
            <span>
              Backlog <b className="text-slate-800">{stats.backlog}</b>
            </span>
            {TASK_CATEGORIES.map((c) => (
              <span key={c}>
                {CATEGORY_LABELS[c]}{' '}
                <b className="text-slate-800">
                  {stats.byCategory[c]?.done ?? 0}/{stats.byCategory[c]?.total ?? 0}
                </b>
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      {/* Unfinished from earlier days */}
      {plan && plan.carriedOver.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-amber-700">
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
              <h2 className="text-lg font-semibold">
                {CATEGORY_LABELS[category]}{' '}
                <span className="text-sm font-normal text-slate-400">
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
                <p className="px-1 text-sm text-slate-400">Nothing planned yet.</p>
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
          className="text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          {showBacklog ? '▾' : '▸'} Backlog ({backlog.length})
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
