'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import {
  AREA_COLOR,
  Area,
  GoalPeriod,
  PGoal,
  PGoalDetail,
  PNote,
  addDays,
  addMonths,
  goalPeriodLabel,
  otherArea,
  AREA_LABEL,
  relativeDay,
  shortDateTime,
  startOfMonth,
  startOfWeek,
} from '../lib/planner';
import { usePlanner } from './state';
import { AddTaskBar, TaskListView } from './tasks';
import { Header } from './views-tasks';
import {
  AreaBadge,
  AreaPicker,
  CategoryPicker,
  CheckBox,
  EditableTitle,
  EmptyState,
  MarkdownField,
  Modal,
  ProgressBar,
  Segmented,
  Spinner,
  cx,
} from './ui';

// ───────────── Goals ─────────────

export function GoalsView({ area }: { area: Area }) {
  const { rev, today } = usePlanner();
  const [goals, setGoals] = useState<PGoal[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.planner.goals(area).then(setGoals).catch(() => setGoals([]));
  }, [area, rev]);

  useEffect(() => setSelected(null), [area]);

  const week = startOfWeek(today);
  const month = startOfMonth(today);
  const current = (goals ?? []).filter((g) => !g.done && (g.periodStart === week || g.periodStart === month || g.periodStart > today));
  const earlierOpen = (goals ?? []).filter((g) => !g.done && !current.includes(g));
  const done = (goals ?? []).filter((g) => g.done);
  const groups = [
    { id: 'current', title: 'Current & upcoming', goals: current },
    { id: 'earlier', title: 'Earlier, still open', goals: earlierOpen },
    { id: 'done', title: 'Completed', goals: done },
  ].filter((g) => g.goals.length);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <Header
          eyebrow={<AreaBadge area={area} />}
          title="Goals"
          subtitle="Weekly & monthly goals, broken into tasks"
          right={
            <button className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700" onClick={() => setCreating(true)}>
              + Goal
            </button>
          }
        />
        {goals && !goals.length && <EmptyState icon="🎯" text="No goals yet — set one for this week or month" />}
        {groups.map((gr) => (
          <section key={gr.id}>
            <div className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{gr.title}</div>
            <div className="space-y-1">
              {gr.goals.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelected(g.id)}
                  className={cx(
                    'w-full rounded-lg border px-3 py-2 text-left text-sm transition',
                    selected === g.id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300',
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{g.done ? '🏅' : '🎯'}</span>
                    <span className={cx('flex-1 truncate font-medium', g.done && 'text-slate-400 line-through')}>{g.title}</span>
                    <span className="text-xs text-slate-400">
                      {g.progressDone}/{g.progressTotal}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{goalPeriodLabel(g)}</div>
                  <div className="mt-1.5">
                    <ProgressBar value={g.progressTotal ? g.progressDone / g.progressTotal : 0} color={AREA_COLOR[area]} height={4} />
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="min-w-0">
        {selected ? (
          <GoalDetail id={selected} onDeleted={() => setSelected(null)} />
        ) : (
          <div className="hidden lg:block">
            <EmptyState icon="🎯" text="Select a goal to see its steps" />
          </div>
        )}
      </div>
      {creating && (
        <NewGoalModal
          area={area}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setSelected(id);
          }}
        />
      )}
    </div>
  );
}

function NewGoalModal({ area, onClose, onCreated }: { area: Area; onClose: () => void; onCreated: (id: number) => void }) {
  const { today, run } = usePlanner();
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState<GoalPeriod>('week');
  const [next, setNext] = useState(false);
  const [cat, setCat] = useState<number | null>(null);
  const start = period === 'week' ? addDays(startOfWeek(today), next ? 7 : 0) : next ? addMonths(today, 1) : startOfMonth(today);
  const create = async () => {
    if (!title.trim()) return;
    const g = await run(api.planner.addGoal({ title: title.trim(), area, period, periodStart: start, categoryId: cat }));
    if (g) onCreated(g.id);
  };
  return (
    <Modal title={`New ${AREA_LABEL[area].toLowerCase()} goal`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <input
          autoFocus
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          placeholder="What do you want to achieve?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={period} onChange={setPeriod} options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
          <Segmented
            value={next}
            onChange={setNext}
            options={[
              { value: false, label: period === 'week' ? 'This week' : 'This month' },
              { value: true, label: period === 'week' ? 'Next week' : 'Next month' },
            ]}
          />
        </div>
        <div className="text-xs text-slate-500">{goalPeriodLabel({ period, periodStart: start })}</div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Category</span>
          <CategoryPicker area={area} value={cat} onChange={setCat} noneLabel="None" />
        </div>
        <div className="flex justify-end gap-2">
          <button className="rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100" onClick={onClose}>
            Cancel
          </button>
          <button className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white disabled:opacity-40" disabled={!title.trim()} onClick={create}>
            Create
          </button>
        </div>
      </div>
    </Modal>
  );
}

function GoalDetail({ id, onDeleted }: { id: number; onDeleted: () => void }) {
  const { rev, run, today } = usePlanner();
  const [g, setG] = useState<PGoalDetail | null>(null);
  const [schedule, setSchedule] = useState(true);
  const [day, setDay] = useState(today);

  useEffect(() => {
    api.planner.goal(id).then(setG).catch(() => onDeleted());
  }, [id, rev]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!g || g.id !== id) return <div className="p-6 text-sm text-slate-400">Loading…</div>;
  const patch = (b: Record<string, unknown>) => run(api.planner.updateGoal(g.id, b));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="pt-1">
          <CheckBox done={g.done} color={AREA_COLOR[g.area]} size={22} onToggle={() => patch({ done: !g.done })} />
        </div>
        <div className="min-w-0 flex-1">
          <EditableTitle value={g.title} className="block text-lg font-semibold" onSave={(v) => v && patch({ title: v })} />
          <div className="text-sm text-slate-500">{goalPeriodLabel(g)}</div>
          {g.correction && (
            <div className="mt-1 text-xs text-emerald-700">
              ✨ Corrected from “{g.correction.original}”{' '}
              <button className="underline" onClick={() => run(api.planner.revertCorrection(g.correction!.id))}>
                Revert
              </button>
            </div>
          )}
        </div>
        <button
          className="text-sm text-red-600 hover:underline"
          onClick={async () => {
            if (!confirm(`Delete goal “${g.title}”? The goal's tasks will be kept.`)) return;
            await run(api.planner.deleteGoal(g.id));
            onDeleted();
          }}
        >
          Delete
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <CategoryPicker area={g.area} value={g.categoryId} onChange={(c) => patch({ categoryId: c })} noneLabel="No category" />
        <div className="flex flex-1 items-center gap-2">
          <ProgressBar value={g.progressTotal ? g.progressDone / g.progressTotal : 0} color={AREA_COLOR[g.area]} />
          <span className="text-xs text-slate-500">
            {g.progressDone}/{g.progressTotal}
          </span>
        </div>
      </div>

      <h3 className="mb-2 mt-5 text-sm font-semibold">Steps</h3>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} />
          Schedule on
        </label>
        {schedule && <input type="date" className="rounded-md border border-slate-300 px-2 py-0.5" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />}
        {!schedule && <span className="text-slate-400">backlog</span>}
      </div>
      <AddTaskBar date={schedule ? day : null} area={g.area} goalId={g.id} fixedCategoryId={g.categoryId} placeholder="Add a step…   #tag   !!!" />
      <div className="mt-3">
        {g.tasks.length ? (
          <TaskListView groups={[{ id: 'steps', title: 'Tasks', tasks: g.tasks }]} showDate pullToday />
        ) : (
          <div className="py-4 text-center text-sm text-slate-400">No steps yet</div>
        )}
      </div>

      <h3 className="mb-2 mt-5 text-sm font-semibold">Notes</h3>
      <MarkdownField key={g.id} value={g.notes ?? ''} onSave={(v) => patch({ notes: v })} placeholder="Why it matters, how you'll measure it…" />
    </div>
  );
}

