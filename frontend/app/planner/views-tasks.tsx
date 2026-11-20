'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import {
  AREA_COLOR,
  Area,
  BoardResponse,
  PGoal,
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
import { AddTaskBar, TaskGroup, TaskListView, TaskRow } from './tasks';
import { AreaBadge, EmptyState, MarkdownField, ProgressBar, Segmented, cx } from './ui';

function useTasks(params: Parameters<typeof api.planner.tasks>[0] | null) {
  const { rev } = usePlanner();
  const [data, setData] = useState<TaskListResponse | null>(null);
  const key = JSON.stringify(params);
  useEffect(() => {
    if (!params) return;
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

export function Header({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 pb-3">
      <div className="min-w-0">
        {eyebrow && <div className="text-xs font-semibold uppercase">{eyebrow}</div>}
        <h1 className="text-[22px] font-semibold leading-8">{title}</h1>
        {subtitle && <div className="text-sm text-fg-muted">{subtitle}</div>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}

export function TasksView({ area }: { area: Area }) {
  const { board, setBoard, categoryFilter, setCategoryFilter, category, categoriesIn, editCategory } = usePlanner();
  const active = category(categoryFilter);
  const activeCat = active && active.area === area ? active : undefined;

  const catMenu = (
    <select
      className="input input-sm"
      style={{ color: activeCat?.color }}
      value={activeCat?.id ?? 0}
      title="Filter tasks by category"
      onChange={(e) => {
        const v = Number(e.target.value);
        if (v === -1) editCategory({ area, then: (id) => setCategoryFilter(id) });
        else setCategoryFilter(v || null);
      }}
    >
      <option value={0}>All categories</option>
      {categoriesIn(area).map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
      <option value={-1}>New category…</option>
    </select>
  );
  const right = (
    <>
      {catMenu}
      <Segmented
        value={board}
        onChange={setBoard}
        options={[
          { value: false, label: '☰ List' },
          { value: true, label: '▥ Board' },
        ]}
      />
    </>
  );
  return board ? (
    <BoardView area={area} categoryId={activeCat?.id} right={right} />
  ) : (
    <TaskList area={area} categoryId={activeCat?.id} categoryName={activeCat?.name} right={right} />
  );
}

function groupByCategory(tasks: PTask[], cats: { id: number; name: string; color: string }[], area: Area): TaskGroup[] {
  const out: TaskGroup[] = [];
  const general = tasks.filter((t) => !cats.some((c) => c.id === t.categoryId));
  if (general.length) out.push({ id: 'general', title: 'General', color: AREA_COLOR[area], tasks: general });
  for (const c of cats) {
    const ts = tasks.filter((t) => t.categoryId === c.id);
    if (ts.length) out.push({ id: `c${c.id}`, title: c.name, color: c.color, tasks: ts });
  }
  return out;
}

function byDay(tasks: PTask[], today: string, area: Area): TaskGroup[] {
  const keys = Array.from(new Set(tasks.map((t) => t.date ?? ''))).sort();
  return keys.map((k) => {
    const ts = tasks.filter((t) => t.date === k);
    return {
      id: k,
      title: `${LONG_DAYS[weekdayOf(k)]}, ${dayMonth(k)}${k === today ? ' · Today' : ''}`,
      color: k === today ? AREA_COLOR[area] : undefined,
      tasks: [...ts.filter((t) => !t.done), ...ts.filter((t) => t.done)],
    };
  });
}

function TaskList({
  area,
  categoryId,
  categoryName,
  right,
}: {
  area: Area;
  categoryId?: number;
  categoryName?: string;
  right: React.ReactNode;
}) {
  const { filter: f, setFilter, today, meta, categoriesIn, run } = usePlanner();
  const data = useTasks({ view: f, area });
  const cats = categoriesIn(area);

  let tasks = data?.tasks ?? [];
  if (categoryId) tasks = tasks.filter((t) => t.categoryId === categoryId);
  let subtitle = '';
  let groups: TaskGroup[] = [];
  let progress: number | null = null;
  const goals: PGoal[] = data?.goals ?? [];

  switch (f) {
    case 'today': {
      const open = tasks.filter((t) => !t.done);
      const done = tasks.filter((t) => t.done);
      groups = groupByCategory(open, cats, area);
      if (done.length) groups.push({ id: 'done', title: 'Done today', color: '#16A34A', tasks: done });
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
      groups = byDay(tasks, today, area);
      progress = ratio(tasks);
      break;
    }
    case 'all':
      groups = [
        { id: 'overdue', title: 'Overdue', color: '#EF4444', tasks: tasks.filter((t) => t.isOverdue) },
        { id: 'today', title: 'Today', color: AREA_COLOR[area], tasks: tasks.filter((t) => t.date === today) },
        { id: 'upcoming', title: 'Upcoming', tasks: tasks.filter((t) => (t.date ?? '') > today) },
        { id: 'backlog', title: 'Backlog (no date)', tasks: tasks.filter((t) => !t.date) },
      ].filter((g) => g.tasks.length);
      subtitle = plural(tasks.length, 'open task');
      break;
    case 'backlog':
      groups = groupByCategory(tasks, cats, area);
      subtitle = tasks.length ? `${plural(tasks.length, 'undated task')} · ☀️ pulls one into today` : 'No undated tasks';
      break;
  }
  if (categoryName) subtitle += ` · ${categoryName} only`;

  const label = (id: TaskFilter, l: string) => {
    const n = id === 'today' ? meta?.remainingToday[area] : id === 'backlog' ? meta?.backlog[area] : 0;
    return n ? `${l} ${n}` : l;
  };
  const overdueN = meta?.overdue[area] ?? 0;
  const addDate = f === 'all' || f === 'backlog' ? null : today;

  return (
    <div className="flex flex-col gap-3">
      <Header eyebrow={<AreaBadge area={area} />} title="Tasks" subtitle={subtitle} right={right} />
      <div className="-mx-1 overflow-x-auto px-1">
        <Segmented
          value={f}
          onChange={setFilter}
          options={TASK_FILTERS.map((x) => ({ value: x.id, label: label(x.id, x.label) }))}
        />
      </div>
      {progress != null && <ProgressBar value={progress} color={AREA_COLOR[area]} height={4} />}
      {goals.length > 0 && <GoalStrip goals={goals} />}
      {f === 'today' && overdueN > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-text">
          <span>⚠️ {plural(overdueN, 'unfinished task')} from earlier days</span>
          <button
            className="ml-auto rounded-md bg-surface px-2 py-0.5 text-xs font-medium shadow-sm hover:bg-danger-soft"
            onClick={() => run(api.planner.moveOverdue(area))}
          >
            Move all to today
          </button>
        </div>
      )}
      <AddTaskBar
        date={addDate}
        area={area}
        fixedCategoryId={categoryId}
        placeholder={addDate ? 'Add for today…   #tag   !!! priority   @9:30 time' : 'Add to backlog…   #tag   !!! priority'}
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
          <EmptyState icon="📥" text="Backlog is empty — add anything you need to do" />
        ) : f === 'all' ? (
          <EmptyState icon="✅" text="No open tasks" />
        ) : (
          <EmptyState icon="📅" text="No tasks scheduled in this period" />
        )
      ) : (
        <TaskListView groups={groups} showDate={f === 'all'} pullToday={f !== 'today'} />
      )}
      {f === 'today' && <DayNoteBox day={today} area={area} />}
    </div>
  );
}

function GoalStrip({ goals }: { goals: PGoal[] }) {
  const { go } = usePlanner();
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {goals.map((g) => (
        <button
          key={g.id}
          onClick={() => go({ kind: 'goals', area: g.area })}
          className="min-w-[180px] card px-3 py-2 text-left text-sm hover:border-line-strong"
        >
          <div className="flex items-center gap-1.5">
            <span>{g.done ? '🏅' : '🎯'}</span>
            <span className="truncate font-medium">{g.title}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <ProgressBar value={g.progressTotal ? g.progressDone / g.progressTotal : 0} color={AREA_COLOR[g.area]} height={4} />
            <span className="text-xs text-fg-muted">
              {g.progressDone}/{g.progressTotal}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}

function DayNoteBox({ day, area }: { day: string; area: Area }) {
  const [body, setBody] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      setOpen(localStorage.getItem('planner.dayNoteOpen') !== 'false');
    } catch {}
  }, []);
  useEffect(() => {
    setBody(null);
    api.planner.dayNote(day, area).then((n) => setBody(n.body ?? '')).catch(() => setBody(''));
  }, [day, area]);
  return (
    <div className="mt-4 border-t border-line pt-3">
      <button
        className="mb-2 flex items-center gap-1.5 text-sm font-semibold"
        onClick={() => {
          setOpen(!open);
          try {
            localStorage.setItem('planner.dayNoteOpen', String(!open));
          } catch {}
        }}
      >
        <span className={cx('inline-block transition', open && 'rotate-90')}>▸</span>
        Notes for the day
      </button>
      {open && body !== null && (
        <MarkdownField
          key={`${day}-${area}`}
          value={body}
          minRows={5}
          placeholder="What happened today, blockers, ideas…"
          onSave={(v) => api.planner.saveDayNote(day, area, v)}
        />
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

function BoardView({ area, categoryId, right }: { area: Area; categoryId?: number; right: React.ReactNode }) {
  const { rev, run, category, today, openTask, selectedTaskId } = usePlanner();
  const [data, setData] = useState<BoardResponse | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [text, setText] = useState('');

  useEffect(() => {
    api.planner.board(area).then(setData).catch(() => {});
  }, [area, rev]);

  const filt = (ts: PTask[]) => (categoryId ? ts.filter((t) => t.categoryId === categoryId) : ts);
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
      api.planner.addTask({ title: t, date: null, area, categoryId: categoryId ?? null, inProgress: col === 'doing' }),
    );
    if (created && col === 'done') run(api.planner.moveTask(created.id, 'done'));
  };

  return (
    <div className="flex flex-col gap-3">
      <Header
        eyebrow={<AreaBadge area={area} />}
        title="Tasks"
        subtitle="Drag cards between columns · Done shows the last 7 days"
        right={right}
      />
      <div className="grid gap-3 md:grid-cols-3">
        {COLUMNS.map((c) => {
          const ts = filt(data?.[c.id] ?? []);
          return (
            <div
              key={c.id}
              className={cx(
                'flex min-h-[300px] flex-col rounded-xl bg-muted p-2 transition',
                over === c.id && 'ring-2 ring-accent/30',
              )}
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
                <button
                  className="ml-auto rounded px-1.5 text-fg-muted hover:bg-emphasis"
                  title="Add a card"
                  onClick={() => setAdding(c.id)}
                >
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
                {ts.map((t) => {
                  const cat = category(t.categoryId);
                  return (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(t.id))}
                      onClick={() => openTask(selectedTaskId === t.id ? null : t.id)}
                      className={cx(
                        'cursor-grab rounded-lg border-l-4 bg-surface px-2.5 py-2 text-sm shadow-sm active:cursor-grabbing',
                        selectedTaskId === t.id && 'ring-2 ring-accent/30',
                      )}
                      style={{ borderLeftColor: cat?.color ?? AREA_COLOR[t.area] }}
                    >
                      <div className={cx(t.done && 'text-fg-subtle line-through')}>
                        {t.priority > 0 && <span className="mr-1 text-xs" style={{ color: ['', '#3B82F6', '#F97316', '#EF4444'][t.priority] }}>⚑</span>}
                        {t.title}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-fg-muted">
                        {cat && <span style={{ color: cat.color }}>{cat.name}</span>}
                        {t.date && <span className={t.isOverdue ? 'text-danger-text' : ''}>{t.date === today ? 'Today' : dayMonth(t.date)}</span>}
                        {t.checklistTotal > 0 && <span>☑ {t.checklistDone}/{t.checklistTotal}</span>}
                        {t.recurrenceId && <span>🔁</span>}
                        {t.tags.map((g) => (
                          <span key={g} className="text-accent-text">#{g}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────── Overdue / category / search ─────────────

export function OverdueView() {
  const { run, meta } = usePlanner();
  const data = useTasks({ view: 'overdue' });
  const tasks = data?.tasks ?? [];
  return (
    <div className="flex flex-col gap-3">
      <Header
        title="Overdue"
        subtitle={`${plural(tasks.length, 'unfinished task')} from earlier days`}
        right={
          (meta?.overdue.total ?? 0) > 0 && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => run(api.planner.moveOverdue())}
            >
              Move all to today
            </button>
          )
        }
      />
      {data && !tasks.length ? (
        <EmptyState icon="🎉" text="Nothing overdue" />
      ) : (
        <TaskListView groups={byDay(tasks, '', 'WORK').map((g) => ({ ...g, color: '#EF4444' }))} showArea pullToday />
      )}
    </div>
  );
}

export function CategoryTasksView({ id }: { id: number }) {
  const { category, editCategory, run, go, today } = usePlanner();
  const c = category(id);
  const data = useTasks({ view: 'category', categoryId: id });
  if (!c) return <EmptyState icon="🏷️" text="Category not found" />;
  const tasks = data?.tasks ?? [];
  const open = tasks.filter((t) => !t.done);
  return (
    <div className="flex flex-col gap-3">
      <Header
        eyebrow={<AreaBadge area={c.area} />}
        title={c.name}
        subtitle={`${open.length} open · done in the last 7 days shown below`}
        right={
          <>
            <button className="rounded-md px-2.5 py-1 text-sm text-fg-secondary hover:bg-emphasis" onClick={() => editCategory({ area: c.area, edit: c })}>
              Edit
            </button>
            <button
              className="rounded-md px-2.5 py-1 text-sm text-danger-text hover:bg-danger-soft"
              onClick={async () => {
                if (!confirm(`Delete category “${c.name}”? Tasks in it are kept; they just lose the category.`)) return;
                await run(api.planner.deleteCategory(c.id));
                go({ kind: 'tasks', area: c.area });
              }}
            >
              Delete
            </button>
          </>
        }
      />
      <div className="h-1 w-16 rounded-full" style={{ background: c.color }} />
      <AddTaskBar date={today} area={c.area} fixedCategoryId={c.id} placeholder={`Add to ${c.name} for today…   #tag   !!!`} />
      {data && !tasks.length ? (
        <EmptyState icon="🏷️" text="No tasks in this category yet" />
      ) : (
        <TaskListView
          groups={[
            { id: 'open', title: 'Open', color: c.color, tasks: open },
            { id: 'done', title: 'Done', color: '#16A34A', tasks: tasks.filter((t) => t.done) },
          ].filter((g) => g.tasks.length)}
          showDate
          pullToday
        />
      )}
    </div>
  );
}

export function SearchResults({ q }: { q: string }) {
  const data = useTasks({ view: 'search', q });
  const tasks = data?.tasks ?? [];
  return (
    <div className="flex flex-col gap-3">
      <Header title={`Results for “${q}”`} subtitle={data ? plural(tasks.length, 'task') : 'Searching…'} />
      {data && !tasks.length ? (
        <EmptyState icon="🔍" text="No tasks found" />
      ) : (
        <div className="space-y-0.5">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} showDate showArea />
          ))}
        </div>
      )}
    </div>
  );
}
