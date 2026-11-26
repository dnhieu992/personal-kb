import { describe, expect, it } from 'vitest';
import { firstDue, nextDue, resumeDue } from './recurrence';

describe('firstDue', () => {
  it('daily / everyNDays start on the anchor', () => {
    expect(firstDue({ kind: 'daily' }, '2026-11-26')).toBe('2026-11-26');
    expect(firstDue({ kind: 'everyNDays', interval: 3 }, '2026-11-26')).toBe('2026-11-26');
  });
  it('weekly picks the first matching weekday on/after the anchor', () => {
    // 2026-11-26 is a Thursday (4)
    expect(firstDue({ kind: 'weekly', weekdays: [4] }, '2026-11-26')).toBe('2026-11-26');
    expect(firstDue({ kind: 'weekly', weekdays: [1, 3, 5] }, '2026-11-26')).toBe('2026-11-27');
    expect(firstDue({ kind: 'weekly', weekdays: [1] }, '2026-11-26')).toBe('2026-11-30');
  });
  it('monthly uses this month if the day is still ahead, else next month (clamped)', () => {
    expect(firstDue({ kind: 'monthly', day: 28 }, '2026-11-26')).toBe('2026-11-28');
    expect(firstDue({ kind: 'monthly', day: 5 }, '2026-11-26')).toBe('2026-12-05');
    expect(firstDue({ kind: 'monthly', day: 31 }, '2026-11-26')).toBe('2026-11-30');
    expect(firstDue({ kind: 'monthly', day: 10 }, '2026-12-26')).toBe('2027-01-10');
    expect(firstDue({ kind: 'monthly', day: 31 }, '2027-02-01')).toBe('2027-02-28');
  });
});

describe('nextDue', () => {
  it('daily', () => {
    expect(nextDue({ kind: 'daily' }, '2026-12-31')).toBe('2027-01-01');
  });
  it('every N days counts from the previous due date', () => {
    expect(nextDue({ kind: 'everyNDays', interval: 10 }, '2026-02-25')).toBe('2026-03-07');
  });
  it('weekly Mon/Wed/Fri', () => {
    const r = { kind: 'weekly' as const, weekdays: [1, 3, 5] };
    expect(nextDue(r, '2026-11-23')).toBe('2026-11-25'); // Mon → Wed
    expect(nextDue(r, '2026-11-25')).toBe('2026-11-27'); // Wed → Fri
    expect(nextDue(r, '2026-11-27')).toBe('2026-11-30'); // Fri → Mon
  });
  it('weekly with a single day jumps a week', () => {
    expect(nextDue({ kind: 'weekly', weekdays: [0] }, '2026-11-29')).toBe('2026-12-06');
  });
  it('monthly on the 31st clamps and then recovers', () => {
    const r = { kind: 'monthly' as const, day: 31 };
    expect(nextDue(r, '2027-01-31')).toBe('2027-02-28');
    expect(nextDue(r, '2027-02-28')).toBe('2027-03-31');
    expect(nextDue(r, '2027-03-31')).toBe('2027-04-30');
    expect(nextDue(r, '2027-12-31')).toBe('2028-01-31');
  });
  it('monthly handles leap years', () => {
    expect(nextDue({ kind: 'monthly', day: 29 }, '2028-01-29')).toBe('2028-02-29');
    expect(nextDue({ kind: 'monthly', day: 30 }, '2027-01-30')).toBe('2027-02-28');
  });
  it('is calendar-based: completion day does not matter (pure fn of previous due)', () => {
    expect(nextDue({ kind: 'weekly', weekdays: [1] }, '2026-11-23')).toBe('2026-11-30');
  });
});

describe('resumeDue', () => {
  it('skips missed occurrences when resuming', () => {
    expect(resumeDue({ kind: 'daily' }, '2026-11-01', '2026-10-01', '2026-11-26')).toBe('2026-11-26');
    expect(resumeDue({ kind: 'weekly', weekdays: [1] }, '2026-11-02', '2026-10-01', '2026-11-26')).toBe('2026-11-30');
  });
  it('keeps the every-N-days phase', () => {
    expect(resumeDue({ kind: 'everyNDays', interval: 3 }, '2026-11-20', '2026-11-01', '2026-11-26')).toBe('2026-11-26');
    expect(resumeDue({ kind: 'everyNDays', interval: 4 }, '2026-11-20', '2026-11-01', '2026-11-26')).toBe('2026-11-28');
  });
  it('uses the next occurrence when it is still ahead', () => {
    expect(resumeDue({ kind: 'monthly', day: 15 }, '2026-11-15', '2026-01-01', '2026-11-26')).toBe('2026-12-15');
  });
  it('without history starts from the anchor or today, whichever is later', () => {
    expect(resumeDue({ kind: 'daily' }, null, '2026-12-01', '2026-11-26')).toBe('2026-12-01');
  });
});
