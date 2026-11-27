import { z } from 'zod';
import { DateKey } from './common';

/** My Notes (private, day-based notes — table diary_entry). Every entry route needs an unlock token. */
export const NOTES_TOKEN_HEADER = 'x-notes-token';

export const Passcode = z.string().regex(/^\d{6}$/, 'Passcode is 6 digits');

export const DiaryEntryInput = z.object({
  content: z.string().trim().min(1).max(100_000),
  /** The day the note belongs to (defaults to today in APP_TZ). */
  entryDate: DateKey.optional(),
});
export type DiaryEntryInput = z.infer<typeof DiaryEntryInput>;

export const DiaryEntry = z.object({
  id: z.string(),
  content: z.string(),
  entryDate: DateKey,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DiaryEntry = z.infer<typeof DiaryEntry>;

export const NotesLockState = z.object({ configured: z.boolean() });
export type NotesLockState = z.infer<typeof NotesLockState>;

export const UnlockInput = z.object({ passcode: Passcode });
export type UnlockInput = z.infer<typeof UnlockInput>;

export const ChangePasscodeInput = z.object({ current: Passcode, next: Passcode });
export type ChangePasscodeInput = z.infer<typeof ChangePasscodeInput>;

export const UnlockResult = z.object({ token: z.string(), expiresAt: z.string() });
export type UnlockResult = z.infer<typeof UnlockResult>;
