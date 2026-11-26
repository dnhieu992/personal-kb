/**
 * Progress shared by the English games. Each game has its own store key; the shape is
 * the same. The server (`/api/english/games/progress/:key`, MySQL) is the ONLY copy —
 * v1 doubled it into localStorage and merged the two (ARCHITECTURE F4); v2 keeps just an
 * in-memory cache for the open page. `syncStore` loads it when a game page opens.
 */

const API = '/api/english';

export interface Progress {
  levels: Record<string, { stars: number; best: number; plays: number }>;
  /** Item key → times you got it wrong (cleared by getting it right first try in review). */
  mistakes: Record<string, number>;
  /** Item key → times solved. */
  learned: Record<string, number>;
  streak: { last: string; days: number };
  sound: boolean;
  savedAt?: number;
}

const empty = (): Progress => ({ levels: {}, mistakes: {}, learned: {}, streak: { last: '', days: 0 }, sound: true, savedAt: 0 });
const cache = new Map<string, Progress>();

/** The progress loaded for this page (empty until `syncStore` resolves). */
export function loadStore(key: string): Progress {
  return cache.get(key) ?? empty();
}

export function saveStore(key: string, p: Progress) {
  const stamped = { ...p, savedAt: Date.now() };
  cache.set(key, stamped);
  fetch(`${API}/games/progress/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: stamped }),
    keepalive: true,
  }).catch(() => {
    /* a lost save only costs this round's record */
  });
}

/** Load the server copy (the source of truth) into the page cache. */
export async function syncStore(key: string): Promise<Progress> {
  const res = await fetch(`${API}/games/progress/${encodeURIComponent(key)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`load ${res.status}`);
  const body = await res.text();
  const data = body ? ((JSON.parse(body) as { data: Partial<Progress> | null } | null)?.data ?? null) : null;
  const p = { ...empty(), ...(data ?? {}) };
  cache.set(key, p);
  return p;
}

const day = (offset = 0) => new Date(Date.now() - offset * 864e5).toLocaleDateString('sv');

export interface RoundRecord {
  /** Level id, or 'review' for a mistakes round (no stars / best). */
  levelId: string;
  won: boolean;
  score: number;
  stars: number;
  /** Keys solved with no wrong attempt. */
  clean: string[];
  /** Keys that got a wrong attempt. */
  missed: string[];
  /** Keys solved (clean or not). */
  matched: string[];
}

/** Fold a finished round into progress; returns the new progress and whether it's a new best. */
export function recordRound(p: Progress, r: RoundRecord): { progress: Progress; newBest: boolean } {
  const next: Progress = { ...p, levels: { ...p.levels }, mistakes: { ...p.mistakes }, learned: { ...p.learned } };
  const review = r.levelId === 'review';
  for (const k of r.matched) next.learned[k] = (next.learned[k] || 0) + 1;
  for (const k of r.missed) next.mistakes[k] = (next.mistakes[k] || 0) + 1;
  // A clean solve in review proves you fixed it; elsewhere it chips away at the count.
  for (const k of r.clean) {
    if (!next.mistakes[k]) continue;
    const left = review ? 0 : next.mistakes[k] - 1;
    if (left > 0) next.mistakes[k] = left;
    else delete next.mistakes[k];
  }
  let newBest = false;
  if (!review) {
    const prev = next.levels[r.levelId] || { stars: 0, best: 0, plays: 0 };
    newBest = r.won && r.score > prev.best;
    next.levels[r.levelId] = {
      stars: r.won ? Math.max(prev.stars, r.stars) : prev.stars,
      best: r.won ? Math.max(prev.best, r.score) : prev.best,
      plays: prev.plays + 1,
    };
  }
  if (next.streak.last !== day()) {
    next.streak = { last: day(), days: next.streak.last === day(1) ? next.streak.days + 1 : 1 };
  }
  return { progress: next, newBest };
}

export const streakAlive = (p: Progress) => p.streak.days > 0 && (p.streak.last === day() || p.streak.last === day(1));

export function starsFor(mistakes: number): number {
  return mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1;
}

/** Points multiplier for a streak of correct answers (1 = first in a row). */
export const comboMultiplier = (combo: number) => Math.min(3, 1 + 0.5 * (combo - 1));
