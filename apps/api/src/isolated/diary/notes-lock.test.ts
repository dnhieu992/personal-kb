import { describe, expect, it } from 'vitest';
import { signUnlock, verifyUnlock } from './notes-lock';

describe('notes unlock token', () => {
  const now = 1_700_000_000_000;
  it('accepts a fresh token for the same passcode hash', () => {
    expect(verifyUnlock(signUnlock(now + 1000, 's', 'h1'), 's', 'h1', now)).toBe(true);
  });
  it('rejects after the passcode changed, after expiry, and with a wrong secret', () => {
    const t = signUnlock(now + 1000, 's', 'h1');
    expect(verifyUnlock(t, 's', 'h2', now)).toBe(false);
    expect(verifyUnlock(t, 's', 'h1', now + 2000)).toBe(false);
    expect(verifyUnlock(t, 'other', 'h1', now)).toBe(false);
    expect(verifyUnlock(undefined, 's', 'h1', now)).toBe(false);
    expect(verifyUnlock('garbage', 's', 'h1', now)).toBe(false);
  });
});
