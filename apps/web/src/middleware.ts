import { NextResponse, type NextRequest } from 'next/server';

/**
 * UX only: bounce to /login when there is no session cookie. The real protection is the
 * API's global guard — a forged cookie still gets 401 there.
 */
export function middleware(req: NextRequest) {
  if (req.cookies.has('pkb_session')) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname + req.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!login|api/|_next/|favicon).*)'] };
