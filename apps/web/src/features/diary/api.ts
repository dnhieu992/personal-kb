import { http } from '@/shared/http';

/** A Markdown notebook entry: content + when written. */
export interface NoteEntry {
  id: string;
  content: string;
  /** When it was written (ISO). */
  createdAt: string;
  updatedAt: string;
}

export const diaryApi = {
  list: () => http.get<NoteEntry[]>('/diary'),
  create: (content: string) => http.post<NoteEntry>('/diary', { content }),
  update: (id: string, content: string) => http.put<NoteEntry>(`/diary/${id}`, { content }),
  remove: (id: string) => http.del<{ deleted: boolean }>(`/diary/${id}`),
};
