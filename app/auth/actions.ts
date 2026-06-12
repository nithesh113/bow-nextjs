'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { createSession, createToken, destroySession, hashToken } from '@/lib/auth/session'
import { sendPasswordResetEmail } from '@/lib/auth/email'
import { prisma } from '@/lib/auth/prisma'

export type AuthActionState = {
  error?: string
  success?: string
}

function readString(formData: FormData, key: string) {
  return String(formData.get(key) || '').trim()
}

function normalizeEmail(email: string) {
  return email.toLowerCase()
}

export async function registerAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const name = readString(formData, 'name')
  const email = normalizeEmail(readString(formData, 'email'))
  const password = String(formData.get('password') || '')

  if (!name || !email || !password) return { error: 'Fill in all fields.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) return { error: 'An account already exists for this email.' }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
    },
    select: { id: true },
  })

  await createSession(user.id)
  redirect('/')
}

export async function loginAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = normalizeEmail(readString(formData, 'email'))
  const password = String(formData.get('password') || '')

  if (!email || !password) return { error: 'Enter your email and password.' }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  })
  if (!user) return { error: 'Invalid email or password.' }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return { error: 'Invalid email or password.' }

  await createSession(user.id)
  redirect('/')
}

export async function forgotPasswordAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = normalizeEmail(readString(formData, 'email'))
  if (!email) return { error: 'Enter your email address.' }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })

  if (user) {
    const token = createToken()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt,
      },
    })

    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    await sendPasswordResetEmail(email, `${appUrl}/reset-password?token=${token}`)
  }

  return { success: 'If an account exists, a reset link has been sent.' }
}

export async function resetPasswordAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const token = String(formData.get('token') || '')
  const password = String(formData.get('password') || '')

  if (!token) return { error: 'Reset token is missing.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash: hashToken(token),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, userId: true },
  })
  if (!resetToken) return { error: 'This reset link is invalid or expired.' }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: resetToken.userId } }),
  ])
  await createSession(resetToken.userId)

  redirect('/')
}

export async function logoutAction() {
  await destroySession()
  redirect('/login')
}
