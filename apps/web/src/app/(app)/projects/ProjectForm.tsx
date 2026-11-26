'use client';

import type { Project } from '@pkb/contracts';
import { useState } from 'react';
import { useSaveProject } from '@/features/projects/api';
import { Button, Input, Textarea } from '@/shared/ui/primitives';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#64748B'];

export function ProjectForm({ project, onDone }: { project?: Project; onDone: (p: Project) => void }) {
  const save = useSaveProject();
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [color, setColor] = useState(project?.color ?? COLORS[0]);
  return (
    <form
      className="space-y-3 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate({ id: project?.id, input: { name: name.trim(), description: description || null, color } }, { onSuccess: onDone });
      }}
    >
      <h2 className="text-lg font-semibold">{project ? 'Edit project' : 'New project'}</h2>
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (markdown, optional)" rows={3} />
      <div className="flex gap-2">
        {COLORS.map((c) => (
          <button key={c} type="button" onClick={() => setColor(c)} className={`h-6 w-6 rounded-full ${color === c ? 'ring-2 ring-accent ring-offset-2' : ''}`} style={{ background: c }} />
        ))}
      </div>
      <Button variant="primary" disabled={!name.trim() || save.isPending}>Save</Button>
    </form>
  );
}
