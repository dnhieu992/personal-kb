/**
 * Day-key helpers. Days are `YYYY-MM-DD` strings; weeks start on Monday.
 * Arithmetic is done on UTC midnights so it never drifts with server time zone.
 * "Today" is evaluated in the planner's time zone (PLANNER_TZ, default Vietnam).
 */

export const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDayKey(s: unknown): s is string {
  return typeof s === 'string' && DAY_KEY.test(s);
}

export function todayKey(tz = DEFAULT_TZ, now = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function parseKey(k: string): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(k: string, n: number): string {
  const d = parseKey(k);
  d.setUTCDate(d.getUTCDate() + n);
  return toKey(d);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(k: string): number {
  return parseKey(k).getUTCDay();
}

export function startOfWeek(k: string): string {
  return addDays(k, -((weekday(k) + 6) % 7));
}

export function startOfMonth(k: string): string {
  return k.slice(0, 8) + '01';
}

export function endOfMonth(k: string): string {
  const d = parseKey(startOfMonth(k));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return toKey(d);
}

export function daysInMonth(k: string): number {
  return Number(endOfMonth(k).slice(8, 10));
}

export function keysBetween(from: string, to: string, max = 400): string[] {
  const out: string[] = [];
  for (let k = from; k <= to && out.length < max; k = addDays(k, 1)) out.push(k);
  return out;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86_400_000);
}

/**
 * The instant `minutes` after midnight of day `k` in time zone `tz`.
 * Fixed-offset zones (Vietnam) are exact; DST zones are good to the hour.
 */
export function atMinutes(k: string, minutes: number, tz = DEFAULT_TZ): Date {
  const guess = new Date(parseKey(k).getTime() + minutes * 60_000);
  const offset = tzOffsetMinutes(tz, guess);
  return new Date(guess.getTime() - offset * 60_000);
}

/** Minutes after local midnight of an instant, in `tz`. */
export function minutesOf(d: Date, tz = DEFAULT_TZ): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

function tzOffsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / 60_000);
}
