import { shuffle } from '../../../lib/course';
import { Kind, pairByKey, pairKey, Pair, WORLDS } from './data';

/**
 * Level rules for the match game. Each world has 4 learning levels that take
 * consecutive slices of its pairs (so every pair is met), then a boss that mixes
 * all of them. Difficulty grows inside a world (more pairs, decoys, a timer,
 * fewer hearts) and across worlds (harder content).
 */

export const SLICES = [4, 5, 6, 7];
export const BOSS_PAIRS = 8;
export const LEVELS_PER_WORLD = SLICES.length + 1;

export interface LevelDef {
  /** "<worldId>-<n>" or "review". */
  id: string;
  world: number;
  index: number;
  name: string;
  boss: boolean;
  /** Fixed pair keys; boss levels draw BOSS_PAIRS at random from `pool`. */
  pool: string[];
  take: number;
  decoys: number;
  /** Seconds, or null for no clock. */
  timer: number | null;
  hearts: number;
  kind: Kind;
}

const SECS_PER_PAIR: Record<Kind, number> = { vocab: 9, sentence: 13, qa: 15 };
const LEVEL_NAMES = ['Khởi động', 'Làm quen', 'Có bẫy', 'Tăng tốc', 'Trùm cuối'];

export function levelDef(w: number, index: number): LevelDef {
  const world = WORLDS[w];
  const keys = world.pairs.map((_, i) => pairKey(w, i));
  const boss = index >= SLICES.length;
  const start = SLICES.slice(0, index).reduce((a, b) => a + b, 0);
  const pool = boss ? keys : keys.slice(start, start + SLICES[index]);
  const take = boss ? Math.min(BOSS_PAIRS, keys.length) : pool.length;
  const decoys = boss ? 2 : [0, 0, 1, 2][index];
  // Clock from level 3 in later worlds, level 4 always; boss is tighter.
  const clocked = boss || index === 3 || (index === 2 && w >= 3);
  const per = SECS_PER_PAIR[world.kind] * (boss ? 0.85 : 1) * Math.max(0.75, 1 - w * 0.03);
  return {
    id: `${world.id}-${index + 1}`,
    world: w,
    index,
    name: LEVEL_NAMES[index],
    boss,
    pool,
    take,
    decoys,
    timer: clocked ? Math.round((take * per) / 5) * 5 : null,
    hearts: index < 2 ? 5 : 3,
    kind: world.kind,
  };
}

/** A practice round built from the pairs you got wrong before. */
export function reviewDef(keys: string[]): LevelDef {
  return {
    id: 'review',
    world: -1,
    index: 0,
    name: 'Ôn lỗi sai',
    boss: false,
    pool: keys.slice(0, 6),
    take: Math.min(6, keys.length),
    decoys: 1,
    timer: null,
    hearts: 5,
    kind: 'sentence',
  };
}

export interface RoundItem {
  key: string;
  kind: Kind;
  pair: Pair;
}
export interface LeftCard {
  id: string;
  item: number;
  text: string;
}
export interface RightCard {
  id: string;
  text: string;
  /** Key of the pair whose trap this decoy is. */
  trapOf?: string;
}
export interface Round {
  items: RoundItem[];
  left: LeftCard[];
  right: RightCard[];
}

export function buildRound(def: LevelDef): Round {
  const keys = def.boss ? shuffle(def.pool).slice(0, def.take) : def.pool.slice(0, def.take);
  const items: RoundItem[] = keys.flatMap((key) => {
    const hit = pairByKey(key);
    return hit ? [{ key, kind: WORLDS[hit.w].kind, pair: hit.pair }] : [];
  });
  const answers = new Set(items.map((it) => it.pair.r));
  // Prepositions: a trap must not start like another pair's answer, or it might fit that pair.
  const startsLikeOther = (trap: string, owner: string) =>
    items.some((it) => it.key !== owner && firstWord(it.pair.r) === firstWord(trap));
  const strict = (key: string) => !!WORLDS[pairByKey(key)?.w ?? 0]?.strictTraps;

  // Decoys: traps of pairs in this round first, then of other pairs in the same pool.
  const candidates = [...shuffle(items.map((it) => it.key)), ...shuffle(def.pool.filter((k) => !keys.includes(k)))];
  const decoys: RightCard[] = [];
  for (const key of candidates) {
    if (decoys.length >= def.decoys) break;
    const trap = pairByKey(key)?.pair.trap;
    if (!trap || answers.has(trap) || decoys.some((d) => d.text === trap)) continue;
    if (strict(key) && startsLikeOther(trap, key)) continue;
    decoys.push({ id: `d${decoys.length}`, text: trap, trapOf: key });
  }

  return {
    items,
    left: shuffle(items.map((it, i) => ({ id: `l${i}`, item: i, text: it.pair.l }))),
    right: shuffle([...items.map((it, i) => ({ id: `r${i}`, text: it.pair.r })), ...decoys]),
  };
}

