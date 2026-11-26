'use client';

import { DEFAULT_TZ, positionBetween, TASK_STATUSES, todayKey, type TaskStatus, type TaskSummary } from '@pkb/contracts';
import { useState } from 'react';
import { cx, formatDue, PriorityBadge } from '@/shared/ui/primitives';
import { useMoveTask } from '../queries';
import { useTaskDialog } from '../useTaskDialog';

const LABEL: Record<TaskStatus, string> = { todo: 'To do', doing: 'Doing', done: 'Done' };

/** Native HTML5 drag & drop; one row updated per drop (fractional position). */
export function Kanban({ projectId, tasks, includeOldDone }: { projectId: string; tasks: TaskSummary[]; includeOldDone: boolean }) {
  const move = useMoveTask(projectId, includeOldDone);
  const { open } = useTaskDialog();
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<{ status: TaskStatus; index: number } | null>(null);
  const today = todayKey(DEFAULT_TZ);

  const columns = TASK_STATUSES.map((s) => ({
    status: s,
    items: tasks.filter((t) => t.status === s).sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0)),
  }));

  function drop(status: TaskStatus, index: number) {
    if (!drag) return;
    const col = columns.find((c) => c.status === status)!.items.filter((t) => t.id !== drag);
    const before = col[index - 1] ?? null;
    const after = col[index] ?? null;
    let optimisticPosition: string;
    try {
      optimisticPosition = positionBetween(before?.position ?? null, after?.position ?? null);
    } catch {
      optimisticPosition = positionBetween(before?.position ?? null, null);
    }
    const t = tasks.find((x) => x.id === drag);
    if (t && t.status === status && t.position === optimisticPosition) return;
    move.mutate({ id: drag, input: { status, beforeId: before?.id ?? null, afterId: after?.id ?? null }, optimisticPosition });
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {columns.map((col) => (
        <div
          key={col.status}
          className="flex min-h-[200px] flex-col rounded-lg bg-subtle/70 p-2"
          onDragOver={(e) => {
            e.preventDefault();
            if (!over || over.status !== col.status) setOver({ status: col.status, index: col.items.length });
          }}
          onDrop={(e) => {
            e.preventDefault();
            drop(col.status, over?.status === col.status ? over.index : col.items.length);
            setDrag(null);
            setOver(null);
          }}
        >
          <div className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
            {LABEL[col.status]} <span className="tabular-nums">{col.items.length}</span>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            {col.items.map((t, i) => {
              const due = formatDue(t.status === 'done' ? null : t.dueDate, today);
              return (
                <div key={t.id}>
                  {over?.status === col.status && over.index === i && drag !== t.id && <div className="mb-2 h-0.5 rounded bg-accent" />}
                  <div
                    draggable
                    onDragStart={(e) => {
                      setDrag(t.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      setDrag(null);
                      setOver(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const r = e.currentTarget.getBoundingClientRect();
                      const idx = e.clientY < r.top + r.height / 2 ? i : i + 1;
                      if (over?.status !== col.status || over.index !== idx) setOver({ status: col.status, index: idx });
                    }}
                    onClick={() => open(t.id)}
                    className={cx(
                      'cursor-pointer rounded-md border border-line bg-surface p-2.5 shadow-sm hover:border-line-strong',
                      drag === t.id && 'opacity-40',
                    )}
                  >
                    <div className={cx('text-sm', t.status === 'done' && 'text-fg-subtle line-through')}>
                      {t.title} {t.recurrenceId && <span className="text-xs text-fg-subtle">↻</span>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <PriorityBadge value={t.priority} />
                      {due && <span className={cx('text-xs', due.tone)}>{due.label}</span>}
                      {t.checklistTotal > 0 && (
                        <span className="ml-auto text-xs tabular-nums text-fg-muted">
                          ☑ {t.checklistDone}/{t.checklistTotal}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {over?.status === col.status && over.index === col.items.length && drag && <div className="h-0.5 rounded bg-accent" />}
          </div>
        </div>
      ))}
    </div>
  );
}
