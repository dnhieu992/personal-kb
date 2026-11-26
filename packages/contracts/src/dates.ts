/**
 * Calendar-day helpers. A day is a `YYYY-MM-DD` string ("DateKey"): it is *my* calendar
 * day, not an instant. Arithmetic runs on UTC midnights so it never drifts with the
 * server's time zone. "Today" is computed in ONE place (the API's Clock) from APP_TZ.
 */
export const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(s: unknown): s is string {
  return typeof s === 'string' && DAY_KEY.test(s) && toKey(parseKey(s)) === s;
}

export function todayKey(tz = DEFAULT_TZ, now = new Date()): string {
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

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / 86_400_000);
}
