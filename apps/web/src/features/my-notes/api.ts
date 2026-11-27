import type { DiaryEntry, NotesLockState, UnlockResult } from '@pkb/contracts';
import { NOTES_TOKEN_HEADER } from '@pkb/contracts';
import { ApiError, http } from '@/shared/http';

/** Passcode lock: state, first-time setup, unlock, change. */
export const lockApi = {
  state: () => http.get<NotesLockState>('/diary/lock'),
  setup: (passcode: string) => http.post<UnlockResult>('/diary/lock/setup', { passcode }),
  unlock: (passcode: string) => http.post<UnlockResult>('/diary/lock/unlock', { passcode }),
  change: (current: string, next: string) => http.post<UnlockResult>('/diary/lock/change', { current, next }),
};

/** Entry calls carry the unlock token (held in page memory only — never stored). */
async function call<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: { [NOTES_TOKEN_HEADER]: token, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  if (!res.ok) {
    const problem = await res.json().catch(() => ({ type: 'network', title: res.statusText, status: res.status }));
    throw new ApiError(problem);
  }
  return res.json() as Promise<T>;
}

export const notesApi = (token: string) => ({
  list: () => call<DiaryEntry[]>(token, 'GET', '/diary'),
  create: (content: string, entryDate: string) => call<DiaryEntry>(token, 'POST', '/diary', { content, entryDate }),
  update: (id: string, content: string, entryDate: string) => call<DiaryEntry>(token, 'PUT', `/diary/${id}`, { content, entryDate }),
  remove: (id: string) => call<{ deleted: boolean }>(token, 'DELETE', `/diary/${id}`),
});
