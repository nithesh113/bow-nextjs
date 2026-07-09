'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSession, createToken, destroySession, hashToken } from '@/lib/auth/session'
import { sendPasswordResetEmail } from '@/lib/auth/forget-passwordtemp'
import { sendWelcomeEmail } from '@/lib/auth/welcome-temp'
import { sendVerificationEmail } from '@/lib/auth/verify-email-temp'
import { sendPasswordChangedEmail } from '@/lib/auth/reset-secuess'
import { prisma } from '@/lib/auth/prisma'
import { appUrl as makeAppUrl } from '@/lib/auth/urls'

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

function getStrength(pw: string): number {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  return Math.min(5, score)
}

export async function registerAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const name = readString(formData, 'name')
  const email = normalizeEmail(readString(formData, 'email'))
  const password = String(formData.get('password') || '')
  const confirmPassword = String(formData.get('confirmPassword') || '')

  if (!name || !email || !password) return { error: 'Fill in all fields.' }
  if (password !== confirmPassword) return { error: 'Passwords do not match.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }
  if (getStrength(password) < 3) return { error: 'Password is too weak. Use a mix of uppercase, lowercase, numbers, and symbols.' }

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

  const token = createToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashToken(token),
      expiresAt,
    },
  })

  const emailRes = await sendVerificationEmail(email, makeAppUrl(`/verify-email?token=${token}`), user.id)
  await sendWelcomeEmail(email, name, user.id)

  if (!emailRes.success) {
    // Delete the user and token so they can try again
    await prisma.verificationToken.delete({ where: { token: hashToken(token) } })
    await prisma.user.delete({ where: { id: user.id } })
    return { error: `Failed to send verification email: ${emailRes.error}` }
  }

  redirect(`/verify?email=${encodeURIComponent(email)}`)
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
  redirect('/dashboard')
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

    await sendPasswordResetEmail(email, makeAppUrl(`/reset-password?token=${token}`), user.id)
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
    select: { 
      id: true, 
      userId: true,
      user: {
      select: {
        email: true,
        name: true,
        }
       },
    }, 
  })
  if (!resetToken) return { error: 'This reset link is invalid or expired.' }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: resetToken.userId } }),
  ])

  await sendPasswordChangedEmail(resetToken.user.email, resetToken.user.name, resetToken.userId)
  await createSession(resetToken.userId)

  redirect('/dashboard')
}

export async function logoutAction() {
  await destroySession()
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function resendVerificationAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const email = normalizeEmail(readString(formData, 'email'))
  if (!email) return { error: 'Please enter your email address.' }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  })

  if (!user) {
    // Return generic message to avoid email enumeration
    return { success: 'If an unverified account exists for this email, a new link has been sent.' }
  }

  if (user.emailVerified) {
    return { error: 'This email address is already verified. Please log in.' }
  }

  // Delete any existing verification tokens for this email
  await prisma.verificationToken.deleteMany({ where: { identifier: email } })

  const token = createToken()
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: hashToken(token),
      expiresAt,
    },
  })

  const emailRes = await sendVerificationEmail(
    email,
    makeAppUrl(`/verify-email?token=${token}`),
    user.id
  )

  if (!emailRes.success) {
    return { error: `Failed to send email: ${emailRes.error}` }
  }

  return { success: 'A new verification link has been sent to your email!' }
}
