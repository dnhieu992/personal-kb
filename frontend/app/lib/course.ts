import type { Exercise, WritingGrade } from './api';
import { playSpeech } from './speech';

/** Compare typed English loosely: case, spacing, curly quotes and end punctuation don't count. */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/[.!?]+$/, '')
    .trim();
}

/** The learner's answer to one exercise, in the shape its type needs. */
export type Response =
  | { type: 'mcq'; choice: string }
  | { type: 'gap'; text: string }
  | { type: 'order'; picked: number[]; words: string[] } // picked = indexes into the shuffled words
  | { type: 'match'; pairs: Record<string, string> } // left → right
  | { type: 'fix'; text: string }
  | { type: 'listen'; text: string } // dictation (listen with options answers as 'mcq')
  | { type: 'write'; text: string; grade?: WritingGrade };

/** Dictation: punctuation doesn't count, only the words. */
function words(s: string): string {
  return normalise(s).replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Levenshtein distance, for forgiving a typo or two in dictation. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

/** Exercise types that are answered by picking one option. */
export function isChoice(ex: Exercise): boolean {
  return ex.type === 'mcq' || ex.type === 'read' || (ex.type === 'listen' && ex.options.length > 0);
}

export function isCorrect(ex: Exercise, r: Response): boolean {
  switch (r.type) {
    case 'mcq':
      return r.choice === ex.answer[0];
    case 'gap':
    case 'fix':
      return ex.answer.some((a) => normalise(a) === normalise(r.text));
    case 'order':
      return normalise(r.words.join(' ')) === normalise(ex.options.join(' '));
    case 'match':
      return ex.pairs.every((p) => r.pairs[p.left] === p.right);
    case 'listen': {
      const typed = words(r.text);
      // One slip per ~25 characters is a typo, not a listening mistake.
      return ex.answer.some((a) => {
        const key = words(a);
        return typed === key || distance(typed, key) <= Math.floor(key.length / 25);
      });
    }
    case 'write':
      return !!r.grade?.correct;
  }
}

/** The right answer, written out for the feedback panel. */
export function answerText(ex: Exercise): string {
  switch (ex.type) {
    case 'match':
      return ex.pairs.map((p) => `${p.left} = ${p.right}`).join(' · ');
    case 'order':
      return ex.options.join(' ');
    case 'listen':
    case 'read':
      return ex.answer[0];
    default:
      return ex.answer.join('  /  ');
  }
}

/** Fisher–Yates; reshuffles if it came out unchanged (unless it can't change). */
export function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let tries = 0; tries < 5; tries++) {
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (out.length < 2 || out.some((x, i) => x !== items[i])) break;
  }
  return out;
}

/** Read English aloud (server voice, browser voice as fallback — see lib/speech). */
export function speak(text: string, rate = 0.95) {
  playSpeech(text, rate);
}
