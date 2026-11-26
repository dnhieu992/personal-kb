import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Stateless session token: `<expMillis>.<hmac(expMillis)>`. No session table — single
 * user, and rotating SESSION_SECRET logs everyone (me) out.
 */
export function signSession(expiresAt: number, secret: string): string {
  const payload = String(expiresAt);
  return `${payload}.${mac(payload, secret)}`;
}

/** Returns the expiry if the token is authentic and not expired, else null. */
export function verifySession(token: string | undefined, secret: string, now = Date.now()): number | null {
  if (!token) return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const want = Buffer.from(mac(payload, secret));
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > now ? exp : null;
}

function mac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(`pkb-session:${payload}`).digest('base64url');
}
