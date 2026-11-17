import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Auth protection for all LeadCaller pages + API routes.
 *
 * Replaces next-auth's withAuth wrapper, which never intercepted requests in
 * this stack (Next 16 standalone + basePath): every page rendered publicly
 * while the APIs returned 401, leaving a broken public shell. This mirrors
 * the main CRM's hand-written middleware (proven live): valid session token
 * passes; API calls get a JSON 401; pages redirect to /login.
 *
 * Public by design (own auth / signatures): /api/auth, /api/webhooks,
 * /api/engine (cron), /api/mcp, /login, Next statics.
 */
export default async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET || 'default_dev_secret_change_me_in_prod',
  });
  if (token) return NextResponse.next();

  if (pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Sign-in URL must keep the mount prefix: new URL('/login', ...) resolves
  // against the domain root, which is the main CRM (404). nextUrl.basePath
  // carries this app's prefix (/leadcaller).
  const signInUrl = new URL(`${req.nextUrl.basePath || ''}/login`, req.url);
  signInUrl.searchParams.set('callbackUrl', pathname + search);
  const res = NextResponse.redirect(signInUrl);
  // Break stale-cookie loops: if a session cookie was sent but failed
  // verification (e.g. secret rotated), the browser would keep resending it
  // alongside the fresh login cookie and bounce off every page. Clear both
  // cookie spellings so the next login sticks.
  if (req.cookies.has('next-auth.session-token') || req.cookies.has('__Secure-next-auth.session-token')) {
    res.cookies.delete('next-auth.session-token');
    res.cookies.delete('__Secure-next-auth.session-token');
  }
  return res;
}

export const config = {
  matcher: [
    '/',
    '/((?!api/auth|api/webhooks|api/engine|api/mcp|_next/static|_next/image|favicon.ico|login).*)',
  ],
};
