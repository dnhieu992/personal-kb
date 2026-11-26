/**
 * Fractional indexing for kanban/list ordering: a position is a string over an
 * ASCII-ordered alphabet, and a new key can always be generated strictly between two
 * neighbours — so a drag-and-drop updates ONE row instead of renumbering a column.
 *
 * Keys never end in the smallest digit ('0'), which guarantees there is always room
 * between any two keys. Compare keys with plain `<` (and a binary collation in SQL).
 */
const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;

function midpoint(a: string, b: string | null): string {
  // Invariant: a < b (b === null means +infinity); neither ends with '0'.
  if (b !== null) {
    // Shared prefix: recurse past it.
    let n = 0;
    while ((a[n] ?? '0') === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const da = a ? DIGITS.indexOf(a[0]) : 0;
  const db = b !== null ? DIGITS.indexOf(b[0]) : BASE;
  if (db - da > 1) {
    return DIGITS[Math.round((da + db) / 2)];
  }
  // Adjacent first digits.
  if (b !== null && b.length > 1) return b[0];
  return DIGITS[da] + midpoint(a.slice(1), null);
}

/** A key strictly between `before` and `after` (null = open end). */
export function positionBetween(before: string | null | undefined, after: string | null | undefined): string {
  const a = before ?? '';
  const b = after ?? null;
  if (b !== null && a >= b) throw new Error(`positionBetween: ${a} >= ${b}`);
  if (/0$/.test(a) || (b !== null && /0$/.test(b))) throw new Error('positionBetween: invalid key');
  return midpoint(a, b);
}

/** A key after every key in `keys`. */
export function positionAfter(keys: (string | null | undefined)[]): string {
  const max = keys.filter((k): k is string => !!k).sort().pop() ?? null;
  return positionBetween(max, null);
}
