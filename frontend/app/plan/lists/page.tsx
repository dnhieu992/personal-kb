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
import { Icon } from '../../components/icons';
import { Alert, EmptyState, Loading, PageHeader, ProgressBar } from '../../components/ui';

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
      <PageHeader
        title="Long-term lists"
        description="Goals that outlive a single day. Pull tasks into a day when you plan it."
        actions={
          <Link href="/plan" className="btn btn-secondary">
            <Icon name="calendar" /> Daily plan
          </Link>
        }
      />

      <form onSubmit={onCreate} className="space-y-2 card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New list — e.g. Ship the billing revamp"
            className="min-w-[14rem] flex-1 input input-sm"
          />
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
          <label className="flex items-center gap-1.5 text-[13px] text-fg-muted">
            Target
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="input input-sm"
            />
          </label>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="btn btn-primary btn-sm"
          >
            {saving ? 'Creating…' : 'Create'}
          </button>
        </div>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does finishing this look like? (optional)"
          className="w-full input input-sm"
        />
      </form>

      {error && <Alert>{error}</Alert>}

      {loading ? (
        <Loading />
      ) : lists.length === 0 ? (
        <EmptyState icon="list" title="No lists yet" description="Create one above to park the work that spans weeks." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {lists.map((l) => {
            const total = l.taskCount ?? 0;
            const done = l.doneCount ?? 0;
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <article key={l.id} className="card card-interactive group relative p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/plan/lists/${l.id}`} className="font-medium text-fg after:absolute after:inset-0">
                    {l.name}
                  </Link>
                  <span className={`chip shrink-0 ${CATEGORY_COLORS[l.category]}`}>{CATEGORY_LABELS[l.category]}</span>
                </div>
                {l.description && <p className="mt-1 line-clamp-2 text-[13px] text-fg-muted">{l.description}</p>}
                <ProgressBar value={pct / 100} tone="success" className="mt-4" />
                <div className="mt-2 flex items-center gap-2 text-xs text-fg-muted">
                  <span className="tabular-nums">
                    {done}/{total} done
                  </span>
                  {l.targetDate && (
                    <span className="inline-flex items-center gap-1">
                      <Icon name="target" className="h-3 w-3" /> {l.targetDate}
                    </span>
                  )}
                  <button
                    onClick={() => onDelete(l.id)}
                    className="btn btn-danger-ghost btn-icon btn-xs relative z-10 ml-auto transition focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                    title="Delete list"
                  >
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
