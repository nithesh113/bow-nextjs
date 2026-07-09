/**
 * Server-side guards for the admin route group.
 *
 * Plan §17 (security): "Check admin role on the server. Never trust
 * client-side role checks only. Redirect normal users away from /admin."
 *
 * Both helpers throw via Next.js `redirect()` and only return on the
 * happy path. They are intended to be awaited at the top of every
 * server component / page handler under /app/admin/...
 */
import { redirect } from 'next/navigation'
import { getCurrentUser, type AuthUser } from './session'

export class AuthGuardError extends Error {
  constructor(public readonly reason: 'unauthenticated' | 'forbidden') {
    super(reason)
  }
}

/**
 * Returns the current user, redirecting to /login if not signed in.
 * Use this anywhere a normal page needs the AuthUser.
 */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

/**
 * Returns the current user only when they are an ADMIN, otherwise
 * redirects to /dashboard. Use this at the top of every page under
 * app/admin/ — both server-component pages and route handlers.
 *
 * Returning (rather than throwing) keeps the call site one line:
 *   const admin = await requireAdmin()
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'ADMIN') redirect('/dashboard')
  return user
}
