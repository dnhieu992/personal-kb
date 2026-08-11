'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import TaskQuickAdd from '../../../components/TaskQuickAdd';
import TaskRow from '../../../components/TaskRow';
import {
  api,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  Task,
  TaskList,
} from '../../../lib/api';

export default function TaskListDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [list, setList] = useState<TaskList | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [l, t] = await Promise.all([
        api.taskLists.get(params.id),
        api.taskLists.tasks(params.id),
      ]);
      setList(l);
      setTasks(t);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Same background-coaching poll as the daily plan.
  const pending = useMemo(
    () => tasks.some((t) => t.coachStatus === 'PENDING'),
    [tasks],
  );

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(load, 3000);
    return () => clearTimeout(timer);
  }, [pending, tasks, load]);

  const done = tasks.filter((t) => t.status === 'DONE').length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error || !list)
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error ?? 'List not found.'}
      </div>
    );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/plan/lists" className="text-sm text-indigo-600 hover:underline">
          ← All lists
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{list.name}</h1>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              CATEGORY_COLORS[list.category]
            }`}
          >
            {CATEGORY_LABELS[list.category]}
          </span>
          {list.targetDate && (
            <span className="text-sm text-slate-500">target {list.targetDate}</span>
          )}
        </div>
        {list.description && (
          <p className="mt-1 text-sm text-slate-500">{list.description}</p>
        )}
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {done} / {tasks.length} done
          </span>
          <span className="text-slate-500">{pct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded bg-slate-100">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <TaskQuickAdd
        defaults={{ listId: list.id, category: list.category, planDate: null }}
        placeholder="Add a step towards this…"
        onCreated={load}
      />

      {tasks.length === 0 ? (
        <p className="text-sm text-slate-400">
          No tasks yet. Break the goal into steps above, then pull them into a day
          from the{' '}
          <Link href="/plan" className="text-indigo-600 underline">
            daily plan
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} showPlanDate onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}
