"use client";

import { DEFAULT_TZ, todayKey, type TaskSummary } from "@pkb/contracts";
import {
  cx,
  formatDue,
  PriorityBadge,
  ProjectDot,
} from "@/shared/ui/primitives";
import { useSetStatus } from "../queries";
import { useTaskDialog } from "../useTaskDialog";

export function TaskRow({
  task,
  showProject,
}: {
  task: TaskSummary;
  showProject?: boolean;
}) {
  const setStatus = useSetStatus();
  const { open } = useTaskDialog();
  const due = formatDue(
    task.status === "done" ? null : task.dueDate,
    todayKey(DEFAULT_TZ),
  );
  const done = task.status === "done";
  return (
    <div className="group flex items-start gap-3 rounded-md px-2 py-2 hover:bg-subtle sm:items-center">
      <input
        type="checkbox"
        checked={done}
        onChange={() =>
          setStatus.mutate({ id: task.id, status: done ? "todo" : "done" })
        }
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[rgb(var(--accent))] sm:mt-0"
        title={done ? "Reopen" : "Complete"}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <button
          onClick={() => open(task.id)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span
            className={cx(
              "text-sm sm:truncate",
              done && "text-fg-subtle line-through",
            )}
          >
            {task.title}
          </span>
          {task.recurrenceId && (
            <span title="Recurring" className="text-xs text-fg-subtle">
              ↻
            </span>
          )}
          {task.status === "doing" && (
            <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent-text">
              doing
            </span>
          )}
        </button>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {task.checklistTotal > 0 && (
            <span className="text-xs tabular-nums text-fg-muted">
              {task.checklistDone}/{task.checklistTotal}
            </span>
          )}
          {due && <span className={cx("text-xs", due.tone)}>{due.label}</span>}
          <PriorityBadge value={task.priority} />
          {showProject && (
            <span className="flex min-w-0 max-w-[10rem] items-center gap-1.5 text-xs text-fg-muted sm:w-40 sm:shrink-0">
              <ProjectDot color={task.projectColor} />
              <span className="truncate">{task.projectName}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
