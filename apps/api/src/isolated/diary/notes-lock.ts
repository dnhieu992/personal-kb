import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Unlock tokens for My Notes: `<expMillis>.<hmac>`, keyed by the session secret AND the current
 * passcode hash — so changing the passcode invalidates every open unlock, and a session cookie can
 * never pass as a notes token (different message prefix).
 */
export const UNLOCK_TTL_MS = 30 * 60_000;

export function signUnlock(exp: number, secret: string, passcodeHash: string): string {
  return `${exp}.${mac(String(exp), secret, passcodeHash)}`;
}

export function verifyUnlock(token: string | undefined, secret: string, passcodeHash: string, now = Date.now()): boolean {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const want = Buffer.from(mac(payload, secret, passcodeHash));
  if (given.length !== want.length || !timingSafeEqual(given, want)) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > now;
}

function mac(payload: string, secret: string, passcodeHash: string): string {
  return createHmac('sha256', secret).update(`pkb-notes-unlock:${passcodeHash}:${payload}`).digest('base64url');
}
