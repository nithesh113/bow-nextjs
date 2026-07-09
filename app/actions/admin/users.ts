'use server'

import { prisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/auth/guards'

/**
 * Admin user-management read paths.
 *
 * Plan §7 (User Management). Two surfaces: a paginated, filterable
 * list (`listUsersForAdmin`) and a single-user detail view that
 * surfaces usage counters (`getUserDetailForAdmin`). All callers
 * are gated by requireAdmin() before reaching these helpers, but
 * the helpers themselves verify again as defense in depth.
 *
 * Counters in the detail view intentionally come from a single
 * inline-aggregate query for each row — fits small datasets; revisit
 * with caching if a user ever has >50k rows of any single domain.
 */

export interface AdminUserListRow {
  id: string
  name: string
  email: string
  role: 'USER' | 'ADMIN'
  emailVerified: Date | null
  createdAt: Date
  shiftsCount: number
  expensesCount: number
}

export interface AdminUserListFilters {
  search?: string
  role?: 'USER' | 'ADMIN'
  verifiedFilter?: 'all' | 'verified' | 'unverified'
  page?: number
  pageSize?: number
}

export interface AdminUserListPage {
  rows: AdminUserListRow[]
  total: number
  page: number
  pageSize: number
}

const DEFAULT_PAGE_SIZE = 20

export async function listUsersForAdmin(
  filters: AdminUserListFilters = {}
): Promise<AdminUserListPage> {
  await requireAdmin()

  const {
    search = '',
    role,
    verifiedFilter = 'all',
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = filters

  const where: any = {}
  if (search.trim()) {
    const q = search.trim()
    where.OR = [
      { name:   { contains: q, mode: 'insensitive' } },
      { email:  { contains: q, mode: 'insensitive' } },
    ]
  }
  if (role === 'USER' || role === 'ADMIN') where.role = role
  if (verifiedFilter === 'verified')   where.emailVerified = { not: null }
  if (verifiedFilter === 'unverified') where.emailVerified = null

  const skip = (Math.max(1, page) - 1) * pageSize

  // Two queries: count + page. We don't use `include` because Shifts
  // and Expenses are heavy tables; the row counts are fetched
  // independently so we can SELECT N+1 cheaply in batched rows.
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true, name: true, email: true, role: true,
        emailVerified: true, createdAt: true,
      },
      skip, take: pageSize,
    }),
  ])

  if (users.length === 0) {
    return { rows: [], total, page, pageSize }
  }

  // Batched counts: one query per domain, grouped by userId.
  const userIds = users.map((u) => u.id)
  const [shiftsGroup, expensesGroup] = await Promise.all([
    prisma.userShift.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _count: { _all: true },
    }),
    prisma.expense.groupBy({
      by: ['userId'],
      where: { userId: { in: userIds } },
      _count: { _all: true },
    }),
  ])

  const shiftCount = new Map<string, number>()
  for (const row of shiftsGroup)  shiftCount.set(row.userId, row._count._all)
  const expenseCount = new Map<string, number>()
  for (const row of expensesGroup) expenseCount.set(row.userId, row._count._all)

  const rows: AdminUserListRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    emailVerified: u.emailVerified,
    createdAt: u.createdAt,
    shiftsCount: shiftCount.get(u.id) ?? 0,
    expensesCount: expenseCount.get(u.id) ?? 0,
  }))

  return { rows, total, page, pageSize }
}

export interface AdminUserDetail {
  id: string
  name: string
  email: string
  role: 'USER' | 'ADMIN'
  currency: string | null
  location: string | null
  schoolFee: number
  emailVerified: Date | null
  actualTimesEnabled: boolean
  createdAt: Date
  usage: {
    sessions: number
    jobs: number
    shifts: number
    templates: number
    expenses: number
    budgetGoals: number
  }
  lastSessionAt: Date | null
}

export async function getUserDetailForAdmin(userId: string): Promise<AdminUserDetail | null> {
  await requireAdmin()
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, role: true,
      currency: true, location: true, schoolFee: true,
      emailVerified: true, actualTimesEnabled: true,
      createdAt: true,
    },
  })
  if (!u) return null

  const [
    sessions,
    jobs,
    shifts,
    templates,
    expenses,
    budgetGoals,
    lastSession,
  ] = await Promise.all([
    prisma.session.count({ where: { userId } }),
    prisma.userJob.count({ where: { userId } }),
    prisma.userShift.count({ where: { userId } }),
    prisma.userTemplate.count({ where: { userId } }),
    prisma.expense.count({ where: { userId } }),
    prisma.userBudgetGoal.count({ where: { userId } }),
    prisma.session.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ])

  return {
    ...u,
    usage: {
      sessions, jobs, shifts, templates, expenses, budgetGoals,
    },
    lastSessionAt: lastSession?.createdAt ?? null,
  }
}
