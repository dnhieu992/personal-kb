'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { PProject } from '../../lib/planner';
import { Icon } from '../../components/icons';
import { Alert, Loading, PageHeader, ProgressBar } from '../../components/ui';
import { Inspector } from '../inspector';
import { ProjectModal, StatusChip, pct } from '../projects';
import { PlannerProvider, usePlanner } from '../state';
import { ProjectTasks } from '../views-tasks';

/** One project: header with progress, then its Kanban board / task list. */
export default function ProjectPage() {
  return (
    <PlannerProvider>
      <ProjectView />
    </PlannerProvider>
  );
}

function ProjectView() {
  const params = useParams<{ id: string }>();
  const id = Number(params?.id);
  const router = useRouter();
  const { rev, selectedTaskId, openTask, error, clearError } = usePlanner();
  const [p, setP] = useState<PProject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.planner
      .project(id)
      .then(setP)
      .catch((e) => setLoadError((e as Error).message));
  }, [id, rev]);

  // Escape closes the task dialog.
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && openTask(null);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [openTask]);

  if (loadError) return <Alert>{loadError}</Alert>;
  if (!p) return <Loading />;

  const remove = async () => {
    if (!confirm(`Delete project “${p.name}” and all ${p.total} of its tasks? This can't be undone.`)) return;
    await api.planner.deleteProject(p.id);
    router.push('/planner');
  };

  return (
    <>
      <PageHeader
        back={{ href: '/planner', label: 'Projects' }}
        title={
          <span className="flex flex-wrap items-center gap-2.5">
            {p.name} <StatusChip status={p.status} />
          </span>
        }
        description={p.description ?? undefined}
        actions={
          <>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
              <Icon name="pen" className="h-3.5 w-3.5" /> Edit
            </button>
            <button className="btn btn-danger-ghost btn-icon btn-sm" title="Delete project" onClick={remove}>
              <Icon name="trash" className="h-3.5 w-3.5" />
            </button>
          </>
        }
      />
      <div className="-mt-4 mb-6 max-w-xl">
        <div className="mb-1.5 flex flex-wrap items-baseline gap-x-3 text-xs text-fg-muted">
          <span className="font-medium tabular-nums text-fg">{pct(p)}%</span>
          <span>
            {p.done}/{p.total} done
          </span>
          <span>{p.doing} in progress</span>
          <span>{p.todo} to do</span>
          {p.overdue > 0 && <span className="text-danger-text">{p.overdue} overdue</span>}
        </div>
        <ProgressBar value={p.total ? p.done / p.total : 0} tone={p.status === 'done' ? 'success' : 'accent'} />
      </div>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger-text">
          {error}
          <button className="ml-auto" onClick={clearError}>
            ×
          </button>
        </div>
      )}

      <ProjectTasks projectId={p.id} />

      {selectedTaskId && (
        // Task details open in a dialog over the board (click outside or Esc closes it).
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-2 pt-[6vh] sm:p-4 sm:pt-[8vh]" onMouseDown={() => openTask(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Task details"
            className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Inspector />
          </div>
        </div>
      )}
      {editing && (
        <ProjectModal
          edit={p}
          onClose={() => setEditing(false)}
          onSaved={(np) => {
            setP(np);
            setEditing(false);
          }}
        />
      )}
    </>
  );
}
