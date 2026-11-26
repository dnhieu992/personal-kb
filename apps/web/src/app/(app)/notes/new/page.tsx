'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { NoteEditor } from '@/features/notes/components/NoteEditor';
import { useTask } from '@/features/tasks/queries';
import { Spinner } from '@/shared/ui/primitives';

function NewNote() {
  const params = useSearchParams();
  const taskId = params.get('taskId') ?? undefined;
  const projectId = params.get('projectId') ?? undefined;
  const task = useTask(taskId ?? null);
  if (taskId && task.isLoading) return <Spinner />;
  return <NoteEditor defaults={{ taskId, projectId, taskTitle: task.data?.title }} />;
}

export default function NewNotePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewNote />
    </Suspense>
  );
}
