import { shuffle } from '@/features/english/course';
import { loadStore, Progress, recordRound as recordStore, RoundRecord, saveStore, syncStore } from '../progress';
import { Sentence, sentenceByKey, sentenceKey, WORLDS } from './data';

/**
 * Level rules for "Nối từ" (build the sentence). Difficulty grows inside a world:
 *  1–2  short sentences, words keep their capital letter and punctuation (clues),
 *       structure hint shown, 5 hearts
 *  3    words lowercased and punctuation removed (no clue where it starts/ends),
 *       one trap word in some sentences, hint costs half the points, 3 hearts
 *  4    trap word whenever there is one, a clock
 *  boss 8 random sentences from the whole world, tighter clock
 * and across worlds through harder grammar and longer sentences.
 */

export const SLICES = [4, 5, 6, 7];
export const BOSS_SIZE = 8;
export const LEVELS_PER_WORLD = SLICES.length + 1;
const NAMES = ['Khởi động', 'Làm quen', 'Không gợi ý', 'Tăng tốc', 'Trùm cuối'];

export interface LevelDef {
  id: string;
  world: number;
  index: number;
  name: string;
  boss: boolean;
  pool: string[];
  take: number;
  /** Lowercase + strip punctuation from the word chips. */
  hard: boolean;
  /** Chance (0–1) that a sentence with a trap gets its trap word in the bank. */
  trapRate: number;
  /** Structure hint shown for free (else behind a button that halves the points). */
  freeHint: boolean;
  timed: boolean;
  hearts: number;
}

export function levelDef(w: number, index: number): LevelDef {
  const world = WORLDS[w];
  const keys = world.items.map((_, i) => sentenceKey(w, i));
  const boss = index >= SLICES.length;
  const start = SLICES.slice(0, index).reduce((a, b) => a + b, 0);
  return {
    id: `${world.id}-${index + 1}`,
    world: w,
    index,
    name: NAMES[index],
    boss,
    pool: boss ? keys : keys.slice(start, start + SLICES[index]),
    take: boss ? Math.min(BOSS_SIZE, keys.length) : SLICES[index],
    hard: index >= 2,
    trapRate: index < 2 ? 0 : index === 2 ? 0.6 : 1,
    freeHint: index < 2,
    timed: index >= 3,
    hearts: index < 2 ? 5 : 3,
  };
}

export function reviewDef(keys: string[]): LevelDef {
  return {
    id: 'review',
    world: -1,
    index: 0,
    name: 'Ôn lỗi sai',
    boss: false,
    pool: keys.slice(0, 6),
    take: Math.min(6, keys.length),
    hard: true,
    trapRate: 1,
    freeHint: false,
    timed: false,
    hearts: 5,
  };
}

export interface Chip {
  id: string;
  text: string;
  trap?: boolean;
}

export interface Puzzle {
  key: string;
  item: Sentence;
  chips: Chip[];
  words: number;
}

const I_FORMS = new Set(['I', "I'm", "I'll", "I'd", "I've"]);

/** The word chips for a sentence, in order. */
export function tokens(s: string, hard: boolean): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  if (!hard) return words;
  return words
    .map((w, i) => {
      const bare = w.replace(/[.,?!]/g, '');
      return i === 0 && !I_FORMS.has(bare) ? bare.charAt(0).toLowerCase() + bare.slice(1) : bare;
    })
    .filter(Boolean);
}

/** Compare form: lowercase words without punctuation. */
export const normWords = (s: string) =>
  s
    .toLowerCase()
    .replace(/[.,?!]/g, '')
    .split(/\s+/)
    .filter(Boolean);

export function buildPuzzles(def: LevelDef): Puzzle[] {
  const keys = def.boss ? shuffle(def.pool).slice(0, def.take) : def.pool.slice(0, def.take);
  return keys.flatMap((key) => {
    const hit = sentenceByKey(key);
    if (!hit) return [];
    const words = tokens(hit.item.s, def.hard);
    const chips: Chip[] = words.map((text, i) => ({ id: `${key}-${i}`, text }));
    if (hit.item.trap && Math.random() < def.trapRate) chips.push({ id: `${key}-t`, text: hit.item.trap, trap: true });
    // Never hand out the bank already in the right order.
    let bank = shuffle(chips);
    for (let n = 0; n < 5 && bank.slice(0, words.length).every((c, i) => c.text === words[i]); n++) bank = shuffle(chips);
    return [{ key, item: hit.item, chips: bank, words: words.length }];
  });
}

/** Seconds on the clock for a round. */
export function roundTime(def: LevelDef, puzzles: Puzzle[]): number | null {
  if (!def.timed) return null;
  const raw = puzzles.reduce((a, p) => a + p.words * 3.2 + 6, 0) * (def.boss ? 0.85 : 1);
  return Math.round(raw / 5) * 5;
}

export interface Check {
  ok: boolean;
  /** Per placed word: right word in the right place? (against the closest correct answer) */
  marks: boolean[];
  usedTrap: boolean;
}

export function check(item: Sentence, placed: Chip[]): Check {
  const got = placed.map((c) => normWords(c.text).join(' '));
  const answers = [item.s, ...(item.alt ?? [])].map(normWords);
  const usedTrap = placed.some((c) => c.trap);
  let best: boolean[] = [];
  for (const a of answers) {
    const marks = got.map((w, i) => w === a[i]);
    if (!usedTrap && got.length === a.length && marks.every(Boolean)) return { ok: true, marks, usedTrap };
    if (marks.filter(Boolean).length > best.filter(Boolean).length || !best.length) best = marks;
  }
  return { ok: false, marks: best, usedTrap };
}

/** Points for a solved sentence before the combo multiplier. */
export const basePoints = (words: number) => 50 + words * 10;

// ── progress ───────────────────────────────────────────────────────────────

const STORE = 'kb.game.sentence.v1';
export const loadProgress = (): Progress => loadStore(STORE);
export const saveProgress = (p: Progress) => saveStore(STORE, p);
export const syncProgress = (): Promise<Progress> => syncStore(STORE);
export const recordRound = (p: Progress, r: RoundRecord) => recordStore(p, r);

const bossDone = (p: Progress, w: number) => w >= 0 && (p.levels[levelDef(w, LEVELS_PER_WORLD - 1).id]?.stars ?? 0) > 0;

/**
 * A world opens after the boss of either of the two worlds before it. Worlds
 * come in pairs (grammar topic, then the same grammar at work), so each track
 * can be played on its own and progress from before the work worlds were
 * added stays open.
 */
export function isUnlocked(p: Progress, w: number, index: number): boolean {
  if (index > 0) return (p.levels[levelDef(w, index - 1).id]?.stars ?? 0) > 0;
  return w === 0 || bossDone(p, w - 1) || bossDone(p, w - 2);
}

export function worldStars(p: Progress, w: number): number {
  let s = 0;
  for (let i = 0; i < LEVELS_PER_WORLD; i++) s += p.levels[levelDef(w, i).id]?.stars ?? 0;
  return s;
}

export function nextLevel(p: Progress): { w: number; i: number } | null {
  for (let w = 0; w < WORLDS.length; w++)
    for (let i = 0; i < LEVELS_PER_WORLD; i++)
      if (isUnlocked(p, w, i) && !(p.levels[levelDef(w, i).id]?.stars ?? 0)) return { w, i };
  return null;
}

export function mistakeKeys(p: Progress): string[] {
  return Object.entries(p.mistakes)
    .filter(([k]) => sentenceByKey(k))
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);
}
