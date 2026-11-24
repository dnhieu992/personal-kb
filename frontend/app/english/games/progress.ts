/**
 * Progress shared by the English games. Each game has its own store key; the
 * shape is the same. localStorage is the instant copy, the backend
 * (`/games/progress/:key`, MySQL) is the durable one so progress follows you
 * to another browser: every save goes to both, and `syncStore` merges the two
 * when a game page opens.
 */

const API = process.env.NEXT_PUBLIC_API_URL || '/api-proxy';

export interface Progress {
  levels: Record<string, { stars: number; best: number; plays: number }>;
  /** Item key → times you got it wrong (cleared by getting it right first try in review). */
  mistakes: Record<string, number>;
  /** Item key → times solved. */
  learned: Record<string, number>;
  streak: { last: string; days: number };
  sound: boolean;
  /** When this copy was last saved (ms); decides which copy's mistakes/streak win a merge. */
  savedAt?: number;
}

const empty = (): Progress => ({ levels: {}, mistakes: {}, learned: {}, streak: { last: '', days: 0 }, sound: true, savedAt: 0 });

export function loadStore(key: string): Progress {
  if (typeof window === 'undefined') return empty();
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(key) || '{}') };
  } catch {
    return empty();
  }
}

function pushRemote(key: string, p: Progress) {
  return fetch(`${API}/games/progress/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: p }),
    keepalive: true,
  }).then((r) => r.ok);
}

export function saveStore(key: string, p: Progress) {
  const stamped = { ...p, savedAt: Date.now() };
  localStorage.setItem(key, JSON.stringify(stamped));
  pushRemote(key, stamped).catch(() => {
    /* offline: the next sync uploads it */
  });
}

/**
 * Combine two copies. Level records and learned counts only grow, so take the
 * best of both; mistakes, streak and sound come from the newer copy (a mistake
 * you fixed must not come back from an older copy).
 */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const [older, newer] = (a.savedAt ?? 0) > (b.savedAt ?? 0) ? [b, a] : [a, b];
  const levels = { ...older.levels };
  for (const [id, r] of Object.entries(newer.levels)) {
    const o = levels[id];
    levels[id] = o ? { stars: Math.max(o.stars, r.stars), best: Math.max(o.best, r.best), plays: Math.max(o.plays, r.plays) } : r;
  }
  const learned = { ...older.learned };
  for (const [k, n] of Object.entries(newer.learned)) learned[k] = Math.max(learned[k] || 0, n);
  return { ...newer, levels, learned, savedAt: Math.max(a.savedAt ?? 0, b.savedAt ?? 0) };
}

/** Pull the server copy, merge it with this browser's, store the result in both. */
export async function syncStore(key: string): Promise<Progress> {
  const local = loadStore(key);
  const res = await fetch(`${API}/games/progress/${encodeURIComponent(key)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`sync ${res.status}`);
  const { data } = (await res.json()) as { data: Partial<Progress> | null };
  const remote = data ? { ...empty(), ...data } : null;
  const merged = remote ? mergeProgress(local, remote) : local;
  localStorage.setItem(key, JSON.stringify(merged));
  if (!remote || JSON.stringify(merged) !== JSON.stringify(remote)) await pushRemote(key, merged);
  return merged;
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
