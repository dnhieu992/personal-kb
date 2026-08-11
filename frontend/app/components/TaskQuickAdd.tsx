'use client';

import { useState } from 'react';
import {
  api,
  CATEGORY_LABELS,
  Task,
  TASK_CATEGORIES,
  TASK_PRIORITIES,
  TaskCategory,
  TaskList,
  TaskPriority,
} from '../lib/api';

interface Props {
  /** Pre-filled fields for the context this add box sits in. */
  defaults?: {
    planDate?: string | null;
    category?: TaskCategory;
    listId?: string | null;
  };
  /** Offered in the "more" panel so a task can be filed under a long-term list. */
  lists?: TaskList[];
  /** Hidden when the box already belongs to one category column. */
  showCategory?: boolean;
  placeholder?: string;
  onCreated: (task: Task) => void;
}

/**
 * One-line task entry. The save returns immediately — the AI corrects the
 * English in the background — so ten tasks can go in without ten waits.
 */
export default function TaskQuickAdd({
  defaults,
  lists,
  showCategory = false,
  placeholder = 'What needs doing?',
  onCreated,
}: Props) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [category, setCategory] = useState<TaskCategory>(
    defaults?.category ?? 'COMPANY',
  );
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [listId, setListId] = useState(defaults?.listId ?? '');
  const [autoCoach, setAutoCoach] = useState(true);
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const task = await api.tasks.create({
        title: title.trim(),
        notes: notes.trim() || null,
        category,
        priority,
        planDate: defaults?.planDate ?? null,
        dueDate: dueDate || null,
        listId: listId || null,
        autoCoach,
      });
      // Keep the row's settings for the next task — only the text resets.
      setTitle('');
      setNotes('');
      onCreated(task);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={placeholder}
          className="min-w-[12rem] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
        />
        {showCategory && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TaskCategory)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {TASK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        )}
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add'}
        </button>
        <button
          type="button"
          onClick={() => setMore((m) => !m)}
          className="text-xs text-slate-500 hover:text-slate-800"
        >
          {more ? 'Less' : 'More…'}
        </button>
      </div>

      {more && (
        <div className="mt-3 space-y-2 border-t pt-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes (Markdown) — write in English, the AI will correct it"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <div className="flex flex-wrap items-center gap-3 text-sm">
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
              <label className="flex items-center gap-1 text-slate-600">
                List
                <select
                  value={listId}
                  onChange={(e) => setListId(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1"
                >
                  <option value="">None</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex items-center gap-1.5 text-slate-600">
              <input
                type="checkbox"
                checked={autoCoach}
                onChange={(e) => setAutoCoach(e.target.checked)}
              />
              ✨ Fix my English &amp; collect mistakes
            </label>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}
