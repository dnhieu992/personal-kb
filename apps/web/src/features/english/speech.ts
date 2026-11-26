/**
 * English speech for the course. Audio comes from the backend (`GET /tts`, Piper
 * neural voice, cached per sentence) and plays in an <audio> element; the
 * browser's own voice (Web Speech) is only a fallback when that fails, because
 * Chrome on macOS can hang with `speaking = true` and never make a sound.
 */

import { api } from '@/features/english/api';

let audio: HTMLAudioElement | null = null;
/** Bumped on every play/stop so callbacks of a superseded clip do nothing. */
let token = 0;

/** Stop whatever is being said. */
export function stopSpeech() {
  token++;
  if (audio) {
    audio.onended = audio.onerror = null;
    audio.pause();
    audio = null;
  }
  if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
}

/**
 * Say `text` at `rate` (1 = normal). `onEnd` runs once when it finishes or
 * fails — never for a clip that was stopped or replaced.
 */
export function playSpeech(text: string, rate = 1, onEnd?: () => void) {
  if (typeof window === 'undefined' || !text.trim()) return;
  stopSpeech();
  const mine = token;
  let done = false;
  const finish = () => {
    if (done || mine !== token) return;
    done = true;
    onEnd?.();
  };
  let fellBack = false;
  const fallback = () => {
    if (fellBack || mine !== token) return;
    fellBack = true;
    browserSpeak(text, rate, finish);
  };

  const a = new Audio(api.ttsUrl(text, rate));
  audio = a;
  a.onended = finish;
  a.onerror = fallback;
  a.play().catch((e: unknown) => {
    if (e instanceof DOMException && e.name === 'AbortError') return; // stopped meanwhile
    fallback();
  });
}

/** Warm the server/browser cache for a clip that will be played soon. */
export function prefetchSpeech(text: string, rate = 1) {
  if (typeof window === 'undefined' || !text.trim()) return;
  fetch(api.ttsUrl(text, rate)).catch(() => undefined);
}

function browserSpeak(text: string, rate: number, onEnd: () => void) {
  if (!('speechSynthesis' in window)) return onEnd();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  u.rate = rate;
  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find((v) => v.lang === 'en-US' && /natural|google|samantha/i.test(v.name)) ??
    voices.find((v) => v.lang === 'en-US');
  if (voice) u.voice = voice;
  u.onend = onEnd;
  u.onerror = onEnd;
  window.speechSynthesis.speak(u);
}
