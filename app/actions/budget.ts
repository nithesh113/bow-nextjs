'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/auth/prisma'
import { getCurrentUser } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

/**
 * Budget scaffolding server actions.
 *
 * Scope of this module: the *scaffolding* around the budget system —
 * per-month notes, cross-month savings goals, and the per-month goal
 * allocations rollups. Categories and expenses already live in their
 * own tables; this module does not duplicate them.
 *
 * Tables touched:
 *   - user_budget_month_metas : one row per (user, month-key) → notes
 *   - user_budget_goals       : rows are global across months
 */

export interface BudgetMonthMetaRow {
  id: string
  userId: string
  monthKey: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface BudgetGoalRow {
  id: string
  userId: string
  name: string
  deadline: string
  target: number
  percentage: number
  priority: number
  createdMonth: string
  monthlyProgress: Record<string, number>
  createdAt: string
  updatedAt: string
}

export interface BudgetGoalInput {
  id?: string
  name: string
  deadline: string
  target: number
  percentage?: number
  priority?: number
  createdMonth: string
  monthlyProgress?: Record<string, number>
}

// ── Helpers ────────────────────────────────────────

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

function mapMonthMeta(row: any): BudgetMonthMetaRow {
  return {
    id: row.id,
    userId: row.userId,
    monthKey: row.monthKey,
    notes: row.notes ?? '',
    createdAt: row.createdAt?.toISOString?.() ?? '',
    updatedAt: row.updatedAt?.toISOString?.() ?? '',
  }
}

function mapGoal(row: any): BudgetGoalRow {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    deadline: row.deadline,
    target: row.target,
    percentage: row.percentage ?? 0,
    priority: row.priority ?? 0,
    createdMonth: row.createdMonth,
    monthlyProgress: (row.monthlyProgress as Record<string, number> | null) ?? {},
    createdAt: row.createdAt?.toISOString?.() ?? '',
    updatedAt: row.updatedAt?.toISOString?.() ?? '',
  }
}

function validateMonthKey(monthKey: string): boolean {
  return /^\d{4}-\d{2}$/.test(monthKey)
}

// JSON payload for monthlyProgress on create/update. Cast through
// `Prisma.InputJsonValue` so the optional-null handling matches how
// Job user-data migrates from v5 to v6 typing changes.
function toJsonProgress(p: Record<string, number> | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!p || Object.keys(p).length === 0) return Prisma.JsonNull
  return p as unknown as Prisma.InputJsonValue
}

// ── Month-meta CRUD ────────────────────────────────

/** Fetch the per-month notes row for the given month (creating an empty record server-side). */
export async function getBudgetMonthMeta(monthKey: string): Promise<BudgetMonthMetaRow> {
  const userId = await requireUserId()
  if (!validateMonthKey(monthKey)) throw new Error(`Invalid monthKey: ${monthKey}`)

  const row = await prisma.userBudgetMonthMeta.upsert({
    where: { userId_monthKey: { userId, monthKey } },
    create: { userId, monthKey, notes: '' },
    update: {}, // never auto-update on read
  })
  return mapMonthMeta(row)
}

/** Update the notes field for a single (user, month-key) row. */
export async function setBudgetMonthNotes(input: {
  monthKey: string
  notes: string
}): Promise<BudgetMonthMetaRow> {
  const userId = await requireUserId()
  if (!validateMonthKey(input.monthKey)) throw new Error(`Invalid monthKey: ${input.monthKey}`)
  // Trim trailing whitespace but preserve line breaks / leading space.
  const notes = typeof input.notes === 'string' ? input.notes : ''
  const row = await prisma.userBudgetMonthMeta.upsert({
    where: { userId_monthKey: { userId, monthKey: input.monthKey } },
    create: { userId, monthKey: input.monthKey, notes },
    update: { notes },
  })
  revalidatePath('/dashboard')
  return mapMonthMeta(row)
}

// ── Goal CRUD ───────────────────────────────────────

/** Fetch all goals for the authenticated user, ordered by priority then deadline. */
export async function getBudgetGoals(): Promise<BudgetGoalRow[]> {
  const userId = await requireUserId()
  const rows = await prisma.userBudgetGoal.findMany({
    where: { userId },
    orderBy: [{ priority: 'asc' }, { deadline: 'asc' }],
  })
  return rows.map(mapGoal)
}

/** Mint a stable id for newly-created goals. */
function newGoalId(): string {
  /** Date.now()-style numeric id to match the existing localStorage shape
   *  so any old goal data with numeric ids continues to round-trip cleanly. */
  return String(Date.now())
}

