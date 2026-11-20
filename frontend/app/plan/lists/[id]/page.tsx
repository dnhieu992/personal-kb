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
import { Alert, Loading, PageHeader, ProgressBar } from '../../../components/ui';

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

  if (loading) return <Loading />;
  if (error || !list) return <Alert>{error ?? 'List not found.'}</Alert>;

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: '/plan/lists', label: 'All lists' }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {list.name}
            <span className={`chip ${CATEGORY_COLORS[list.category]}`}>{CATEGORY_LABELS[list.category]}</span>
          </span>
        }
        description={
          <>
            {list.description}
            {list.targetDate && <span className="mt-0.5 block text-fg-subtle">Target {list.targetDate}</span>}
          </>
        }
      />

      <div className="card p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-semibold text-fg">
            {done} <span className="font-normal text-fg-muted">of {tasks.length} done</span>
          </span>
          <span className="text-[13px] tabular-nums text-fg-muted">{pct}%</span>
        </div>
        <ProgressBar value={pct / 100} tone="success" className="mt-2.5" />
      </div>

      <TaskQuickAdd
        defaults={{ listId: list.id, category: list.category, planDate: null }}
        placeholder="Add a step towards this…"
        onCreated={load}
      />

      {tasks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-muted">
          No tasks yet. Break the goal into steps above, then pull them into a day
          from the{' '}
          <Link href="/plan" className="link">
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
