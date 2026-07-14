'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/auth/prisma'
import { getCurrentUser, createToken, hashToken } from '@/lib/auth/session'
import { sendVerificationEmail } from '@/lib/auth/verify-email-temp'
import { appUrl as makeAppUrl } from '@/lib/auth/urls'
import { coerceHandle, RESERVED } from '@/lib/userHandle'

/**
 * Live uniqueness check used by the client registration form.
 * Returns the normalized handle on success, with availability info.
 * Client should call this debounced (350ms) as the user types.
 */
export async function checkUserHandleAvailability(
  rawHandle: string
): Promise<{ available: boolean; normalized: string; error?: string }> {
  const result = coerceHandle(rawHandle)
  if (result.ok === false) {
    return { available: false, normalized: '', error: result.error }
  }
  const normalized = result.normalized

  // Reserved words short-circuit (no DB hit needed)
  if (RESERVED.has(normalized)) {
    return { available: false, normalized, error: 'That handle is reserved.' }
  }

  // Case-insensitive query: leverage User.userId text column with
  // LOWER(...) in metadata so Prisma routes the lookup via the
  // `users_user_id_lower_unique_idx` expression index. We use the
  // simplest correct form: fetch any matching row with same lower-case.
  try {
    const existing = await prisma.user.findFirst({
      where: { userId: { equals: normalized } },
      select: { id: true },
    })
    if (existing) {
      return { available: false, normalized, error: 'That handle is taken.' }
    }
    return { available: true, normalized }
  } catch (err) {
    console.error('[checkUserHandleAvailability] failed', err)
    return { available: false, normalized, error: 'Lookup failed. Try again.' }
  }
}

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

/**
 * Apply the profile-level prefs from a backup bundle without touching
 * identity fields. Import flows call this so the receiving user gets the
 * source device's currency/location/schoolFee target but NOT their name
 * or email — those are intentionally per-account.
 */
export async function applyProfilePrefs(data: {
  currency?: string
  location?: string
  schoolFee?: number
} = {}): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  try {
    const patch: Record<string, unknown> = {}
    if (typeof data.currency === 'string' && data.currency.trim().length > 0) {
      patch.currency = data.currency.trim()
    }
    if (typeof data.location === 'string' && data.location.trim().length > 0) {
      patch.location = data.location.trim()
    }
    if (Number.isFinite(data.schoolFee) && (data.schoolFee as number) > 0) {
      patch.schoolFee = data.schoolFee as number
    }
    if (Object.keys(patch).length === 0) return { success: true }
    await prisma.user.update({ where: { id: user.id }, data: patch })
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Error applying profile prefs:', error)
    return { success: false, error: 'Failed to apply profile preferences.' }
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
