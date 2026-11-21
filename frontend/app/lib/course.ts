import type { Exercise } from './api';

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
  | { type: 'fix'; text: string };

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
  }
}

/** The right answer, written out for the feedback panel. */
export function answerText(ex: Exercise): string {
  switch (ex.type) {
    case 'match':
      return ex.pairs.map((p) => `${p.left} = ${p.right}`).join(' · ');
    case 'order':
      return ex.options.join(' ');
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

/** Read English aloud with the browser's voice (no-op where unsupported). */
export function speak(text: string, rate = 0.95) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = rate;
  const voice = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang === 'en-US' && /natural|google|samantha/i.test(v.name));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}
