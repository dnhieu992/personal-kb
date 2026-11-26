'use client';

import { NoteEditor } from '@/features/notes/components/NoteEditor';
import { useNote } from '@/features/notes/queries';
import { Empty, Spinner } from '@/shared/ui/primitives';

export default function NotePage({ params }: { params: { id: string } }) {
  const q = useNote(params.id);
  if (q.isLoading) return <Spinner />;
  if (!q.data) return <Empty>Note not found.</Empty>;
  // key: remount the editor when navigating between notes
  return <NoteEditor key={q.data.id} note={q.data} />;
}
