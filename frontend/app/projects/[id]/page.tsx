'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Knowledge, Project } from '../../lib/api';
import KnowledgeCard from '../../components/KnowledgeCard';
import { Icon } from '../../components/icons';
import { Alert, EmptyState, Loading, PageHeader } from '../../components/ui';

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, entries] = await Promise.all([api.projects.get(id), api.list({ projectId: id })]);
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

  if (loading) return <Loading />;
  if (error || !project) {
    return (
      <>
        <PageHeader title="Project not found" back={{ href: '/projects', label: 'Projects' }} />
        <Alert>{error}</Alert>
      </>
    );
  }

  const add = (
    <Link href={`/knowledge/new?projectId=${project.id}`} className="btn btn-primary">
      <Icon name="plus" /> Add entry
    </Link>
  );

  return (
    <>
      <PageHeader
        back={{ href: '/projects', label: 'Projects' }}
        title={project.name}
        description={
          <>
            {project.description && <span className="block">{project.description}</span>}
            <span className="text-fg-subtle">{items.length} entries</span>
          </>
        }
        actions={add}
      />
      {items.length === 0 ? (
        <EmptyState icon="folder" title="No entries in this project yet" action={add} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((k) => (
            <KnowledgeCard key={k.id} k={k} onDelete={onDelete} />
          ))}
        </div>
      )}
    </>
  );
}
