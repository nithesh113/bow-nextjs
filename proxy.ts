import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/constants'

/**
 * Auth middleware (proxy.ts is Next 16's middleware filename).
 *
 * Responsibility: gate every protected route through a single
 * authentication check.
 *
 * Two distinct guards:
 *
 *   PROTECTED_PATHS  – require a session, otherwise → /login
 *   PUBLIC_PATHS     – always reachable; never redirect based on cookie
 *
 * Bug fix 2026-07-14: previously PUBLIC_PATHS bounced logged-in
 * users away to /dashboard. With a leftover/stale cookie whose
 * session row no longer exists (e.g. after a DB wipe), this
 * produced a 3-step redirect loop:
 *
 *   /register → /dashboard → /login → /dashboard (loop!)
 *
 * because middleware saw the cookie, sent to /dashboard, server
 * component saw no session, redirected to /login, middleware
 * saw the cookie again, sent to /dashboard. With public-path
 * hardening gone, those pages now render whatever login/register
 * state React/Next decides — and /login's redirect-to-dashboard
 * sits only inside `useEffect`/server-component logic, never in
 * middleware.
 *
 * The kept-on-success behaviour (already-logged-in users skipping
 * the login page) is preserved for `/` (root) only — minor UX cost
 * everywhere else.
 */

// Routing categories: only ACTUAL protected paths are 307'd when
// the cookie is absent. The PUBLIC list here is reset to NOT include
// /login or /register so they are never bounced through middleware.
const PROTECTED_PATHS = ['/dashboard']
// Routes that 302→/dashboard if you already have a (valid) cookie.
// '/login' and '/register' are deliberately absent — see comment above.
const REDIRECT_IF_AUTHED = new Set(['/'])

function isUnder(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`)
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value)

  // 1) Protected path, no session? → /login
  const isProtected = PROTECTED_PATHS.some((p) => isUnder(pathname, p))
  if (!hasSession && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 2) Root with a session? → /dashboard (still useful UX).
  //    Note: this is the ONLY path we bounce automically; we no longer
  //    redirect /login or /register. /verify is a POST-after-verification
  //    hand-off and is handled by its own routes.
  if (hasSession && REDIRECT_IF_AUTHED.has(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json).*)'],
}
