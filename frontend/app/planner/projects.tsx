'use client';

import { useState } from 'react';
import { api } from '../lib/api';
import { PProject, PROJECT_STATUS, ProjectStatus, dayMonth } from '../lib/planner';
import { Modal, cx } from './ui';

export function StatusChip({ status }: { status: ProjectStatus }) {
  const s = PROJECT_STATUS[status];
  return <span className={cx('chip whitespace-nowrap', s.tone)}>{s.label}</span>;
}

export const pct = (p: Pick<PProject, 'done' | 'total'>) => (p.total ? Math.round((p.done / p.total) * 100) : 0);

/** "3 days ago" style label for the last activity timestamp. */
export function ago(iso: string | null) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 30) return `${d} days ago`;
  return new Date(iso).toLocaleDateString();
}

/** Tasks finished per week over the last 8 weeks — one series, so no legend; hover a bar for its value. */
export function WeeklyBars({ weekly, height = 28 }: { weekly: PProject['weekly']; height?: number }) {
  const max = Math.max(1, ...weekly.map((w) => w.done));
  return (
    <div className="flex items-end gap-[2px]" style={{ height }} role="img" aria-label={`Done per week: ${weekly.map((w) => w.done).join(', ')}`}>
      {weekly.map((w) => (
        <div key={w.week} className="group relative flex h-full w-2.5 items-end" title={`Week of ${dayMonth(w.week)}: ${w.done} done`}>
          <div
            className={cx('w-full rounded-t-[3px]', w.done ? 'bg-accent' : 'bg-emphasis')}
            style={{ height: w.done ? `${Math.max(12, (w.done / max) * 100)}%` : 2 }}
          />
        </div>
      ))}
    </div>
  );
}

/** Create / edit a project: name + description. */
export function ProjectModal({
  edit,
  onClose,
  onSaved,
}: {
  edit?: PProject;
  onClose: () => void;
  onSaved: (p: PProject) => void;
}) {
  const [name, setName] = useState(edit?.name ?? '');
  const [description, setDescription] = useState(edit?.description ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const body = { name: name.trim(), description: description.trim() || null };
      const p = edit ? await api.planner.updateProject(edit.id, body) : await api.planner.addProject(body);
      onSaved(p);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal title={edit ? 'Edit project' : 'New project'} onClose={onClose}>
      <div className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-fg-muted">Name</span>
          <input
            autoFocus
            className="input w-full"
            placeholder="e.g. Technical interview prep"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-fg-muted">Description</span>
          <textarea
            className="input min-h-[96px] w-full py-2"
            placeholder="What is this project for? What does done look like?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-danger-text">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!name.trim() || busy} onClick={save}>
            {edit ? 'Save' : 'Create project'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
