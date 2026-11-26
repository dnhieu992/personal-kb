'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useProjectCards } from '@/features/projects/api';
import { Dialog } from '@/shared/ui/dialog';
import { Button, Empty, ProjectDot, Spinner } from '@/shared/ui/primitives';
import { ProjectForm } from './ProjectForm';

export default function ProjectsPage() {
  const q = useProjectCards();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const items = (q.data ?? []).filter((p) => showArchived || !p.archivedAt);
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-fg-secondary">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-[rgb(var(--accent))]" /> Show archived
          </label>
          <Button variant="primary" onClick={() => setCreating(true)}>+ New project</Button>
        </div>
      </header>
      {q.isLoading ? (
        <Spinner />
      ) : !items.length ? (
        <Empty>No projects yet.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => {
            const total = p.openTasks + p.doneTasks;
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="rounded-xl border border-line bg-surface p-4 hover:border-line-strong">
                <div className="flex items-center gap-2">
                  <ProjectDot color={p.color} />
                  <h2 className="truncate font-medium">{p.name}</h2>
                  {p.archivedAt && <span className="ml-auto text-xs text-fg-subtle">archived</span>}
                </div>
                {p.description && <p className="mt-1 line-clamp-2 text-sm text-fg-muted">{p.description}</p>}
                <div className="mt-4 h-1.5 overflow-hidden rounded bg-muted">
                  <div className="h-full bg-accent-hover" style={{ width: total ? `${(p.doneTasks / total) * 100}%` : 0 }} />
                </div>
                <div className="mt-2 flex gap-4 text-xs text-fg-muted">
                  <span>{p.openTasks} open</span>
                  <span>{p.doneTasks} done</span>
                  <span>{p.notes} notes</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <Dialog open={creating} onClose={() => setCreating(false)}>
        <ProjectForm onDone={(p) => router.push(`/projects/${p.id}`)} />
      </Dialog>
    </div>
  );
}
