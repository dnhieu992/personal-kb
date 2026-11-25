'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  AREA_COLOR,
  BoardResponse,
  PTask,
  TaskListResponse,
  dayMonth,
  fullDate,
  LONG_DAYS,
  monthTitle,
  weekdayOf,
  weekNumber,
} from '../lib/planner';
import { TASK_FILTERS, TaskFilter, usePlanner } from './state';
import { AddTaskBar, TaskGroup, TaskListView } from './tasks';
import { EmptyState, ProgressBar, Segmented, cx } from './ui';

const COLOR = AREA_COLOR.PERSONAL;

function useTasks(params: Parameters<typeof api.planner.tasks>[0]) {
  const { rev } = usePlanner();
  const [data, setData] = useState<TaskListResponse | null>(null);
  const key = JSON.stringify(params);
  useEffect(() => {
    let alive = true;
    api.planner.tasks(params).then((d) => alive && setData(d)).catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, rev]);
  return data;
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const doneText = (ts: PTask[]) => (ts.length ? ` · ${ts.filter((t) => t.done).length}/${ts.length} done` : '');
const ratio = (ts: PTask[]) => (ts.length ? ts.filter((t) => t.done).length / ts.length : null);

/** A project's tasks: Kanban board or the filtered list (Today / week / month / all / backlog). */
export function ProjectTasks({ projectId }: { projectId: number }) {
  const { board, setBoard, filter, setFilter } = usePlanner();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          value={board}
          onChange={setBoard}
          options={[
            { value: true, label: '▥ Board' },
            { value: false, label: '☰ List' },
          ]}
        />
        {!board && (
          <div className="-mx-1 overflow-x-auto px-1">
            <Segmented value={filter} onChange={setFilter} options={TASK_FILTERS.map((x) => ({ value: x.id, label: x.label }))} />
          </div>
        )}
        {board && <span className="text-xs text-fg-muted">Drag cards between columns · Done shows the last 7 days</span>}
      </div>
      {board ? <BoardView projectId={projectId} /> : <TaskList projectId={projectId} f={filter} />}
    </div>
  );
}

function byDay(tasks: PTask[], today: string): TaskGroup[] {
  const keys = Array.from(new Set(tasks.map((t) => t.date ?? ''))).sort();
  return keys.map((k) => {
    const ts = tasks.filter((t) => t.date === k);
    return {
      id: k,
      title: `${LONG_DAYS[weekdayOf(k)]}, ${dayMonth(k)}${k === today ? ' · Today' : ''}`,
      color: k === today ? COLOR : undefined,
      tasks: [...ts.filter((t) => !t.done), ...ts.filter((t) => t.done)],
    };
  });
}

function TaskList({ projectId, f }: { projectId: number; f: TaskFilter }) {
  const { today, setFilter } = usePlanner();
  const data = useTasks({ view: f, projectId });
  const tasks = data?.tasks ?? [];
  let subtitle = '';
  let groups: TaskGroup[] = [];
  let progress: number | null = null;

  switch (f) {
    case 'today': {
      const open = tasks.filter((t) => !t.done);
      const done = tasks.filter((t) => t.done);
      groups = [
        { id: 'open', title: 'To do', color: COLOR, tasks: open },
        { id: 'done', title: 'Done today', color: '#16A34A', tasks: done },
      ].filter((g) => g.tasks.length);
      subtitle = fullDate(today) + doneText(tasks);
      progress = ratio(tasks);
      break;
    }
    case 'week':
    case 'month': {
      const from = data?.range?.from ?? today;
      subtitle =
        f === 'week'
          ? `Week ${weekNumber(from)} · ${dayMonth(from)} – ${dayMonth(data?.range?.to ?? from)}`
          : monthTitle(from);
      subtitle += doneText(tasks);
      groups = byDay(tasks, today);
      progress = ratio(tasks);
      break;
    }
    case 'all':
      groups = [
        { id: 'overdue', title: 'Overdue', color: '#EF4444', tasks: tasks.filter((t) => t.isOverdue) },
        { id: 'today', title: 'Today', color: COLOR, tasks: tasks.filter((t) => t.date === today) },
        { id: 'upcoming', title: 'Upcoming', tasks: tasks.filter((t) => (t.date ?? '') > today) },
        { id: 'backlog', title: 'Backlog (no date)', tasks: tasks.filter((t) => !t.date) },
      ].filter((g) => g.tasks.length);
      subtitle = plural(tasks.length, 'open task');
      break;
    case 'backlog':
      groups = tasks.length ? [{ id: 'backlog', title: 'Backlog', tasks }] : [];
      subtitle = tasks.length ? `${plural(tasks.length, 'undated task')} · ☀️ pulls one into today` : 'No undated tasks';
      break;
  }

  const addDate = f === 'all' || f === 'backlog' ? null : today;

  return (
    <div className="flex flex-col gap-3">
      {subtitle && <div className="text-sm text-fg-muted">{subtitle}</div>}
      {progress != null && <ProgressBar value={progress} color={COLOR} height={4} />}
      <AddTaskBar
        date={addDate}
        projectId={projectId}
        placeholder={addDate ? 'Add for today…   #tag   !!! priority   @9:30 time' : 'Add a task…   #tag   !!! priority'}
      />
      {!data ? (
        <div className="py-10 text-center text-sm text-fg-subtle">Loading…</div>
      ) : groups.length === 0 ? (
        f === 'today' ? (
          <EmptyState icon="☀️" text="Nothing planned for today">
            <button className="mt-1 text-sm link" onClick={() => setFilter('backlog')}>
              Pick tasks from the backlog
            </button>
          </EmptyState>
        ) : f === 'backlog' ? (
          <EmptyState icon="📥" text="Backlog is empty" />
        ) : f === 'all' ? (
          <EmptyState icon="✅" text="No open tasks" />
        ) : (
          <EmptyState icon="📅" text="No tasks scheduled in this period" />
        )
      ) : (
        <TaskListView groups={groups} showDate={f === 'all' || f === 'backlog'} pullToday={f !== 'today'} />
      )}
    </div>
  );
}

