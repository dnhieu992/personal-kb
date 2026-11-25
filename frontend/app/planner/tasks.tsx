'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import {
  AREA_COLOR,
  Area,
  PTask,
  addDays,
  durationLabel,
  hhmm,
  relativeDay,
  startOfWeek,
} from '../lib/planner';
import { usePlanner } from './state';
import { AreaBadge, CategoryPicker, CheckBox, EditableTitle, PriorityFlag, Spinner, TagList, cx } from './ui';

export interface TaskGroup {
  id: string;
  title: string;
  color?: string;
  tasks: PTask[];
}

/** Quick-add bar: "#tag", "!!!" priority, "@9:30" start time. */
export function AddTaskBar({
  date,
  area,
  fixedCategoryId,
  goalId,
  placeholder,
}: {
  date: string | null;
  area: Area;
  fixedCategoryId?: number | null;
  goalId?: number | null;
  placeholder: string;
}) {
  const { run } = usePlanner();
  const [text, setText] = useState('');
  const [cat, setCat] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // "n" focuses the add bar (like ⌘N in the Mac app).
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  useEffect(() => {
    const saved = Number(localStorage.getItem(`planner.lastCategory.${area}`) || 0);
    setCat(saved || null);
  }, [area]);

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    await run(
      api.planner.addTask({
        title: t,
        date,
        area,
        categoryId: fixedCategoryId ?? cat,
        goalId: goalId ?? null,
      }),
    );
  };

  return (
    <div className="flex items-center gap-2 card px-3 py-1.5 focus-within:border-accent/40">
      <span className="text-lg text-fg-subtle">+</span>
      <input
        ref={input}
        className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none"
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      {fixedCategoryId == null && (
        <CategoryPicker
          area={area}
          value={cat}
          className="max-w-[9rem] border-transparent text-xs text-fg-muted"
          onChange={(id) => {
            setCat(id);
            localStorage.setItem(`planner.lastCategory.${area}`, String(id ?? 0));
          }}
        />
      )}
    </div>
  );
}

function TaskMenu({ task, onClose }: { task: PTask; onClose: () => void }) {
  const { run, today, categoriesIn, openTask, selectedTaskId } = usePlanner();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [onClose]);
  const act = (p: Promise<unknown>) => {
    onClose();
    run(p);
  };
  const move = (date: string | null) => act(api.planner.updateTask(task.id, { date }));
  const item = 'block w-full px-3 py-1.5 text-left text-sm hover:bg-muted';
  return (
    <div
      ref={ref}
      className="absolute right-0 top-7 z-30 w-52 overflow-hidden card py-1 shadow-lg"
      onClick={(e) => e.stopPropagation()}
    >
      {!task.done && task.date !== today && (
        <button className={item} onClick={() => move(today)}>☀️ Do today</button>
      )}
      {!task.done && task.date && !task.recurrenceId && (
        <button className={item} onClick={() => move(null)}>📥 Back to backlog</button>
      )}
      {!task.recurrenceId && (
        <>
          <button className={item} onClick={() => move(addDays(today, 1))}>Tomorrow</button>
          <button className={item} onClick={() => move(addDays(startOfWeek(today), 7))}>Next Monday</button>
        </>
      )}
      <div className="my-1 border-t border-line" />
      <div className="px-3 py-1 text-xs font-semibold uppercase text-fg-subtle">Category</div>
      <button className={item} onClick={() => act(api.planner.updateTask(task.id, { categoryId: null }))}>
        {task.categoryId == null ? '✓ ' : ''}None
      </button>
      {categoriesIn(task.area).map((c) => (
        <button key={c.id} className={item} onClick={() => act(api.planner.updateTask(task.id, { categoryId: c.id }))}>
          {task.categoryId === c.id ? '✓ ' : ''}
          <span style={{ color: c.color }}>●</span> {c.name}
        </button>
      ))}
      <div className="my-1 border-t border-line" />
      <button
        className={cx(item, 'text-danger-text')}
        onClick={() => {
          if (selectedTaskId === task.id) openTask(null);
          act(api.planner.deleteTask(task.id));
        }}
      >
        Delete task
      </button>
    </div>
  );
}

