'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/auth/guards'
import { createToken, hashToken } from '@/lib/auth/session'
import { sendVerificationEmail } from '@/lib/auth/verify-email-temp'
import { appUrl as makeAppUrl } from '@/lib/auth/urls'
import { logAdminAction } from '@/lib/auth/audit'

/**
 * Admin support actions (Plan §11 / §17).
 *
 * All three helpers:
 *   - re-verify requireAdmin() inside as defense in depth,
 *   - write an audit entry on success,
 *   - return a structured `{ success, error?, ... }` shape so
 *     the detail page can surface failures as Sonner toasts.
 *
 * On partial-failure semantics: if the underlying mutation
 * succeeds and the audit log write fails, we surface the error
 * to the caller rather than swallowing it — losing a single
 * audit row is acceptable, but a silent audit gap is not.
 */
const EMAIL_EXPIRY_MS = 24 * 60 * 60 * 1000

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase()
}

// ── 1. Resend verification email to a target user ─────────────
export async function adminResendVerification(
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, email: true, emailVerified: true, name: true },
  })
  if (!target) return { success: false, error: 'User not found.' }
  if (target.emailVerified) {
    return { success: false, error: 'User is already verified.' }
  }

  // Replace any existing pending tokens for this identifier so the
  // old link doesn't remain valid in addition to the new one.
  await prisma.verificationToken.deleteMany({ where: { identifier: target.email } })

  const token = createToken()
  const expiresAt = new Date(Date.now() + EMAIL_EXPIRY_MS)
  await prisma.verificationToken.create({
    data: {
      identifier: target.email,
      token: hashToken(token),
      expiresAt,
    },
  })

  const emailRes = await sendVerificationEmail(
    target.email,
    makeAppUrl(`/verify-email?token=${token}`)
  )
  if (!emailRes.success) {
    await prisma.verificationToken.deleteMany({ where: { identifier: target.email } })
    return { success: false, error: `Failed to send email: ${emailRes.error}` }
  }

  await logAdminAction({
    adminUserId: admin.id,
    action: 'admin.resend_verification',
    targetType: 'user',
    targetId: target.id,
    metadata: { email: target.email },
  }).catch((err) => console.error('[audit] resend_verification failed:', err))

  revalidatePath(`/admin/users/${target.id}`)
  return { success: true }
}

// ── 2. Force logout a user (revoke all their sessions) ────────
export async function adminForceLogoutUser(
  targetUserId: string
): Promise<{ success: boolean; revokedCount?: number; error?: string }> {
  const admin = await requireAdmin()
  if (targetUserId === admin.id) {
    return { success: false, error: 'Refusing to force-logout yourself.' }
  }
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  })
  if (!target) return { success: false, error: 'User not found.' }

  const { count } = await prisma.session.deleteMany({ where: { userId: target.id } })

  await logAdminAction({
    adminUserId: admin.id,
    action: 'admin.force_logout_user',
    targetType: 'user',
    targetId: target.id,
    metadata: { revokedSessions: count },
  }).catch((err) => console.error('[audit] force_logout_user failed:', err))

  revalidatePath(`/admin/users/${target.id}`)
  return { success: true, revokedCount: count }
}

// ── 3. Promote/demote a user's role ────────────────────────────
export async function adminSetUserRole(
  targetUserId: string,
  nextRole: 'USER' | 'ADMIN'
): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (targetUserId === admin.id) {
    return { success: false, error: 'Refusing to change your own role via this action.' }
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true },
  })
  if (!target) return { success: false, error: 'User not found.' }
  if (target.role === nextRole) {
    return { success: false, error: `User is already ${nextRole}.` }
  }

  await prisma.user.update({ where: { id: target.id }, data: { role: nextRole } })

  await logAdminAction({
    adminUserId: admin.id,
    action: 'admin.set_user_role',
    targetType: 'user',
    targetId: target.id,
    metadata: { before: target.role, after: nextRole },
  }).catch((err) => console.error('[audit] set_user_role failed:', err))

  revalidatePath(`/admin/users/${target.id}`)
  revalidatePath('/admin/users') // role badge changed in the list too
  return { success: true }
}
