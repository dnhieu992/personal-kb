// Types + date helpers for the Planner (web port of the Mac app).
// The HTTP calls live in `api.planner` (app/lib/api.ts).

export type Area = 'WORK' | 'PERSONAL';
export const AREAS: Area[] = ['WORK', 'PERSONAL'];
export const AREA_LABEL: Record<Area, string> = { WORK: 'Work', PERSONAL: 'Personal' };
export const AREA_COLOR: Record<Area, string> = { WORK: '#3B82F6', PERSONAL: '#22C55E' };
export const AREA_ICON: Record<Area, string> = { WORK: '💼', PERSONAL: '👤' };
/** The planner is personal-only now: the Work area is hidden from the UI (its old rows stay in the DB). */
export const AREA: Area = 'PERSONAL';
export const otherArea = (a: Area): Area => (a === 'WORK' ? 'PERSONAL' : 'WORK');

export const CATEGORY_PALETTE = [
  '#3B82F6', '#22C55E', '#F97316', '#A855F7', '#EF4444',
  '#EAB308', '#14B8A6', '#EC4899', '#6366F1', '#64748B',
];

export const PRIORITY_LABEL = ['None', 'Low', 'Medium', 'High'];
export const PRIORITY_COLOR = ['#94A3B8', '#3B82F6', '#F97316', '#EF4444'];

export interface PCategory {
  id: number;
  name: string;
  color: string;
  sort: number;
  area: Area;
}

export interface AreaCount {
  WORK: number;
  PERSONAL: number;
  total: number;
}

export interface PlannerMeta {
  today: string;
  timeZone: string;
  categories: PCategory[];
  overdue: AreaCount;
  remainingToday: AreaCount;
  backlog: AreaCount;
  correctionCount: number;
  englishPending: number;
  englishEnabled: boolean;
}

export interface PTask {
  id: number;
  title: string;
  date: string | null;
  done: boolean;
  doneAt: string | null;
  area: Area;
  categoryId: number | null;
  priority: number;
  startTime: number | null;
  duration: number | null;
  tags: string[];
  notes: string | null;
  result: string | null;
  reminderAt: string | null;
  goalId: number | null;
  recurrenceId: number | null;
  inProgress: boolean;
  createdAt: string;
  checklistTotal: number;
  checklistDone: number;
  attachmentCount: number;
  isOverdue: boolean;
  englishPending: boolean;
}

export interface PChecklistItem {
  id: number;
  taskId: number;
  title: string;
  done: boolean;
  sort: number;
}

export interface PAttachment {
  id: number;
  taskId: number;
  kind: 'link' | 'file';
  title: string;
  value: string;
}

export type RecurrenceKind = 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface PRecurrence {
  id: number;
  kind: RecurrenceKind;
  weekdays: number;
  monthDay: number;
  startDate: string;
  endDate: string | null;
}

export type CorrectionKind = 'task' | 'checklist' | 'goal' | 'noteTitle' | 'text';

export interface PCorrection {
  id: number;
  kind: CorrectionKind;
  refId: number;
  original: string;
  corrected: string;
  why: string;
  createdAt: string;
  canRevert?: boolean;
}

export interface PTaskDetail extends PTask {
  checklist: PChecklistItem[];
  attachments: PAttachment[];
  recurrence: PRecurrence | null;
  correction: PCorrection | null;
  checklistPending: number[];
}

/** quarter = 3 months from periodStart (any day). */
export type GoalPeriod = 'week' | 'month' | 'quarter';

export interface PGoal {
  id: number;
  title: string;
  area: Area;
  categoryId: number | null;
  period: GoalPeriod;
  periodStart: string;
  notes: string | null;
  done: boolean;
  progressDone: number;
  progressTotal: number;
}

export interface PGoalDetail extends PGoal {
  tasks: PTask[];
  correction: PCorrection | null;
}

export interface PNote {
  id: number;
  title: string;
  body: string | null;
  area: Area;
  categoryId: number | null;
  day: string | null;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  correction?: PCorrection | null;
  englishPending?: boolean;
}

