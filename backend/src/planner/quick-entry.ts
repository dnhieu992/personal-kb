/** Parses quick-add syntax: "Fix bug #work !!! @9:30" → title, tags, priority (1–3), start time (minutes). */
export interface QuickEntry {
  title: string;
  tags: string[];
  priority: number;
  startTime: number | null;
}

export function parseTime(s: string): number | null {
  const parts = s.toLowerCase().replace(/h/g, ':').split(':');
  if (parts.length > 2 || !/^\d{1,2}$/.test(parts[0])) return null;
  const h = Number(parts[0]);
  if (h > 23) return null;
  let m = 0;
  if (parts.length === 2 && parts[1] !== '') {
    if (!/^\d{1,2}$/.test(parts[1])) return null;
    m = Number(parts[1]);
    if (m > 59) return null;
  }
  return h * 60 + m;
}

export function parseQuickEntry(s: string): QuickEntry {
  const out: QuickEntry = { title: '', tags: [], priority: 0, startTime: null };
  const words: string[] = [];
  for (const w of s.split(' ').filter(Boolean)) {
    if (w.length > 1 && w.startsWith('#') && /\p{L}/u.test(w[1])) {
      out.tags.push(w.slice(1));
    } else if (w.length <= 3 && /^!+$/.test(w)) {
      out.priority = w.length;
    } else if (w.startsWith('@') && parseTime(w.slice(1)) !== null) {
      out.startTime = parseTime(w.slice(1));
    } else {
      words.push(w);
    }
  }
  out.title = words.join(' ');
  return out;
}
