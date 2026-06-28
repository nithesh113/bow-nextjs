import { cookies } from 'next/headers'
import crypto from 'crypto'
import { prisma } from './prisma'
import { SESSION_COOKIE } from './constants'

const SESSION_DAYS = 30

export type AuthUser = {
  id: string
  name: string
  email: string
  currency: string | null
  location: string | null
  schoolFee: number
  emailVerified: Date | null
  actualTimesEnabled: boolean
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function createToken() {
  return crypto.randomBytes(32).toString('base64url')
}

export async function createSession(userId: string) {
  const token = createToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  })

  const cookieStore = await cookies()
  // Only mark Secure when the request is actually over HTTPS. Mobile devices on
  // LAN IPs (http://192.168.x.x:3000) need a non-Secure cookie to stay logged
  // in; HTTPS deployments still get the Secure flag automatically.
  //
  // Always `secure` in production. Vercel serves HTTPS at the load
  // balancer; an HTTP-on-LAN dev session needs the secure flag off so
  // the cookie sticks. NODE_ENV drives this — not APP_URL — to
  // decouple the cookie security posture from the canonical app URL.
  const isHttps = process.env.NODE_ENV === 'production'
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    expires: expiresAt,
  })
}

export async function destroySession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  }

  cookieStore.delete(SESSION_COOKIE)
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await prisma.session.findFirst({
    where: {
      tokenHash: hashToken(token),
      expiresAt: { gt: new Date() },
    },
    select: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          currency: true,
          location: true,
          schoolFee: true,
          emailVerified: true,
          actualTimesEnabled: true,
        },
      },
    },
  })

  return session?.user || null
}