// ───────────── Notes ─────────────

export function NotesView({ area }: { area: Area }) {
  const { rev, run } = usePlanner();
  const [filter, setFilter] = useState<'all' | 'ideas' | 'daily'>('all');
  const [q, setQ] = useState('');
  const [notes, setNotes] = useState<PNote[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => api.planner.notes(area, filter, q).then(setNotes).catch(() => setNotes([])), 150);
    return () => clearTimeout(t);
  }, [area, filter, q, rev]);
  useEffect(() => setSelected(null), [area]);

  const create = async () => {
    const n = await run(api.planner.addNote({ area }));
    if (n) setSelected(n.id);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <Header
          eyebrow={<AreaBadge area={area} />}
          title="Notes"
          right={
            <button className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700" onClick={create}>
              + Note
            </button>
          }
        />
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'ideas', label: 'Ideas' },
            { value: 'daily', label: 'Daily' },
          ]}
        />
        <input
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
          placeholder="Search notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {notes && !notes.length && <EmptyState icon="📝" text="No notes" />}
        <div className="space-y-1">
          {(notes ?? []).map((n) => (
            <button
              key={n.id}
              onClick={() => setSelected(n.id)}
              className={cx(
                'w-full rounded-lg border px-3 py-2 text-left text-sm transition',
                selected === n.id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:border-slate-300',
              )}
            >
              <div className="flex items-center gap-1.5">
                {n.pinned && <span title="Pinned">📌</span>}
                {n.day && <span title="Day note">📅</span>}
                <span className="flex-1 truncate font-medium">{noteTitle(n)}</span>
              </div>
              <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{(n.body ?? '').replace(/\n/g, ' ').slice(0, 160) || '—'}</div>
              <div className="mt-0.5 text-[11px] text-slate-400">{shortDateTime(n.updatedAt)}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0">
        {selected ? (
          <NoteEditor id={selected} onDeleted={() => setSelected(null)} />
        ) : (
          <div className="hidden lg:block">
            <EmptyState icon="📝" text="Select a note, or create one" />
          </div>
        )}
      </div>
    </div>
  );
}

function noteTitle(n: PNote) {
  if (n.title.trim()) return n.title.trim();
  const first = (n.body ?? '').split('\n').map((l) => l.replace(/^[#>*\-\s]+/, '').trim()).find(Boolean);
  if (first) return first;
  if (n.day) return `Note · ${n.day}`;
  return 'Untitled';
}

function NoteEditor({ id, onDeleted }: { id: number; onDeleted: () => void }) {
  const { rev, run, today, meta, go, openTask } = usePlanner();
  const [n, setN] = useState<PNote | null>(null);
  const [checking, setChecking] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  /** Latest body as typed (the editor saves on its own, without a refetch). */
  const latest = useRef('');
  const busy = useRef(false);

  useEffect(() => {
    api.planner.note(id).then(setN).catch(() => onDeleted());
  }, [id, rev]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setWhy(null), [id]);

  useEffect(() => {
    if (n) latest.current = n.body ?? '';
  }, [n]);

  if (!n || n.id !== id) return <div className="p-6 text-sm text-slate-400">Loading…</div>;
  const patch = (b: Record<string, unknown>) => run(api.planner.updateNote(n.id, b));

  const check = async (text: string) => {
    if (!meta?.englishEnabled || text.trim().length < 3 || busy.current) return;
    busy.current = true;
    setChecking(true);
    try {
      const r = await api.planner.checkEnglish(text, n.id);
      setWhy(r.changed ? r.why || 'Corrected' : 'Looks good ✓');
    } catch (e) {
      setWhy((e as Error).message);
    } finally {
      busy.current = false;
      setChecking(false);
      run(Promise.resolve());
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="text-lg" title={n.pinned ? 'Unpin' : 'Pin'} onClick={() => patch({ pinned: !n.pinned })}>
          {n.pinned ? '📌' : '📍'}
        </button>
        <div className="min-w-0 flex-1">
          <EditableTitle
            value={n.title}
            placeholder={n.day ? `Notes for ${relativeDay(n.day, today)}` : 'Title'}
            className="block text-lg font-semibold"
            onSave={(v) => patch({ title: v })}
          />
          {n.englishPending && <span className="text-xs text-slate-400"><Spinner /> Checking English…</span>}
          {n.correction && (
            <div className="text-xs text-emerald-700">
              ✨ Title corrected from “{n.correction.original}”{' '}
              <button className="underline" onClick={() => run(api.planner.revertCorrection(n.correction!.id))}>
                Revert
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        {n.day ? <span className="text-xs text-slate-500">📅 Day note · {n.day}</span> : <AreaPicker value={n.area} onChange={(a) => patch({ area: a })} />}
        <CategoryPicker area={n.area} value={n.categoryId} onChange={(c) => patch({ categoryId: c })} />
        <span className="ml-auto text-xs text-slate-400">Edited {shortDateTime(n.updatedAt)}</span>
      </div>
      <div className="mt-3">
        <MarkdownField
          key={n.id}
          value={n.body ?? ''}
          minRows={16}
          onSave={(v) => {
            latest.current = v;
            return api.planner.updateNote(n.id, { body: v });
          }}
          onBlurSaved={(v) => check(v)}
          extra={
            meta?.englishEnabled && (
              <button className="rounded px-2 py-0.5 text-indigo-600 hover:bg-indigo-50" disabled={checking} onClick={() => check(latest.current)}>
                {checking ? <Spinner /> : 'Aa'} Check English
              </button>
            )
          }
        />
        {why && <div className="mt-1 text-xs text-slate-500">✨ {why}</div>}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <button
          className="text-indigo-600 hover:underline"
          onClick={async () => {
            const t = await run(api.planner.noteToTask(n.id));
            if (t) {
              go({ kind: 'tasks', area: n.area });
              openTask(t.id);
            }
          }}
        >
          ☀️ Create task for today from this note
        </button>
        {!n.day && (
          <button className="text-slate-600 hover:underline" onClick={() => patch({ area: otherArea(n.area) })}>
            Move to {AREA_LABEL[otherArea(n.area)]}
          </button>
        )}
        <button
          className="ml-auto text-red-600 hover:underline"
          onClick={async () => {
            if (!confirm('Delete this note?')) return;
            await run(api.planner.deleteNote(n.id));
            onDeleted();
          }}
        >
          Delete note
        </button>
      </div>
    </div>
  );
}
