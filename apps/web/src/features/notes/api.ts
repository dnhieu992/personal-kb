import type { NoteAiInput, RewriteResult, SuggestTagsResult, SummarizeResult, Attachment, CreateNoteInput, NoteDetail, NoteListQuery, NoteSummary, Page, RequestUploadResult, TagCount, UpdateNoteInput } from '@pkb/contracts';
import { http } from '@/shared/http';

export const notesApi = {
  list: (q: Partial<NoteListQuery>) => http.get<Page<NoteSummary>>('/notes', q as Record<string, string>),
  get: (id: string) => http.get<NoteDetail>(`/notes/${id}`),
  create: (input: CreateNoteInput) => http.post<NoteDetail>('/notes', input),
  update: (id: string, input: UpdateNoteInput) => http.patch<NoteDetail>(`/notes/${id}`, input),
  remove: (id: string) => http.del(`/notes/${id}`),
  tags: () => http.get<TagCount[]>('/tags'),
  removeAttachment: (id: string) => http.del(`/attachments/${id}`),
  ai: {
    suggestTags: (input: NoteAiInput) => http.post<SuggestTagsResult>('/notes/ai/suggest-tags', input),
    summarize: (input: NoteAiInput) => http.post<SummarizeResult>('/notes/ai/summarize', input),
    rewrite: (input: NoteAiInput) => http.post<RewriteResult>('/notes/ai/rewrite', input),
  },

  /** presign → PUT straight to storage → confirm. The API never sees the bytes. */
  async upload(noteId: string, file: File): Promise<Attachment> {
    const req = await http.post<RequestUploadResult>(`/notes/${noteId}/attachments`, {
      filename: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
    });
    const put = await fetch(req.uploadUrl, { method: 'PUT', headers: req.headers, body: file });
    if (!put.ok) throw new Error(`Upload failed (${put.status})`);
    return http.post<Attachment>(`/attachments/${req.attachment.id}/confirm`);
  },
};
