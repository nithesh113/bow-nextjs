'use server'

import { prisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/auth/guards'

/**
 * Admin email-log read.
 *
 * Plan §32 — the support team's view of every transactional email
 * the app has tried to send. Filterable by status (sent | failed)
 * and free-text search on type or recipient email. Pagination by
 * recency.
 *
 * Sort is on createdAt desc — newest first because admins
 * usually come here when a user reports "I didn't get my email"
 * and the timeframe is recent.
 */
export interface AdminEmailLogRow {
  id: string
  to: string
  type: string
  status: 'sent' | 'failed'
  providerMessageId: string | null
  error: string | null
  subject: string | null
  createdAt: Date
}

export interface ListEmailLogFilters {
  search?: string
  statusFilter?: 'all' | 'sent' | 'failed'
  page?: number
  pageSize?: number
}

export interface AdminEmailLogPage {
  rows: AdminEmailLogRow[]
  total: number
  page: number
  pageSize: number
}

const DEFAULT_PAGE_SIZE = 25

export async function listEmailLog(
  filters: ListEmailLogFilters = {}
): Promise<AdminEmailLogPage> {
  await requireAdmin()
  const {
    search = '',
    statusFilter = 'all',
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = filters

  const where: any = {}
  if (search.trim()) {
    const q = search.trim()
    where.OR = [
      { type:    { contains: q, mode: 'insensitive' } },
      { to:      { contains: q, mode: 'insensitive' } },
      { subject: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (statusFilter === 'sent' || statusFilter === 'failed') {
    where.status = statusFilter
  }

  const skip = (Math.max(1, page) - 1) * pageSize
  const [total, rows] = await Promise.all([
    prisma.emailLog.count({ where }),
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, to: true, type: true, status: true,
        providerMessageId: true, error: true, subject: true,
        createdAt: true,
      },
      skip, take: pageSize,
    }),
  ])

  return {
    rows: rows.map((r) => ({
      id: r.id,
      to: r.to,
      type: r.type,
      status: r.status as 'sent' | 'failed',
      providerMessageId: r.providerMessageId,
      error: r.error,
      subject: r.subject,
      createdAt: r.createdAt,
    })),
    total, page, pageSize,
  }
}
