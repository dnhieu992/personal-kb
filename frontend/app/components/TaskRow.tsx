'use client';

import { useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import {
  api,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  isoDate,
  Knowledge,
  KIND_COLORS,
  KIND_LABELS,
  EnglishKind,
  PRIORITY_COLORS,
  shiftDate,
  Task,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TaskCategory,
  TaskList,
  TaskPriority,
} from '../lib/api';

interface Props {
  task: Task;
  lists?: TaskList[];
  /** Shown on the backlog and list views, where tasks span many days. */
  showPlanDate?: boolean;
  /** Called after any write, so the parent can refetch. */
  onChanged: () => void;
}

/**
 * One task: tick it off, move it, edit it. The English the AI corrected (and
 * the mistakes it collected) hang off the expanded view rather than the row,
 * so a day's plan still reads as a list.
 */
export default function TaskRow({
  task,
  lists,
  showPlanDate = false,
  onChanged,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [cards, setCards] = useState<Knowledge[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = task.status === 'DONE';
  // While the AI pass is still queued the "original" is the same text the row
  // already shows, so there is nothing to compare against yet.
  const typed = [task.originalTitle, task.originalNotes]
    .filter((t, i) => t && t !== [task.title, task.notes][i])
    .join('\n\n');

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function toggleDone() {
    return run(() => api.tasks.setStatus(task.id, done ? 'TODO' : 'DONE'));
  }

  function toggleProgress() {
    return run(() =>
      api.tasks.setStatus(
        task.id,
        task.status === 'IN_PROGRESS' ? 'TODO' : 'IN_PROGRESS',
      ),
    );
  }

  async function onExpand() {
    const next = !expanded;
    setExpanded(next);
    if (next && cards === null && task.collectedCount > 0) {
      try {
        setCards(await api.tasks.collected(task.id));
      } catch {
        setCards([]); // non-fatal: the panel just stays empty
      }
    }
  }

  function onDelete() {
    if (!confirm('Delete this task? Its English review cards go with it.')) return;
    return run(() => api.tasks.remove(task.id));
  }

  if (editing) {
    return (
      <TaskEditor
        task={task}
        lists={lists}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  return (
    <div
      className={`rounded-lg border bg-white px-3 py-2 ${
        task.status === 'IN_PROGRESS' ? 'border-indigo-300 bg-indigo-50/40' : ''
      }`}
    >
      <div className="flex items-start gap-2.5">
        <button
          onClick={toggleDone}
          disabled={busy}
          aria-label={done ? 'Reopen task' : 'Mark as done'}
          className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${
            done
              ? 'border-emerald-600 bg-emerald-600 text-white'
              : 'border-slate-300 hover:border-indigo-500'
          }`}
        >
          {done && <span className="block text-[10px] leading-4">✓</span>}
        </button>

        <div className="min-w-0 flex-1">
          <button
            onClick={onExpand}
            className={`block w-full truncate text-left text-sm ${
              done ? 'text-slate-400 line-through' : 'text-slate-800'
            }`}
          >
            {task.title}
          </button>

          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span
              className={`rounded-full px-1.5 py-0.5 font-medium ${
                CATEGORY_COLORS[task.category]
              }`}
            >
              {CATEGORY_LABELS[task.category]}
            </span>
            {task.priority !== 'MEDIUM' && (
              <span
                className={`rounded-full px-1.5 py-0.5 font-medium ${
                  PRIORITY_COLORS[task.priority]
                }`}
              >
                {task.priority}
              </span>
            )}
            {task.status === 'IN_PROGRESS' && (
              <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 font-medium text-indigo-700">
                In progress
              </span>
            )}
            {showPlanDate && task.planDate && (
              <span className="text-slate-400">📅 {task.planDate}</span>
            )}
            {task.dueDate && (
              <span
                className={
                  !done && task.dueDate < isoDate()
                    ? 'font-medium text-red-600'
                    : 'text-slate-400'
                }
              >
                due {task.dueDate}
              </span>
            )}
            {task.coachStatus === 'PENDING' && (
              <span className="text-indigo-500" title="The AI is correcting the English">
                ✨ polishing…
              </span>
            )}
            {task.coachStatus === 'FAILED' && (
              <span className="text-amber-600" title="Kept exactly as you typed it">
                ⚠ not corrected
              </span>
            )}
            {task.collectedCount > 0 && (
              <span className="text-amber-600" title="English notes collected from this task">
                📝 {task.collectedCount}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={toggleProgress}
          disabled={busy || done}
          title={task.status === 'IN_PROGRESS' ? 'Pause' : 'Start working on this'}
          className="shrink-0 rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
        >
          {task.status === 'IN_PROGRESS' ? '❚❚' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-3 border-t pt-2 text-sm">
          {task.notes && (
            <div className="prose-kb text-slate-700">
              <ReactMarkdown>{task.notes}</ReactMarkdown>
            </div>
          )}

          {typed && (
            <details className="rounded-md bg-slate-50 p-2">
              <summary className="cursor-pointer text-xs font-medium text-slate-500">
                What you typed, before the AI corrected it
              </summary>
              <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-slate-600">
                {typed}
              </pre>
            </details>
          )}

          {cards && cards.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">
                Collected for review —{' '}
                <Link href="/english/review" className="text-indigo-600 underline">
                  study them
                </Link>
              </p>
              <ul className="space-y-1">
                {cards.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-xs">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 font-medium ${
                        KIND_COLORS[c.englishKind as EnglishKind]
                      }`}
                    >
                      {KIND_LABELS[c.englishKind as EnglishKind]}
                    </span>
                    <span>
                      <span className="font-medium">{c.content}</span>
                      {c.summary && (
                        <span className="text-slate-500"> — {c.summary}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-3 text-xs">
            <button
              onClick={() => setEditing(true)}
              className="text-indigo-600 hover:underline"
            >
              Edit
            </button>
            {task.planDate !== isoDate() && (
              <button
                onClick={() => run(() => api.tasks.reschedule(task.id, isoDate()))}
                className="text-slate-600 hover:underline"
              >
                Move to today
              </button>
            )}
            <button
              onClick={() =>
                run(() =>
                  api.tasks.reschedule(
                    task.id,
                    shiftDate(task.planDate ?? isoDate(), 1),
                  ),
                )
              }
              className="text-slate-600 hover:underline"
            >
              Tomorrow
            </button>
            {task.planDate && (
              <button
                onClick={() => run(() => api.tasks.reschedule(task.id, null))}
                className="text-slate-600 hover:underline"
              >
                To backlog
              </button>
            )}
            <button onClick={onDelete} className="text-red-600 hover:underline">
              Delete
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** Full edit form, shown in place of the row. */
function TaskEditor({
  task,
  lists,
  onClose,
  onSaved,
}: {
  task: Task;
  lists?: TaskList[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // Edit the text the author owns: their own wording where the AI rewrote it,
  // otherwise the stored (already correct) English.
  const [title, setTitle] = useState(task.originalTitle ?? task.title);
  const [notes, setNotes] = useState(task.originalNotes ?? task.notes ?? '');
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [category, setCategory] = useState<TaskCategory>(task.category);
  const [planDate, setPlanDate] = useState(task.planDate ?? '');
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [listId, setListId] = useState(task.listId ?? '');
  const [autoCoach, setAutoCoach] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.tasks.update(task.id, {
        title: title.trim(),
        notes: notes.trim() || null,
        priority,
        category,
        planDate: planDate || null,
        dueDate: dueDate || null,
        listId: listId || null,
        autoCoach,
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-2 rounded-lg border border-indigo-300 bg-white p-3"
    >
      <input
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="Notes (Markdown)"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as TaskCategory)}
          className="rounded-md border border-slate-300 px-2 py-1"
        >
          {TASK_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          className="rounded-md border border-slate-300 px-2 py-1"
        >
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-slate-600">
          Plan
          <input
            type="date"
            value={planDate}
            onChange={(e) => setPlanDate(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-1 text-slate-600">
          Due
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1"
          />
        </label>
        {lists && lists.length > 0 && (
          <select
            value={listId}
            onChange={(e) => setListId(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1"
          >
            <option value="">No list</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <label className="flex items-center gap-1.5 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={autoCoach}
          onChange={(e) => setAutoCoach(e.target.checked)}
        />
        ✨ Re-run the English check when the text changed
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
