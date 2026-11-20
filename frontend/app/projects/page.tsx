'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Project } from '../lib/api';
import { Icon } from '../components/icons';
import { Alert, EmptyState, Loading, PageHeader } from '../components/ui';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProjects(await api.projects.list());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onDelete(id: string) {
    if (
      !confirm(
        'Delete this project? Its entries are kept but will no longer be filed under it.',
      )
    )
      return;
    await api.projects.remove(id);
    load();
  }

  const add = (
    <Link href="/projects/new" className="btn btn-primary">
      <Icon name="plus" /> New project
    </Link>
  );

  return (
    <>
      <PageHeader title="Projects" description="Group related entries so they're easy to find together." actions={add} />
      {loading ? (
        <Loading />
      ) : error ? (
        <Alert>{error}</Alert>
      ) : projects.length === 0 ? (
        <EmptyState icon="folder" title="No projects yet" description="Create one to start organizing your knowledge." action={add} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <article key={p.id} className="card card-interactive group relative flex flex-col p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
                  <Icon name="folder" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/projects/${p.id}`} className="block truncate font-medium text-fg after:absolute after:inset-0">
                    {p.name}
                  </Link>
                  <p className="text-xs text-fg-subtle">{p.knowledgeCount ?? 0} entries</p>
                </div>
                <button
                  onClick={() => onDelete(p.id)}
                  className="btn btn-danger-ghost btn-icon btn-xs relative z-10 transition focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  title="Delete project"
                >
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              </div>
              {p.description && <p className="mt-3 line-clamp-2 text-[13px] text-fg-muted">{p.description}</p>}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
