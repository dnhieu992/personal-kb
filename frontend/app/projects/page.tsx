'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Project } from '../lib/api';

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Link
          href="/projects/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + New project
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-slate-500">
          No projects yet. Create one to start organizing your knowledge.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex flex-col rounded-lg border bg-white p-4 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/projects/${p.id}`}
                  className="font-medium text-indigo-700 hover:underline"
                >
                  {p.name}
                </Link>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {p.knowledgeCount ?? 0} entries
                </span>
              </div>
              {p.description && (
                <p className="mt-1 text-sm text-slate-500">{p.description}</p>
              )}
              <div className="mt-3 flex gap-3 border-t pt-3 text-sm">
                <Link
                  href={`/projects/${p.id}`}
                  className="text-indigo-600 hover:underline"
                >
                  Open
                </Link>
                <button
                  onClick={() => onDelete(p.id)}
                  className="text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