// ───────────── Kanban board ─────────────

const COLUMNS: { id: 'backlog' | 'doing' | 'done'; label: string; icon: string }[] = [
  { id: 'backlog', label: 'Backlog', icon: '📥' },
  { id: 'doing', label: 'In progress', icon: '🔨' },
  { id: 'done', label: 'Done', icon: '✅' },
];

function BoardView({ projectId }: { projectId: number }) {
  const { rev, run, today, openTask, selectedTaskId } = usePlanner();
  const [data, setData] = useState<BoardResponse | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [text, setText] = useState('');

  useEffect(() => {
    api.planner.board(projectId).then(setData).catch(() => {});
  }, [projectId, rev]);

  const drop = (col: 'backlog' | 'doing' | 'done', id: number) => {
    // Optimistic: move the card right away.
    setData((d) => {
      if (!d) return d;
      const all = [...d.backlog, ...d.doing, ...d.done];
      const t = all.find((x) => x.id === id);
      if (!t) return d;
      const strip = (ts: PTask[]) => ts.filter((x) => x.id !== id);
      const moved = { ...t, done: col === 'done', inProgress: col === 'doing' };
      return {
        ...d,
        backlog: col === 'backlog' ? [moved, ...strip(d.backlog)] : strip(d.backlog),
        doing: col === 'doing' ? [moved, ...strip(d.doing)] : strip(d.doing),
        done: col === 'done' ? [moved, ...strip(d.done)] : strip(d.done),
      };
    });
    run(api.planner.moveTask(id, col));
  };
  const add = async (col: string) => {
    const t = text.trim();
    setText('');
    setAdding(null);
    if (!t) return;
    const created = await run(
      api.planner.addTask({ title: t, date: null, area: 'PERSONAL', projectId, inProgress: col === 'doing' }),
    );
    if (created && col === 'done') run(api.planner.moveTask(created.id, 'done'));
  };

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {COLUMNS.map((c) => {
        const ts = data?.[c.id] ?? [];
        return (
          <div
            key={c.id}
            className={cx('flex min-h-[300px] flex-col rounded-xl bg-muted p-2 transition', over === c.id && 'ring-2 ring-accent/30')}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(c.id);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = Number(e.dataTransfer.getData('text/plain'));
              if (id) drop(c.id, id);
            }}
          >
            <div className="flex items-center gap-1.5 px-1.5 pb-2 text-sm font-semibold">
              <span>{c.icon}</span>
              {c.label}
              <span className="font-normal text-fg-subtle">{ts.length}</span>
              <button className="ml-auto rounded px-1.5 text-fg-muted hover:bg-emphasis" title="Add a card" onClick={() => setAdding(c.id)}>
                +
              </button>
            </div>
            {adding === c.id && (
              <input
                autoFocus
                className="mb-2 rounded-lg border border-accent/40 bg-surface px-2.5 py-2 text-sm outline-none"
                placeholder="Task title…  #tag  !!!"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onBlur={() => add(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') add(c.id);
                  if (e.key === 'Escape') {
                    setText('');
                    setAdding(null);
                  }
                }}
              />
            )}
            <div className="flex flex-col gap-1.5">
              {ts.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', String(t.id))}
                  onClick={() => openTask(selectedTaskId === t.id ? null : t.id)}
                  className={cx(
                    'cursor-grab rounded-lg border-l-4 bg-surface px-2.5 py-2 text-sm shadow-sm active:cursor-grabbing',
                    selectedTaskId === t.id && 'ring-2 ring-accent/30',
                  )}
                  style={{ borderLeftColor: t.isOverdue ? '#EF4444' : COLOR }}
                >
                  <div className={cx(t.done && 'text-fg-subtle line-through')}>
                    {t.priority > 0 && (
                      <span className="mr-1 text-xs" style={{ color: ['', '#3B82F6', '#F97316', '#EF4444'][t.priority] }}>
                        ⚑
                      </span>
                    )}
                    {t.title}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-fg-muted">
                    {t.date && <span className={t.isOverdue ? 'text-danger-text' : ''}>{t.date === today ? 'Today' : dayMonth(t.date)}</span>}
                    {t.checklistTotal > 0 && (
                      <span>
                        ☑ {t.checklistDone}/{t.checklistTotal}
                      </span>
                    )}
                    {t.recurrenceId && <span>🔁</span>}
                    {t.tags.map((g) => (
                      <span key={g} className="text-accent-text">
                        #{g}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
