import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/constants'

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value)

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json).*)'],
}
