import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/auth/prisma'
import { hashToken, createSession } from '@/lib/auth/session'
import { sendWelcomeEmail } from '@/lib/auth/welcome-temp'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=MissingToken', req.url))
  }

  const verificationToken = await prisma.verificationToken.findFirst({
    where: {
      token: hashToken(token),
      expiresAt: { gt: new Date() }
    }
  })

  if (!verificationToken) {
    return NextResponse.redirect(new URL('/login?error=InvalidOrExpiredToken', req.url))
  }

  const user = await prisma.user.findUnique({
    where: { email: verificationToken.identifier }
  })

  if (!user) {
    return NextResponse.redirect(new URL('/login?error=UserNotFound', req.url))
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() }
    }),
    prisma.verificationToken.delete({
      where: { id: verificationToken.id }
    })
  ])

  try {
    await sendWelcomeEmail(user.email, user.name)
  } catch (e) {
    console.error('Error sending welcome email', e)
  }
  
  await createSession(user.id)

  return NextResponse.redirect(new URL('/dashboard', req.url))
}
