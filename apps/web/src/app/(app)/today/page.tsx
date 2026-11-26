'use client';

import type { TaskSummary } from '@pkb/contracts';
import { NewTaskForm } from '@/features/tasks/components/NewTaskForm';
import { TaskRow } from '@/features/tasks/components/TaskRow';
import { useToday } from '@/features/tasks/queries';
import { Empty, Spinner } from '@/shared/ui/primitives';

const SECTIONS: { key: 'overdue' | 'dueToday' | 'inProgress' | 'pinned'; title: string; tone: string }[] = [
  { key: 'overdue', title: 'Overdue', tone: 'text-red-600' },
  { key: 'dueToday', title: 'Due today', tone: 'text-amber-700' },
  { key: 'inProgress', title: 'In progress', tone: 'text-violet-700' },
  { key: 'pinned', title: 'Pinned for today', tone: 'text-fg-secondary' },
];

export default function TodayPage() {
  const q = useToday();
  const total = q.data ? SECTIONS.reduce((n, s) => n + q.data[s.key].length, 0) : 0;
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Today</h1>
        {q.data && (
          <p className="text-sm text-fg-muted">
            {new Date(q.data.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} · {total} task{total === 1 ? '' : 's'}
          </p>
        )}
      </header>
      <NewTaskForm pinByDefault />
      {q.isLoading ? (
        <Spinner />
      ) : total === 0 ? (
        <Empty>Nothing on your plate. Pin a task for today or add one above.</Empty>
      ) : (
        SECTIONS.map((s) =>
          q.data![s.key].length ? (
            <section key={s.key}>
              <h2 className={`mb-1 text-xs font-semibold uppercase tracking-wide ${s.tone}`}>
                {s.title} · {q.data![s.key].length}
              </h2>
              <div className="rounded-lg border border-line bg-surface p-1">
                {q.data![s.key].map((t: TaskSummary) => (
                  <TaskRow key={t.id} task={t} showProject />
                ))}
              </div>
            </section>
          ) : null,
        )
      )}
    </div>
  );
}
