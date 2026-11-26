import type { NextRequest } from 'next/server';

/**
 * Same-origin proxy: browser → /api/* (this route) → API on 127.0.0.1. No CORS, the API
 * port is never public, cookies flow both ways. Bodies are streamed (uploads in dev).
 */
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4201';
const HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'te', 'upgrade', 'proxy-authorization', 'host', 'content-length']);

export const dynamic = 'force-dynamic';

async function proxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  const target = `${API_URL}/api/${params.path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;
  const headers = new Headers();
  req.headers.forEach((v, k) => !HOP.has(k.toLowerCase()) && headers.set(k, v));
  const fwd = req.headers.get('x-forwarded-for');
  headers.set('x-forwarded-for', fwd ?? req.ip ?? '127.0.0.1');
  const hasBody = !['GET', 'HEAD'].includes(req.method);
  const res = await fetch(target, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    redirect: 'manual',
    cache: 'no-store',
    // @ts-expect-error — required by Node fetch to stream a request body
    duplex: hasBody ? 'half' : undefined,
  });
  const out = new Headers();
  res.headers.forEach((v, k) => {
    if (!HOP.has(k.toLowerCase()) && k.toLowerCase() !== 'set-cookie' && k.toLowerCase() !== 'content-encoding') out.set(k, v);
  });
  for (const c of res.headers.getSetCookie?.() ?? []) out.append('set-cookie', c);
  return new Response(res.body, { status: res.status, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
