/**
 * Turns free text into a MySQL BOOLEAN MODE query: every word required, prefix-matched.
 * InnoDB ignores tokens shorter than innodb_ft_min_token_size (3), so those are dropped
 * here and callers fall back to LIKE when nothing usable is left.
 */
export function booleanQuery(q: string): string | null {
  const words = q
    .toLowerCase()
    .replace(/[+\-<>()~*"@]/g, ' ')
    .split(/\s+/)
    .filter((w) => [...w].length >= 3)
    .slice(0, 10);
  return words.length ? words.map((w) => `+${w}*`).join(' ') : null;
}

export function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
}

/** ~200 chars around the first hit of any query word. */
export function snippet(text: string | null | undefined, q: string, size = 200): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= size) return t;
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const lower = t.toLowerCase();
  const at = words.map((w) => lower.indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, at - Math.floor(size / 3));
  return (start > 0 ? '…' : '') + t.slice(start, start + size) + (start + size < t.length ? '…' : '');
}
