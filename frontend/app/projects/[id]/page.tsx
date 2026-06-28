'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Knowledge, Project, TYPE_COLORS } from '../../lib/api';

export default function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, entries] = await Promise.all([
        api.projects.get(id),
        api.list({ projectId: id }),
      ]);
      setProject(p);
      setItems(entries);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function onDelete(entryId: string) {
    if (!confirm('Delete this entry?')) return;
    await api.remove(entryId);
    load();
  }

  if (loading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (error || !project) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-semibold">Project not found.</p>
        {error && <p className="mt-1 text-sm">{error}</p>}
        <Link href="/projects" className="mt-2 inline-block text-sm underline">
          ← Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/projects" className="text-sm text-slate-500 hover:underline">
          ← Projects
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="mt-1 text-slate-500">{project.description}</p>
          )}
          <p className="mt-1 text-sm text-slate-400">{items.length} entries</p>
        </div>
        <Link
          href={`/knowledge/new?projectId=${project.id}`}
          className="shrink-0 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Add entry
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">
          No entries in this project yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((k) => (
            <div
              key={k.id}
              className="flex flex-col rounded-lg border bg-white p-4 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{k.title}</h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[k.type]}`}
                >
                  {k.type}
                </span>
              </div>
              {k.summary && (
                <p className="mt-1 text-sm text-slate-500">{k.summary}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1">
                {(k.tags ?? []).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="mt-3 flex gap-3 border-t pt-3 text-sm">
                <Link
                  href={`/knowledge/${k.id}/edit`}
                  className="text-indigo-600 hover:underline"
                >
                  Edit
                </Link>
                <button
                  onClick={() => onDelete(k.id)}
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
