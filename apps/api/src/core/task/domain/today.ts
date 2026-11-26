/**
 * Today view classification — pure. Each open task lands in exactly ONE bucket, checked
 * in this order: overdue → due today → in progress → pinned for today.
 *
 * "Auto-unpin" needs no cron: only `pinnedFor === today` counts, so yesterday's pin simply
 * stops matching at midnight. Derive, don't mutate.
 */
export interface TodayCandidate {
  status: 'todo' | 'doing' | 'done';
  priority: number;
  dueDate: string | null;
  pinnedFor: string | null;
  title: string;
}

export type TodayBucket = 'overdue' | 'dueToday' | 'inProgress' | 'pinned';

export function classify(t: TodayCandidate, today: string): TodayBucket | null {
  if (t.status === 'done') return null;
  if (t.dueDate && t.dueDate < today) return 'overdue';
  if (t.dueDate === today) return 'dueToday';
  if (t.status === 'doing') return 'inProgress';
  if (t.pinnedFor === today) return 'pinned';
  return null;
}

/** Priority desc, then earliest due date, then title. */
export function byPriority(a: TodayCandidate, b: TodayCandidate): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  const da = a.dueDate ?? '9999-12-31';
  const db = b.dueDate ?? '9999-12-31';
  if (da !== db) return da < db ? -1 : 1;
  return a.title.localeCompare(b.title);
}

export function groupToday<T extends TodayCandidate>(tasks: T[], today: string): Record<TodayBucket, T[]> {
  const out: Record<TodayBucket, T[]> = { overdue: [], dueToday: [], inProgress: [], pinned: [] };
  for (const t of tasks) {
    const b = classify(t, today);
    if (b) out[b].push(t);
  }
  for (const k of Object.keys(out) as TodayBucket[]) out[k].sort(byPriority);
  return out;
}