const firstWord = (s: string) => s.trim().split(/\s+/)[0].toLowerCase();

/** Points for one correct match at the given combo (1 = first in a row). */
export const comboMultiplier = (combo: number) => Math.min(3, 1 + 0.5 * (combo - 1));

export function starsFor(mistakes: number): number {
  return mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1;
}

// ── progress (localStorage) ────────────────────────────────────────────────

export interface Progress {
  levels: Record<string, { stars: number; best: number; plays: number }>;
  /** Pair key → times you picked a wrong answer for it (cleared by matching it first try in review). */
  mistakes: Record<string, number>;
  /** Pair key → times matched correctly. */
  learned: Record<string, number>;
  streak: { last: string; days: number };
  sound: boolean;
}

const STORE = 'kb.game.match.v1';
const empty = (): Progress => ({ levels: {}, mistakes: {}, learned: {}, streak: { last: '', days: 0 }, sound: true });

export function loadProgress(): Progress {
  if (typeof window === 'undefined') return empty();
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(STORE) || '{}') };
  } catch {
    return empty();
  }
}

export function saveProgress(p: Progress) {
  localStorage.setItem(STORE, JSON.stringify(p));
}

const today = () => new Date().toLocaleDateString('sv');

export interface RoundResult {
  def: LevelDef;
  won: boolean;
  score: number;
  stars: number;
  /** Keys matched without any wrong attempt on their left card. */
  clean: string[];
  /** Keys that got a wrong attempt. */
  missed: string[];
  /** Keys matched (clean or not). */
  matched: string[];
}

/** Fold a finished round into progress; returns the new progress and whether it's a new best. */
export function recordRound(p: Progress, r: RoundResult): { progress: Progress; newBest: boolean } {
  const next: Progress = { ...p, levels: { ...p.levels }, mistakes: { ...p.mistakes }, learned: { ...p.learned } };
  for (const k of r.matched) next.learned[k] = (next.learned[k] || 0) + 1;
  for (const k of r.missed) next.mistakes[k] = (next.mistakes[k] || 0) + 1;
  // A clean match in review proves you fixed it; elsewhere it chips away at the count.
  for (const k of r.clean) {
    if (!next.mistakes[k]) continue;
    const left = r.def.id === 'review' ? 0 : next.mistakes[k] - 1;
    if (left > 0) next.mistakes[k] = left;
    else delete next.mistakes[k];
  }
  let newBest = false;
  if (r.def.id !== 'review') {
    const prev = next.levels[r.def.id] || { stars: 0, best: 0, plays: 0 };
    newBest = r.won && r.score > prev.best;
    next.levels[r.def.id] = {
      stars: r.won ? Math.max(prev.stars, r.stars) : prev.stars,
      best: r.won ? Math.max(prev.best, r.score) : prev.best,
      plays: prev.plays + 1,
    };
  }
  const t = today();
  if (next.streak.last !== t) {
    const y = new Date(Date.now() - 864e5).toLocaleDateString('sv');
    next.streak = { last: t, days: next.streak.last === y ? next.streak.days + 1 : 1 };
  }
  return { progress: next, newBest };
}

export function isUnlocked(p: Progress, w: number, index: number): boolean {
  if (index > 0) return (p.levels[levelDef(w, index - 1).id]?.stars ?? 0) > 0;
  if (w === 0) return true;
  return (p.levels[levelDef(w - 1, LEVELS_PER_WORLD - 1).id]?.stars ?? 0) > 0;
}

export function worldStars(p: Progress, w: number): number {
  let s = 0;
  for (let i = 0; i < LEVELS_PER_WORLD; i++) s += p.levels[levelDef(w, i).id]?.stars ?? 0;
  return s;
}

/** Next level to play: first unlocked one without stars, else null. */
export function nextLevel(p: Progress): { w: number; i: number } | null {
  for (let w = 0; w < WORLDS.length; w++)
    for (let i = 0; i < LEVELS_PER_WORLD; i++)
      if (isUnlocked(p, w, i) && !(p.levels[levelDef(w, i).id]?.stars ?? 0)) return { w, i };
  return null;
}

export function mistakeKeys(p: Progress): string[] {
  return Object.entries(p.mistakes)
    .filter(([k]) => pairByKey(k))
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
}
