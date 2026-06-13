'use server'

import { prisma } from '@/lib/auth/prisma'
import { getCurrentUser, createToken, hashToken } from '@/lib/auth/session'
import { sendVerificationEmail } from '@/lib/auth/verify-email-temp'

export async function updateAccount(data: { name: string; email: string; currency: string; location: string }) {
  const user = await getCurrentUser()
  
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: data.name,
        email: data.email,
        currency: data.currency,
        location: data.location,
      }
    })
    return { success: true }
  } catch (error) {
    console.error('Error updating account:', error)
    return { success: false, error: 'Failed to update account. Email might already be taken.' }
  }
}

export async function resendVerificationEmailAction(email: string) {
  const user = await getCurrentUser()

  if (!user) {
    return { success: false, error: 'Not authenticated.' }
  }

  if (user.emailVerified) {
    return { success: false, error: 'Your email is already verified.' }
  }

  // Delete any existing tokens for this email
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

  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const emailRes = await sendVerificationEmail(email, `${appUrl}/verify-email?token=${token}`)

  if (!emailRes.success) {
    return { success: false, error: `Failed to send email: ${emailRes.error}` }
  }

  return { success: true, message: 'Verification email sent! Check your inbox.' }
}
