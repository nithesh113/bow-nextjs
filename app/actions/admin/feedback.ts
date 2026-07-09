'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/auth/guards'
import { FEEDBACK_STATUSES } from '@/lib/auth/feedback'

/**
 * Admin read + workflow for UserFeedback (Plan §26).
 *
 * The admin UI exposes a status filter (NEW / REVIEWING / PLANNED /
 * IN_PROGRESS / COMPLETED / REJECTED) and a workflow action to
 * flip status on a single row. `status` is stored as a string so
 * the workflow vocabulary can evolve without a schema migration.
 *
 * NOTE on Next 16 `use server` rule: only async functions may be
 * exported from a `use server` module. The constants below live in
 * a sibling file (`lib/auth/feedback.ts`) which the client bundle
 * imports for its UI vocabulary.
 */

export interface AdminFeedbackRow {
  id: string
  type: 'REVIEW' | 'FEATURE' | 'BUG' | 'OTHER'
  status: string
  rating: number | null
  message: string
  page: string | null
  createdAt: Date
  user: { id: string; name: string; email: string }
}

export interface ListFeedbackFilters {
  search?: string
  statusFilter?: 'all' | string
  typeFilter?: 'all' | string
  page?: number
  pageSize?: number
}

export interface AdminFeedbackPage {
  rows: AdminFeedbackRow[]
  total: number
  page: number
  pageSize: number
}

const DEFAULT_PAGE_SIZE = 25

export async function listFeedback(
  filters: ListFeedbackFilters = {}
): Promise<AdminFeedbackPage> {
  await requireAdmin()
  const {
    search = '',
    statusFilter = 'all',
    typeFilter = 'all',
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = filters

  const where: any = {}
  if (search.trim()) {
    const q = search.trim()
    where.OR = [
      { message: { contains: q, mode: 'insensitive' } },
      { user: { is: { OR: [
        { name:  { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ] } } },
    ]
  }
  if (statusFilter !== 'all') where.status = statusFilter
  if (typeFilter !== 'all')   where.type   = typeFilter

  const skip = (Math.max(1, page) - 1) * pageSize
  const [total, rows] = await Promise.all([
    prisma.userFeedback.count({ where }),
    prisma.userFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, type: true, status: true, rating: true,
        message: true, page: true, createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
      skip, take: pageSize,
    }),
  ])

  return {
    rows: rows.map((r) => ({
      id: r.id,
      type: r.type as 'REVIEW' | 'FEATURE' | 'BUG' | 'OTHER',
      status: r.status,
      rating: r.rating,
      message: r.message,
      page: r.page,
      createdAt: r.createdAt,
      user: r.user,
    })),
    total, page, pageSize,
  }
}

export async function setFeedbackStatus(
  feedbackId: string,
  nextStatus: string
): Promise<{ success: boolean; error?: string }> {
  const admin = await requireAdmin()
  if (!(FEEDBACK_STATUSES as readonly string[]).includes(nextStatus)) {
    return { success: false, error: `Status '${nextStatus}' is not valid.` }
  }
  const target = await prisma.userFeedback.findUnique({
    where: { id: feedbackId },
    select: { id: true, status: true, userId: true },
  })
  if (!target) return { success: false, error: 'Feedback not found.' }
  if (target.status === nextStatus) {
    return { success: true } // idempotent no-op
  }

  await prisma.userFeedback.update({
    where: { id: target.id },
    data: { status: nextStatus },
  })

  // Audit trail entry (admin only). One of the goals of v7.1's
  // audit infrastructure: every admin state-mutation here logs.
  try {
    await prisma.adminAuditLog.create({
      data: {
        adminUserId: admin.id,
        action: 'admin.set_feedback_status',
        targetType: 'user_feedback',
        targetId: target.id,
        metadata: { before: target.status, after: nextStatus, submittedByUserId: target.userId },
      },
    })
  } catch (err) {
    // Same tolerate-audit-fail policy as the support actions.
    console.error('[audit] set_feedback_status failed:', err)
  }

  revalidatePath('/admin/feedback')
  return { success: true }
}
