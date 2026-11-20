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
      className={`card px-3 py-2 ${
        task.status === 'IN_PROGRESS' ? 'border-accent/40 bg-accent-soft/40' : ''
      }`}
    >
      <div className="flex items-start gap-2.5">
        <button
          onClick={toggleDone}
          disabled={busy}
          aria-label={done ? 'Reopen task' : 'Mark as done'}
          className={`mt-0.5 h-4 w-4 shrink-0 rounded border ${
            done
              ? 'border-success bg-success text-white'
              : 'border-line-strong hover:border-accent'
          }`}
        >
          {done && <span className="block text-[10px] leading-4">✓</span>}
        </button>

        <div className="min-w-0 flex-1">
          <button
            onClick={onExpand}
            className={`block w-full truncate text-left text-sm ${
              done ? 'text-fg-subtle line-through' : 'text-fg'
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
              <span className="rounded-full bg-accent-soft px-1.5 py-0.5 font-medium text-accent-text">
                In progress
              </span>
            )}
            {showPlanDate && task.planDate && (
              <span className="text-fg-subtle">📅 {task.planDate}</span>
            )}
            {task.dueDate && (
              <span
                className={
                  !done && task.dueDate < isoDate()
                    ? 'font-medium text-danger-text'
                    : 'text-fg-subtle'
                }
              >
                due {task.dueDate}
              </span>
            )}
            {task.coachStatus === 'PENDING' && (
              <span className="text-accent-text" title="The AI is correcting the English">
                ✨ polishing…
              </span>
            )}
            {task.coachStatus === 'FAILED' && (
              <span className="text-warning-text" title="Kept exactly as you typed it">
                ⚠ not corrected
              </span>
            )}
            {task.collectedCount > 0 && (
              <span className="text-warning-text" title="English notes collected from this task">
                📝 {task.collectedCount}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={toggleProgress}
          disabled={busy || done}
          title={task.status === 'IN_PROGRESS' ? 'Pause' : 'Start working on this'}
          className="shrink-0 rounded px-1.5 py-0.5 text-xs text-fg-subtle hover:bg-muted hover:text-fg-secondary disabled:opacity-30"
        >
          {task.status === 'IN_PROGRESS' ? '❚❚' : '▶'}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-3 border-t pt-2 text-sm">
          {task.notes && (
            <div className="prose-kb text-fg-secondary">
              <ReactMarkdown>{task.notes}</ReactMarkdown>
            </div>
          )}

          {typed && (
            <details className="rounded-md bg-subtle p-2">
              <summary className="cursor-pointer text-xs font-medium text-fg-muted">
                What you typed, before the AI corrected it
              </summary>
              <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-fg-secondary">
                {typed}
              </pre>
            </details>
          )}

          {cards && cards.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-fg-muted">
                Collected for review —{' '}
                <Link href="/english/review" className="text-accent-text underline">
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
                        <span className="text-fg-muted"> — {c.summary}</span>
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
              className="link"
            >
              Edit
            </button>
            {task.planDate !== isoDate() && (
              <button
                onClick={() => run(() => api.tasks.reschedule(task.id, isoDate()))}
                className="text-fg-secondary hover:underline"
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
              className="text-fg-secondary hover:underline"
            >
              Tomorrow
            </button>
            {task.planDate && (
              <button
                onClick={() => run(() => api.tasks.reschedule(task.id, null))}
                className="text-fg-secondary hover:underline"
              >
                To backlog
              </button>
            )}
            <button onClick={onDelete} className="text-danger-text hover:underline">
              Delete
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-danger-text">{error}</p>}
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
      className="space-y-2 rounded-lg border border-accent/40 bg-surface p-3"
    >
      <input
        required
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full input input-sm"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="Notes (Markdown)"
        className="w-full input"
      />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as TaskCategory)}
          className="input input-sm"
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
          className="input input-sm"
        >
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-fg-secondary">
          Plan
          <input
            type="date"
            value={planDate}
            onChange={(e) => setPlanDate(e.target.value)}
            className="input input-sm"
          />
        </label>
        <label className="flex items-center gap-1 text-fg-secondary">
          Due
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="input input-sm"
          />
        </label>
        {lists && lists.length > 0 && (
          <select
            value={listId}
            onChange={(e) => setListId(e.target.value)}
            className="input input-sm"
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
      <label className="flex items-center gap-1.5 text-xs text-fg-secondary">
        <input
          type="checkbox"
          checked={autoCoach}
          onChange={(e) => setAutoCoach(e.target.checked)}
        />
        ✨ Re-run the English check when the text changed
      </label>

      {error && <p className="text-sm text-danger-text">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="btn btn-primary btn-sm"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-secondary btn-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