export type TaskView =
  | 'today' | 'week' | 'month' | 'all' | 'backlog'
  | 'overdue' | 'category' | 'goal' | 'search';

export interface TaskListResponse {
  today: string;
  range?: { from: string; to: string };
  tasks: PTask[];
  goals: PGoal[];
}

export interface BoardResponse {
  today: string;
  backlog: PTask[];
  doing: PTask[];
  done: PTask[];
}

export interface StatsResponse {
  from: string;
  to: string;
  days: { date: string; area: Area; total: number; done: number }[];
  categories: { area: Area; categoryId: number | null; total: number; done: number }[];
  overdue: AreaCount;
  goals: PGoal[];
}

// ───────────── Dates (YYYY-MM-DD keys, weeks start Monday) ─────────────

export const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const LONG_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
/** getDay() indices in Monday-first order. */
export const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

export const parseKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
export const toKey = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (k: string, n: number) => {
  const d = parseKey(k);
  d.setUTCDate(d.getUTCDate() + n);
  return toKey(d);
};
export const addMonths = (k: string, n: number) => {
  const d = parseKey(k.slice(0, 8) + '01');
  d.setUTCMonth(d.getUTCMonth() + n);
  return toKey(d);
};
export const weekdayOf = (k: string) => parseKey(k).getUTCDay();
export const startOfWeek = (k: string) => addDays(k, -((weekdayOf(k) + 6) % 7));
export const startOfMonth = (k: string) => k.slice(0, 8) + '01';
export const dayMonth = (k: string) => `${Number(k.slice(8, 10))} ${MONTHS[Number(k.slice(5, 7)) - 1]}`;
export const monthTitle = (k: string) => `${LONG_MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
export const fullDate = (k: string) => `${LONG_DAYS[weekdayOf(k)]}, ${dayMonth(k)} ${k.slice(0, 4)}`;

/** ISO-8601 week number. */
export function weekNumber(k: string): number {
  const d = parseKey(k);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export function relativeDay(k: string, today: string): string {
  if (k === today) return 'Today';
  if (k === addDays(today, 1)) return 'Tomorrow';
  if (k === addDays(today, -1)) return 'Yesterday';
  return `${SHORT_DAYS[weekdayOf(k)]}, ${dayMonth(k)}`;
}

export const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export const durationLabel = (m: number) =>
  m < 60 ? `${m}m` : m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;

/** Last day of a goal's period. */
export function goalEnd(g: Pick<PGoal, 'period' | 'periodStart'>): string {
  if (g.period === 'week') return addDays(g.periodStart, 6);
  if (g.period === 'month') return addDays(addMonths(g.periodStart, 1), -1);
  const d = parseKey(g.periodStart);
  d.setUTCMonth(d.getUTCMonth() + 3);
  return addDays(toKey(d), -1);
}

export function goalPeriodLabel(g: Pick<PGoal, 'period' | 'periodStart'>): string {
  if (g.period === 'month') return monthTitle(g.periodStart);
  if (g.period === 'quarter') {
    const end = goalEnd(g);
    return `3 months · ${dayMonth(g.periodStart)} ${g.periodStart.slice(0, 4)} – ${dayMonth(end)} ${end.slice(0, 4)}`;
  }
  return `Week ${weekNumber(g.periodStart)} · ${dayMonth(g.periodStart)}–${dayMonth(addDays(g.periodStart, 6))}`;
}

export function recurrenceSummary(r: PRecurrence): string {
  switch (r.kind) {
    case 'daily':
      return 'Daily';
    case 'weekdays':
      return 'Every weekday (Mon–Fri)';
    case 'weekly':
      return 'Weekly: ' + MONDAY_FIRST.filter((d) => r.weekdays & (1 << d)).map((d) => SHORT_DAYS[d]).join(', ');
    case 'monthly':
      return `Day ${r.monthDay} of every month`;
  }
}

/** Local "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
