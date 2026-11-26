import { z } from 'zod';
import { isDateKey } from './dates';

export const Uuid = z.string().uuid();
export const DateKey = z.string().refine(isDateKey, 'Expected a YYYY-MM-DD date');
export type DateKey = z.infer<typeof DateKey>;

/** 0 low · 1 medium · 2 high · 3 urgent */
export const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export const Priority = z.number().int().min(0).max(3);
export type Priority = z.infer<typeof Priority>;

export const CursorQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export function pageOf<T extends z.ZodTypeAny>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() });
}
export type Page<T> = { items: T[]; nextCursor: string | null };

/** RFC 7807 problem document — every API error has this shape. */
export const Problem = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number(),
  detail: z.string().optional(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type Problem = z.infer<typeof Problem>;
