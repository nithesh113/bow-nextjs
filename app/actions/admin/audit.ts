'use server'

import { prisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/auth/guards'

/**
 * Admin audit-log read. Pagination by recency (created_at desc).
 * Searchable by action key fragment and target id. No filtering
 * by admin yet — that's a deferred follow-up.
 *
 * Joins adminUser to surface the actor's email/name inline.
 */
export interface AdminAuditLogListRow {
  id: string
  action: string
  targetType: string | null
  targetId: string | null
  metadata: unknown
  createdAt: Date
  admin: { id: string; name: string; email: string }
}

export interface ListAuditLogFilters {
  search?: string
  page?: number
  pageSize?: number
}

export interface AdminAuditLogPage {
  rows: AdminAuditLogListRow[]
  total: number
  page: number
  pageSize: number
}

const DEFAULT_PAGE_SIZE = 25

export async function listAuditLog(
  filters: ListAuditLogFilters = {}
): Promise<AdminAuditLogPage> {
  await requireAdmin()
  const {
    search = '',
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = filters

  const where: any = {}
  if (search.trim()) {
    const q = search.trim()
    // Action keys are short, deterministic strings like
    // `admin.resend_verification`. We let the operator search
    // by action, target id, or admin email/name in one box.
    where.OR = [
      { action:   { contains: q, mode: 'insensitive' } },
      { targetId: { contains: q, mode: 'insensitive' } },
      { adminUser: { is: { OR: [
        { name:  { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ] } } },
    ]
  }

  const skip = (Math.max(1, page) - 1) * pageSize

  const [total, rows] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, action: true, targetType: true, targetId: true,
        metadata: true, createdAt: true,
        adminUser: { select: { id: true, name: true, email: true } },
      },
      skip, take: pageSize,
    }),
  ])

  return {
    rows: rows.map((r) => ({
      id: r.id,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      metadata: r.metadata as unknown,
      createdAt: r.createdAt,
      admin: r.adminUser,
    })),
    total, page, pageSize,
  }
}
