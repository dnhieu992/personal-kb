'use client';

import { DEFAULT_TZ, todayKey, type TaskSummary } from '@pkb/contracts';
import { cx, formatDue, PriorityBadge, ProjectDot } from '@/shared/ui/primitives';
import { useSetStatus } from '../queries';
import { useTaskDialog } from '../useTaskDialog';

export function TaskRow({ task, showProject }: { task: TaskSummary; showProject?: boolean }) {
  const setStatus = useSetStatus();
  const { open } = useTaskDialog();
  const due = formatDue(task.status === 'done' ? null : task.dueDate, todayKey(DEFAULT_TZ));
  const done = task.status === 'done';
  return (
    <div className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-subtle">
      <input
        type="checkbox"
        checked={done}
        onChange={() => setStatus.mutate({ id: task.id, status: done ? 'todo' : 'done' })}
        className="h-4 w-4 cursor-pointer accent-[rgb(var(--accent))]"
        title={done ? 'Reopen' : 'Complete'}
      />
      <button onClick={() => open(task.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className={cx('truncate text-sm', done && 'text-fg-subtle line-through')}>{task.title}</span>
        {task.recurrenceId && <span title="Recurring" className="text-xs text-fg-subtle">↻</span>}
        {task.status === 'doing' && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] text-violet-700">doing</span>}
      </button>
      {task.checklistTotal > 0 && (
        <span className="text-xs tabular-nums text-fg-muted">
          {task.checklistDone}/{task.checklistTotal}
        </span>
      )}
      {due && <span className={cx('text-xs', due.tone)}>{due.label}</span>}
      <PriorityBadge value={task.priority} />
      {showProject && (
        <span className="flex w-40 shrink-0 items-center gap-1.5 truncate text-xs text-fg-muted">
          <ProjectDot color={task.projectColor} />
          <span className="truncate">{task.projectName}</span>
        </span>
      )}
    </div>
  );
}
