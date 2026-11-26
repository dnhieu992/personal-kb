import { describe, expect, it } from 'vitest';
import { classify, groupToday, TodayCandidate } from './today';

const T = '2026-11-26';
const t = (p: Partial<TodayCandidate>): TodayCandidate => ({
  status: 'todo', priority: 1, dueDate: null, pinnedFor: null, title: 'x', ...p,
});

describe('classify', () => {
  it('done tasks never show', () => {
    expect(classify(t({ status: 'done', dueDate: '2026-11-01' }), T)).toBeNull();
  });
  it('overdue beats everything', () => {
    expect(classify(t({ dueDate: '2026-11-25', status: 'doing', pinnedFor: T }), T)).toBe('overdue');
  });
  it('due today', () => {
    expect(classify(t({ dueDate: T, status: 'doing' }), T)).toBe('dueToday');
  });
  it('in progress without deadline, or with a future deadline', () => {
    expect(classify(t({ status: 'doing' }), T)).toBe('inProgress');
    expect(classify(t({ status: 'doing', dueDate: '2026-12-01' }), T)).toBe('inProgress');
  });
  it('pinned only counts for today — yesterday’s pin expires by itself', () => {
    expect(classify(t({ pinnedFor: T }), T)).toBe('pinned');
    expect(classify(t({ pinnedFor: '2026-11-25' }), T)).toBeNull();
  });
  it('future todo without pin is not in Today', () => {
    expect(classify(t({ dueDate: '2026-11-27' }), T)).toBeNull();
  });
});

describe('groupToday', () => {
  it('sorts each bucket by priority desc then due date', () => {
    const g = groupToday(
      [
        t({ title: 'a', dueDate: '2026-11-20', priority: 1 }),
        t({ title: 'b', dueDate: '2026-11-24', priority: 3 }),
        t({ title: 'c', dueDate: '2026-11-10', priority: 1 }),
      ],
      T,
    );
    expect(g.overdue.map((x) => x.title)).toEqual(['b', 'c', 'a']);
  });
});
