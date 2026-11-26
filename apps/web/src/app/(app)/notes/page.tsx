'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useProjects } from '@/features/projects/api';
import { NoteList } from '@/features/notes/components/NoteList';
import { useTags } from '@/features/notes/queries';
import { Button, Select, Tag } from '@/shared/ui/primitives';

export default function NotesPage() {
  const projects = useProjects();
  const tags = useTags();
  const [projectId, setProjectId] = useState('');
  const [tag, setTag] = useState('');
  const query = projectId === '__none' ? { unfiled: true, tag: tag || undefined } : { projectId: projectId || undefined, tag: tag || undefined };
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Knowledge base</h1>
        <Link href="/notes/new"><Button variant="primary">+ New note</Button></Link>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">All notes</option>
          <option value="__none">General (no project)</option>
          {projects.data?.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
        <div className="flex flex-wrap gap-1.5">
          {tags.data?.map((t) => (
            <span key={t.name} className="flex items-center">
              <Tag name={`${t.name} ${t.count}`} active={tag === t.name} onClick={() => setTag(tag === t.name ? '' : t.name)} />
            </span>
          ))}
        </div>
      </div>
      <NoteList query={query} onTag={(t) => setTag(t)} />
    </div>
  );
}
