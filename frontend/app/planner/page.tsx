'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { PProject } from '../lib/planner';
import { Icon } from '../components/icons';
import { Alert, EmptyState, Loading, PageHeader, ProgressBar } from '../components/ui';
import { ProjectModal, StatusChip, ago, pct } from './projects';

/** Projects list: one card per project; a card opens the project's board. */
export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<PProject[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api.planner
      .projects()
      .then(setProjects)
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  const add = (
    <button className="btn btn-primary" onClick={() => setCreating(true)}>
      <Icon name="plus" /> New project
    </button>
  );

  return (
    <>
      <PageHeader title="Projects" description="Everything you're working on. Open a project to see its board." actions={add} />
      {error ? (
        <Alert>{error}</Alert>
      ) : !projects ? (
        <Loading />
      ) : projects.length === 0 ? (
        <EmptyState icon="folder" title="No projects yet" description="Create one, then add its tasks on the board." action={add} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/planner/${p.id}`} className="card card-interactive flex flex-col p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
                  <Icon name="folder" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-fg">{p.name}</p>
                  <p className="text-xs text-fg-subtle">Active {ago(p.lastActivity)}</p>
                </div>
                <StatusChip status={p.status} />
              </div>
              {p.description && <p className="mt-3 line-clamp-2 text-[13px] text-fg-muted">{p.description}</p>}
              <div className="mt-auto pt-4">
                <div className="mb-1.5 flex items-baseline justify-between text-xs">
                  <span className="text-fg-muted">
                    {p.done}/{p.total} done
                  </span>
                  <span className="font-medium tabular-nums text-fg">{pct(p)}%</span>
                </div>
                <ProgressBar value={p.total ? p.done / p.total : 0} tone={p.status === 'done' ? 'success' : 'accent'} />
                <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-fg-muted">
                  <span>{p.doing} in progress</span>
                  <span>{p.todo} to do</span>
                  {p.overdue > 0 && <span className="text-danger-text">{p.overdue} overdue</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {creating && (
        <ProjectModal onClose={() => setCreating(false)} onSaved={(p) => router.push(`/planner/${p.id}`)} />
      )}
    </>
  );
}
