'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  api,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  TASK_CATEGORIES,
  TaskCategory,
  TaskList,
} from '../../lib/api';

export default function TaskListsPage() {
  const [lists, setLists] = useState<TaskList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TaskCategory>('COMPANY');
  const [targetDate, setTargetDate] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setLists(await api.taskLists.list());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.taskLists.create({
        name: name.trim(),
        description: description.trim() || null,
        category,
        targetDate: targetDate || null,
      });
      setName('');
      setDescription('');
      setTargetDate('');
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this list? Its tasks are kept, just no longer filed here.'))
      return;
    await api.taskLists.remove(id);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Long-term lists</h1>
          <p className="text-sm text-slate-500">
            Goals that outlive a single day. Pull tasks into a day when you plan it.
          </p>
        </div>
        <Link
          href="/plan"
          className="rounded-md border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
        >
          Daily plan
        </Link>
      </div>

      <form onSubmit={onCreate} className="space-y-2 rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New list — e.g. Ship the billing revamp"
            className="min-w-[14rem] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
          />
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
          <label className="flex items-center gap-1 text-sm text-slate-600">
            Target
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5"
            />
          </label>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does finishing this look like? (optional)"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : lists.length === 0 ? (
        <p className="text-sm text-slate-500">
          No lists yet. Create one above to park the work that spans weeks.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {lists.map((l) => {
            const total = l.taskCount ?? 0;
            const done = l.doneCount ?? 0;
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <div key={l.id} className="rounded-lg border bg-white p-4 hover:shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/plan/lists/${l.id}`}
                    className="font-medium text-indigo-700 hover:underline"
                  >
                    {l.name}
                  </Link>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      CATEGORY_COLORS[l.category]
                    }`}
                  >
                    {CATEGORY_LABELS[l.category]}
                  </span>
                </div>
                {l.description && (
                  <p className="mt-1 text-sm text-slate-500">{l.description}</p>
                )}
                <div className="mt-3 h-1.5 overflow-hidden rounded bg-slate-100">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {done}/{total} done
                  </span>
                  {l.targetDate && <span>target {l.targetDate}</span>}
                </div>
                <div className="mt-3 flex gap-3 border-t pt-3 text-sm">
                  <Link
                    href={`/plan/lists/${l.id}`}
                    className="text-indigo-600 hover:underline"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() => onDelete(l.id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