export async function createBudgetGoal(input: BudgetGoalInput): Promise<BudgetGoalRow> {
  const userId = await requireUserId()
  if (!input.name || typeof input.name !== 'string') throw new Error('name is required')
  if (!Number.isFinite(input.target) || input.target <= 0) throw new Error('target must be positive')
  if (!validateMonthKey(input.createdMonth)) throw new Error('createdMonth invalid')

  const id = input.id || newGoalId()
  const row = await prisma.userBudgetGoal.create({
    data: {
      id,
      userId,
      name: input.name.trim(),
      deadline: input.deadline,
      target: input.target,
      percentage: Math.max(0, Math.min(100, input.percentage ?? 0)),
      priority: input.priority ?? 0,
      createdMonth: input.createdMonth,
      monthlyProgress: toJsonProgress(input.monthlyProgress),
    },
  })
  revalidatePath('/dashboard')
  return mapGoal(row)
}

export async function updateBudgetGoal(
  id: string,
  data: Partial<BudgetGoalInput>
): Promise<BudgetGoalRow | null> {
  const userId = await requireUserId()
  if (!id) throw new Error('id is required')

  // Ownership check first — defense in depth.
  const existing = await prisma.userBudgetGoal.findUnique({ where: { id } })
  if (!existing || existing.userId !== userId) {
    throw new Error('Goal not found')
  }

  const patch: Prisma.UserBudgetGoalUpdateInput = {}
  if (data.name !== undefined) (patch as any).name = data.name.trim()
  if (data.deadline !== undefined) (patch as any).deadline = data.deadline
  if (data.target !== undefined) {
    if (!Number.isFinite(data.target) || data.target <= 0) throw new Error('target must be positive')
    ;(patch as any).target = data.target
  }
  if (data.percentage !== undefined) {
    ;(patch as any).percentage = Math.max(0, Math.min(100, data.percentage))
  }
  if (data.priority !== undefined) (patch as any).priority = data.priority
  if (data.monthlyProgress !== undefined) {
    patch.monthlyProgress = toJsonProgress(data.monthlyProgress)
  }
  if (Object.keys(patch).length === 0) return mapGoal(existing)

  const row = await prisma.userBudgetGoal.update({ where: { id }, data: patch })
  revalidatePath('/dashboard')
  return mapGoal(row)
}

export async function deleteBudgetGoal(id: string): Promise<{ count: number }> {
  const userId = await requireUserId()
  if (!id) throw new Error('id is required')

  const existing = await prisma.userBudgetGoal.findUnique({ where: { id } })
  if (!existing || existing.userId !== userId) throw new Error('Goal not found')

  const { count } = await prisma.userBudgetGoal.deleteMany({ where: { id, userId } })
  revalidatePath('/dashboard')
  return { count }
}

/** Replace a single month's goal allocation slice on a given goal.
 *  Used by the per-month `recalc()` flow so each `recalculate(mk)` writes
 *  through the goal's `monthlyProgress[mk]` field on the DB. */
export async function setGoalMonthAllocation(input: {
  goalId: string
  monthKey: string
  amount: number
}): Promise<BudgetGoalRow | null> {
  const userId = await requireUserId()
  if (!validateMonthKey(input.monthKey)) throw new Error('monthKey invalid')
  if (!input.goalId) throw new Error('goalId required')

  const existing = await prisma.userBudgetGoal.findUnique({ where: { id: input.goalId } })
  if (!existing || existing.userId !== userId) throw new Error('Goal not found')

  const cur =
    (existing.monthlyProgress as Record<string, number> | null) ?? {}
  const next: Record<string, number> = { ...cur }
  if (input.amount <= 0) {
    delete next[input.monthKey]
  } else {
    next[input.monthKey] = Math.round(input.amount)
  }

  const row = await prisma.userBudgetGoal.update({
    where: { id: input.goalId },
    data: { monthlyProgress: toJsonProgress(next) },
  })
  return mapGoal(row)
}

/** Bootstrapping helper: fetch everything BudgetView needs in one round-trip.
 *  Goals are user-global; month-met Notes are per-month. The caller merges
 *  this with `useExpensesStore`'s DB-backed categories+expenses into a
 *  composite `MonthBudget` for the UI. */
export async function getBudgetState(monthKey: string): Promise<{
  monthMeta: BudgetMonthMetaRow
  goals: BudgetGoalRow[]
}> {
  const userId = await requireUserId()
  if (!validateMonthKey(monthKey)) throw new Error('Invalid monthKey')

  const [meta, goals] = await Promise.all([
    prisma.userBudgetMonthMeta.upsert({
      where: { userId_monthKey: { userId, monthKey } },
      create: { userId, monthKey, notes: '' },
      update: {},
    }),
    prisma.userBudgetGoal.findMany({
      where: { userId },
      orderBy: [{ priority: 'asc' }, { deadline: 'asc' }],
    }),
  ])
  return {
    monthMeta: mapMonthMeta(meta),
    goals: goals.map(mapGoal),
  }
}
