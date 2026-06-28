/**
 * Single source of truth for "where is the app reachable".
 *
 * Vercel deployments serve HTTPS at a stable URL (vercel.app or a custom
 * domain); the same URL is embedded into verification / password-reset /
 * "your password changed" emails so that users land back on this exact
 * deployment and not localhost.
 *
 * Why this helper exists at all:
 *   - Before this, every call site did `process.env.APP_URL || 'http://localhost:3000'`.
 *     In a Vercel prod build that forgot to set APP_URL, every email link
 *     silently pointed at `localhost:3000` and the user got cryptic timeouts.
 *   - `lib/auth/reset-secuess.ts` was reading `NEXT_PUBLIC_APP_URL` instead
 *     of `APP_URL` — two env vars for the same purpose is a footgun, so
 *     this helper accepts either.
 *   - The cookie `secure` flag was driven by `APP_URL.startsWith('https://')`
 *     which conflates URL with transport. We now drive it from
 *     `NODE_ENV === 'production'` (Vercel is always HTTPS at the load
 *     balancer), see `lib/auth/session.ts`.
 *
 * Behaviour:
 *   - In production with no APP_URL set, `getAppUrl()` throws so we fail
 *     loudly at runtime instead of sending broken emails.
 *   - In development, falls back to http://localhost:3000 so local devs
 *     don't need to set anything.
 *   - Trailing slashes are trimmed; leading slashes on `path` are
 *     preserved.
 */

/** Trim trailing slashes; collapse repeated slashes. Normalises user input. */
function normalise(raw: string): string {
  return raw.replace(/\/+$/, '').replace(/\/{2,}/g, '/')
}

export function getAppUrl(): string {
  const raw =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    ''
  const url = normalise(raw)
  if (url) return url

  if (process.env.NODE_ENV === 'production') {
    // Loud failure in prod — broken emails are a silent outage otherwise.
    throw new Error(
      'APP_URL is required in production for verification / password-reset / ' +
        '"your password changed" emails. Set it to your deployment URL '
        + '(no trailing slash), e.g. https://bow-app.vercel.app'
    )
  }
  return 'http://localhost:3000'
}

/** Build an absolute URL from a path. Tolerant to leading `/`. */
export function appUrl(path: string): string {
  const base = getAppUrl()
  const tail = path.startsWith('/') ? path : `/${path}`
  return `${base}${tail}`
}

/** Vercel load balancer is always HTTPS in production; cookies can be `secure`. */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}
