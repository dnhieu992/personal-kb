import { addDays, daysInMonth, RecurrenceRule, weekday } from '@pkb/contracts';

/**
 * Recurrence is pure date math on calendar days (YYYY-MM-DD). The series is "by the
 * calendar": the next due date derives from the PREVIOUS DUE DATE, never from when the
 * instance was actually completed — finishing Monday's task on Wednesday still makes
 * the next one due on the next scheduled day.
 */

function monthlyIn(year: number, month1: number, day: number): string {
  const d = Math.min(day, daysInMonth(year, month1));
  return `${year}-${String(month1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** First due date on or after `from` that matches the rule. */
export function firstDue(rule: RecurrenceRule, from: string): string {
  switch (rule.kind) {
    case 'daily':
    case 'everyNDays':
      return from;
    case 'weekly': {
      for (let i = 0; i < 7; i++) {
        const k = addDays(from, i);
        if (rule.weekdays.includes(weekday(k))) return k;
      }
      throw new Error('weekly rule without weekdays');
    }
    case 'monthly': {
      const [y, m] = from.split('-').map(Number);
      const here = monthlyIn(y, m, rule.day);
      if (here >= from) return here;
      return m === 12 ? monthlyIn(y + 1, 1, rule.day) : monthlyIn(y, m + 1, rule.day);
    }
  }
}

/** The occurrence strictly after `previousDue`. */
export function nextDue(rule: RecurrenceRule, previousDue: string): string {
  switch (rule.kind) {
    case 'daily':
      return addDays(previousDue, 1);
    case 'everyNDays':
      return addDays(previousDue, rule.interval);
    case 'weekly':
      return firstDue(rule, addDays(previousDue, 1));
    case 'monthly': {
      // Use the rule's day, not previousDue's day: 31st → Feb 28 → Mar 31 (not Mar 28).
      const [y, m] = previousDue.split('-').map(Number);
      return m === 12 ? monthlyIn(y + 1, 1, rule.day) : monthlyIn(y, m + 1, rule.day);
    }
  }
}

/**
 * Due date for the instance created when a paused series resumes: the first occurrence
 * on/after today that is also after the last due date (missed occurrences are skipped).
 */
export function resumeDue(rule: RecurrenceRule, lastDue: string | null, anchor: string, today: string): string {
  if (!lastDue) return firstDue(rule, today > anchor ? today : anchor);
  let due = nextDue(rule, lastDue);
  if (rule.kind === 'everyNDays') {
    while (due < today) due = addDays(due, rule.interval);
    return due;
  }
  return due >= today ? due : firstDue(rule, today);
}
