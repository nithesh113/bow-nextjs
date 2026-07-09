import 'server-only'
import { prisma } from './prisma'
import { Prisma } from '@prisma/client'

/**
 * Best-effort audit log writer.
 *
 * Plan §13 records every admin-initiated mutation. The set of
 * actionable keys lives at the call sites (NOT centralised here)
 * so that adding a new admin action requires both the action and
 * a literal action key — TypeScript will catch typos because each
 * call site passes its own string and a "found actions" grep is
 * trivial.
 *
 * The shape:
 *   - adminUserId : who did it
 *   - action      : short stable identifier, e.g. 'admin.force_logout'
 *   - targetType  : 'user' | 'session' | 'feature_flag' | null
 *   - targetId    : the affected row id (string for portability)
 *   - metadata    : free-form JSON, e.g. { before, after } for
 *                   role flips, or { count: N } for bulk deletes
 *
 * Errors are surfaced to the caller via thrown Error so a failed
 * audit write doesn't silently drop. Callers decide whether the
 * surrounding action is critical enough to roll back the change
 * (today: audit failures are tolerated because losing a single
 * audit row is far better than losing a real admin action).
 */
export type AdminAuditAction =
  | 'admin.resend_verification'
  | 'admin.force_logout_user'
  | 'admin.set_user_role'
  | 'admin.set_feedback_status'

export type AdminAuditTargetType = 'user' | null

export interface LogAdminActionInput {
  adminUserId: string
  action: AdminAuditAction
  targetType?: AdminAuditTargetType
  targetId?: string | null
  metadata?: Record<string, unknown>
}

export async function logAdminAction(input: LogAdminActionInput): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: input.adminUserId,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    })
  } catch (err) {
    // Surface so the caller can decide. Don't swallow silently —
    // that's the bug we're trying to prevent with audit entries.
    throw new Error(
      `audit log write failed for ${input.action}: ${(err as Error).message}`
    )
  }
}
