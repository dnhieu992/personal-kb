'use client';

import type { CreateNoteInput, NoteListQuery, UpdateNoteInput } from '@pkb/contracts';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { projectKeys } from '../projects/api';
import { notesApi } from './api';

export const noteKeys = {
  all: ['notes'] as const,
  list: (q: Partial<NoteListQuery>) => ['notes', 'list', q] as const,
  one: (id: string) => ['notes', 'one', id] as const,
  tags: () => ['notes', 'tags'] as const,
};

export const useNotes = (q: Partial<NoteListQuery>) =>
  useInfiniteQuery({
    queryKey: noteKeys.list(q),
    queryFn: ({ pageParam }) => notesApi.list({ ...q, cursor: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
export const useNote = (id: string | null) => useQuery({ queryKey: noteKeys.one(id ?? ''), queryFn: () => notesApi.get(id!), enabled: !!id });
export const useTags = () => useQuery({ queryKey: noteKeys.tags(), queryFn: notesApi.tags });

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: noteKeys.all });
    qc.invalidateQueries({ queryKey: projectKeys.cards() });
  };
}

export function useSaveNote() {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (v: { id?: string; input: CreateNoteInput | UpdateNoteInput }) =>
      v.id ? notesApi.update(v.id, v.input) : notesApi.create(v.input as CreateNoteInput),
    onSuccess: done,
  });
}

export function useDeleteNote() {
  const done = useInvalidate();
  return useMutation({ mutationFn: (id: string) => notesApi.remove(id), onSuccess: done });
}