export function TaskRow({
  task,
  showDate,
  showArea,
  pullToday,
}: {
  task: PTask;
  showDate?: boolean;
  showArea?: boolean;
  pullToday?: boolean;
}) {
  const { run, category, today, openTask, selectedTaskId } = usePlanner();
  const [menu, setMenu] = useState(false);
  const cat = category(task.categoryId);
  const color = cat?.color ?? AREA_COLOR[task.area];
  const selected = selectedTaskId === task.id;
  const meta: React.ReactNode[] = [];
  if (showArea) meta.push(<AreaBadge key="a" area={task.area} />);
  if (cat) meta.push(<span key="c" style={{ color: cat.color }}>{cat.name}</span>);
  if (showDate && task.date)
    meta.push(
      <span key="d" className={task.isOverdue ? 'text-danger-text' : ''}>
        {relativeDay(task.date, today)}
      </span>,
    );
  if (task.startTime != null)
    meta.push(<span key="t">🕘 {hhmm(task.startTime)}{task.duration ? ` · ${durationLabel(task.duration)}` : ''}</span>);
  else if (task.duration) meta.push(<span key="du">⏱ {durationLabel(task.duration)}</span>);
  if (task.checklistTotal) meta.push(<span key="cl">☑ {task.checklistDone}/{task.checklistTotal}</span>);
  if (task.recurrenceId) meta.push(<span key="r" title="Repeats">🔁</span>);
  if (task.reminderAt && !task.done) meta.push(<span key="rm" title="Reminder">🔔</span>);
  if (task.attachmentCount) meta.push(<span key="at">📎 {task.attachmentCount}</span>);
  if (task.notes?.trim()) meta.push(<span key="n" title="Has notes">📝</span>);
  if (task.result?.trim()) meta.push(<span key="res" title="Has result">🏁</span>);
  if (task.inProgress) meta.push(<span key="ip" className="font-medium text-warning-text">In progress</span>);
  if (task.tags.length) meta.push(<span key="tg" className="space-x-1"><TagList tags={task.tags} /></span>);

  return (
    <div
      className={cx(
        'group relative flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 transition',
        selected ? 'bg-accent-soft ring-1 ring-accent/30' : 'hover:bg-surface',
      )}
      onClick={() => openTask(selected ? null : task.id)}
    >
      <div className="pt-0.5">
        <CheckBox done={task.done} color={color} onToggle={() => run(api.planner.updateTask(task.id, { done: !task.done }))} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <PriorityFlag p={task.priority} />
          <EditableTitle
            doubleClick
            value={task.title}
            className={cx('text-sm', task.done && 'text-fg-subtle line-through')}
            onSave={(v) => v && run(api.planner.updateTask(task.id, { title: v }))}
          />
          {task.englishPending && <Spinner title="Checking English…" />}
        </div>
        {meta.length > 0 && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-fg-muted">{meta}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-60 group-hover:opacity-100">
        {pullToday && !task.done && task.date !== today && (
          <button
            title="Do today"
            className="rounded px-1.5 py-0.5 text-sm hover:bg-warning-soft"
            onClick={(e) => {
              e.stopPropagation();
              run(api.planner.updateTask(task.id, { date: today }));
            }}
          >
            ☀️
          </button>
        )}
        <button
          title="More"
          className="rounded px-1.5 py-0.5 text-fg-muted hover:bg-emphasis"
          onClick={(e) => {
            e.stopPropagation();
            setMenu((m) => !m);
          }}
        >
          ⋯
        </button>
      </div>
      {menu && <TaskMenu task={task} onClose={() => setMenu(false)} />}
    </div>
  );
}

export function TaskListView({
  groups,
  showDate,
  showArea,
  pullToday,
}: {
  groups: TaskGroup[];
  showDate?: boolean;
  showArea?: boolean;
  pullToday?: boolean;
}) {
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.id}>
          <div className="mb-1 flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wide" style={{ color: g.color ?? '#64748B' }}>
            {g.title}
            <span className="font-normal text-fg-subtle">{g.tasks.length}</span>
          </div>
          <div className="space-y-0.5">
            {g.tasks.map((t) => (
              <TaskRow key={t.id} task={t} showDate={showDate} showArea={showArea} pullToday={pullToday} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
