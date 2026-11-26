import { describe, expect, it } from 'vitest';
import { positionAfter, positionBetween } from './position';

describe('positionBetween', () => {
  it('creates first key', () => {
    expect(positionBetween(null, null)).toBe('V');
  });
  it('is always strictly between', () => {
    const cases: [string | null, string | null][] = [
      [null, 'V'], ['V', null], ['V', 'W'], ['V1', 'V2'], ['Vz', 'W'], ['a', 'a1'], [null, '1'], ['z', null], ['zz', null], [null, '01'],
    ];
    for (const [a, b] of cases) {
      const k = positionBetween(a, b);
      if (a) expect(k > a).toBe(true);
      if (b) expect(k < b).toBe(true);
      expect(k.endsWith('0')).toBe(false);
    }
  });
  it('survives 500 inserts at the front, the back and the same gap', () => {
    let lo: string | null = null;
    let hi: string | null = null;
    let a = positionBetween(null, null);
    let b = positionBetween(a, null);
    for (let i = 0; i < 500; i++) {
      lo = positionBetween(null, lo ?? a);
      hi = positionBetween(hi ?? b, null);
      const m = positionBetween(a, b);
      expect(m > a && m < b).toBe(true);
      if (i % 2) a = m; else b = m;
    }
    expect(lo! < a).toBe(true);
  });
  it('rejects bad order', () => {
    expect(() => positionBetween('b', 'a')).toThrow();
  });
  it('positionAfter picks the max', () => {
    expect(positionAfter(['V', 'b', null, 'X']) > 'b').toBe(true);
  });
});
