import { z } from 'zod';
import { CursorQuery } from './common';

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export const ATTACHMENT_STATUSES = ['pending', 'ready'] as const;
export const Attachment = z.object({
  id: z.string(),
  noteId: z.string(),
  filename: z.string(),
  mime: z.string(),
  size: z.number(),
  status: z.enum(ATTACHMENT_STATUSES),
  createdAt: z.string(),
});
export type Attachment = z.infer<typeof Attachment>;

export const Note = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  projectId: z.string().nullable(),
  taskId: z.string().nullable(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Note = z.infer<typeof Note>;

export const NoteSummary = Note.omit({ content: true }).extend({
  excerpt: z.string(),
  projectName: z.string().nullable(),
  taskTitle: z.string().nullable(),
  attachmentCount: z.number(),
});
export type NoteSummary = z.infer<typeof NoteSummary>;

export const NoteDetail = Note.extend({
  projectName: z.string().nullable(),
  taskTitle: z.string().nullable(),
  attachments: z.array(Attachment),
});
export type NoteDetail = z.infer<typeof NoteDetail>;

export const NoteListQuery = CursorQuery.extend({
  projectId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  tag: z.string().optional(),
  /** only notes with no project and no task */
  unfiled: z.coerce.boolean().optional(),
});
export type NoteListQuery = z.infer<typeof NoteListQuery>;

const Tag = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(60)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} ._+#-]*$/u, 'Invalid tag');

/**
 * A note hangs off a task, OR a project, OR nothing. Attaching to a task implies its
 * project (the server fills projectId from the task) — so XOR is about the *link*.
 */
export const CreateNoteInput = z.object({
  title: z.string().trim().min(1).max(300),
  content: z.string().max(1_000_000).default(''),
  projectId: z.string().uuid().nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
  tags: z.array(Tag).max(30).default([]),
});
export type CreateNoteInput = z.infer<typeof CreateNoteInput>;

export const UpdateNoteInput = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  content: z.string().max(1_000_000).optional(),
  projectId: z.string().uuid().nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
  tags: z.array(Tag).max(30).optional(),
});
export type UpdateNoteInput = z.infer<typeof UpdateNoteInput>;

export const TagCount = z.object({ name: z.string(), count: z.number() });
export type TagCount = z.infer<typeof TagCount>;

export const RequestUploadInput = z.object({
  filename: z.string().trim().min(1).max(255),
  mime: z.string().max(200).default('application/octet-stream'),
  size: z.number().int().min(1).max(MAX_ATTACHMENT_BYTES),
});
export type RequestUploadInput = z.infer<typeof RequestUploadInput>;

export const RequestUploadResult = z.object({
  attachment: Attachment,
  uploadUrl: z.string(),
  /** headers the browser must send with the PUT */
  headers: z.record(z.string()),
});
export type RequestUploadResult = z.infer<typeof RequestUploadResult>;

/** Stable in-app URL for an attachment: redirects to a short-lived presigned GET. */
export function attachmentHref(id: string): string {
  return `/api/attachments/${id}/raw`;
}

// ---- AI note tools (on click only; nothing is saved until the user accepts) ----
export const NoteAiInput = z.object({
  title: z.string().max(300).optional(),
  content: z.string().max(100_000),
});
export type NoteAiInput = z.infer<typeof NoteAiInput>;
export const SuggestTagsResult = z.object({ tags: z.array(z.string()) });
export type SuggestTagsResult = z.infer<typeof SuggestTagsResult>;
export const SummarizeResult = z.object({ summary: z.string() });
export type SummarizeResult = z.infer<typeof SummarizeResult>;
export const RewriteResult = z.object({ content: z.string() });
export type RewriteResult = z.infer<typeof RewriteResult>;
