'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/auth/prisma'
import { getCurrentUser, createToken, hashToken } from '@/lib/auth/session'
import { sendVerificationEmail } from '@/lib/auth/verify-email-temp'
import { appUrl as makeAppUrl } from '@/lib/auth/urls'

export async function updateAccount(data: { name: string; email: string; currency: string; location: string; schoolFee: number }) {
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
        schoolFee: data.schoolFee,
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

  const emailRes = await sendVerificationEmail(email, makeAppUrl(`/verify-email?token=${token}`))

  if (!emailRes.success) {
    return { success: false, error: `Failed to send email: ${emailRes.error}` }
  }

  return { success: true, message: 'Verification email sent! Check your inbox.' }
}

/** Persist the user's preference for per-minute (actual-times) pay tracking.
 *  The value is stored on `User.actualTimesEnabled`; the client mirrors it
 *  in `useAppStore` after AppShell's `hydratePerMinutePay` call so the FAB
 *  per-minute section can reflect the preference before the network round
 *  trip completes. There is no `localStorage` participation in v6.4. */
export async function setActualTimesEnabled(enabled: boolean): Promise<{ success: boolean; enabled?: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated.' }
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { actualTimesEnabled: !!enabled },
    })
    revalidatePath('/dashboard')
    return { success: true, enabled: !!enabled }
  } catch (err) {
    console.error('[setActualTimesEnabled] update failed', err)
    return { success: false, error: 'Failed to save preference.' }
  }
}
