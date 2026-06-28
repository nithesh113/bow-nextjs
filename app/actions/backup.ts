'use server'

import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/auth/prisma'
import type { BackupData, Job, Template, BudgetCategory, Expense, BudgetGoal, Shift } from '@/types'

/**
 * Backup server actions (v6.4).
 *
 * The DB is the source of truth. This module assembles a per-user
 * `BackupData` bundle directly from Prisma, including the v6.4 fields
 * that v6.3 backups lacked: categories, expenses, budget goals, and
 * per-month notes.
 *
 * Import is handled by the existing `services/importService.ts` (which
 * already routes to the per-domain CRUD server actions for shifts,
 * jobs, and templates) plus per-domain bulk helpers in
 * `app/actions/expenses.ts` and `app/actions/budget.ts` for the
 * v6.4 additions.
 */

export interface BackupBundle {
  /** Source-of-truth JSON shape (matches `BackupData`). */
  data: BackupData
  /** Pre-built single-file CSV (multi-table combined, `# section:` separators). */
  csvText: string
}

const CSV_HEADER_LINE = (section: string) => `# section: ${section}`
export const SCHEMA_VERSION = '6.4.0' as const

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

export async function fetchBackupBundle(): Promise<BackupBundle> {
  const userId = await requireUserId()

  const [
    user,
    jobRows,
    templateRows,
    shiftRows,
    categoryRows,
    expenseRows,
    goalRows,
    noteRows,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { actualTimesEnabled: true },
    }),
    prisma.userJob.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
    prisma.userTemplate.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.userShift.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    prisma.expenseCategory.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
    prisma.expense.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    prisma.userBudgetGoal.findMany({ where: { userId }, orderBy: { createdMonth: 'asc' } }),
    prisma.userBudgetMonthMeta.findMany({
      where: { userId, NOT: { notes: '' } },
    }),
  ])

  // Map rows to client types ───────────────────────────────────
  const jobs: Job[] = jobRows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    rate: r.rate,
    nightRate: r.nightRate,
  }))

  const templates: Template[] = templateRows.map((r) => ({
    id: r.id,
    name: r.name,
    jobId: r.jobId,
    start: r.start,
    end: r.end,
    days: Array.isArray(r.days) ? (r.days as number[]) : [],
    breaks: [],
    workDetails: (r.workDetails as any) ?? null,
  }))

  // Group shifts into ShiftsStore (Record<dateKey, Shift[]>).
  // `r.date` is a Date object; convert to "YYYY-MM-DD".
  const shiftsMap: Record<string, Shift[]> = {}
  const toDateKey = (d: Date): string => {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${dd}`
  }
  for (const r of shiftRows) {
    const dk = toDateKey(r.date)
    if (!shiftsMap[dk]) shiftsMap[dk] = []
    shiftsMap[dk].push({
      jobId: r.jobId,
      start: r.start,
      end: r.end,
      breaks: [],
      actualLogin: r.actualLogin ?? undefined,
      actualLogout: r.actualLogout ?? undefined,
      actualBreaks: (r.actualBreaks as any) ?? undefined,
    } as any)
  }

  // Categories: emit parent rows + child rows flat. Children carry
  // `parentName` so the CSV round-trip is human-readable.
  // The schema uses `sortOrder`; we surface that as the priority field.
  const categories: BudgetCategory[] = categoryRows.map((r) => {
    const parent = r.parentId
      ? categoryRows.find((p) => p.id === r.parentId) ?? null
      : null
    return {
      id: r.id,
      name: r.name,
      icon: r.icon ?? '',
      budget: r.budget ?? 0,
      priority: r.sortOrder ?? 0,
      ...(parent ? { parentName: parent.name } : {}),
    } as any as BudgetCategory
  })

  // Expenses grouped by monthKey for JSON. We carry `categoryName` along
  // with a deterministic numeric `categoryId` so an importer can rebind
  // by name when the receiving user has different id sequences.
  type BackupExpenseRow = Expense & { categoryName: string }
  const expensesByMonth: Record<string, BackupExpenseRow[]> = {}
  // Each unique category-name maps to a deterministic numeric id.
  const nameToNumericId = new Map<string, number>()
  let nId = 1
  for (const r of expenseRows) {
    const dk = toDateKey(r.date)
    const monthKey = dk.slice(0, 7)
    if (!expensesByMonth[monthKey]) expensesByMonth[monthKey] = []
    const cat = categoryRows.find((c) => c.id === r.categoryId)
    const catName = cat?.name ?? ''
    if (catName && !nameToNumericId.has(catName)) {
      nameToNumericId.set(catName, nId++)
    }
    const categoryId = nameToNumericId.get(catName) ?? 0
    expensesByMonth[monthKey].push({
      categoryId,
      categoryName: catName,
      amount: Math.round(r.amount),
      date: dk,
      note: r.note ?? '',
    })
  }

  const goals: BudgetGoal[] = goalRows.map((r) => ({
    id: r.id,
    name: r.name,
    deadline: r.deadline,
    target: r.target,
    percentage: r.percentage ?? 0,
    priority: r.priority ?? 0,
    createdMonth: r.createdMonth,
    monthlyProgress: (r.monthlyProgress as Record<string, number> | null) ?? {},
    cumulativeAmount: Object.values((r.monthlyProgress as Record<string, number>) ?? {}).reduce(
      (a, b) => a + (b ?? 0),
      0
    ),
    status: 'active',
  }))

  const monthNotes: Record<string, string> = {}
  for (const r of noteRows) monthNotes[r.monthKey] = r.notes

  const data: BackupData = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profile: {
      country: 'Japan',
      weeklyLimit: 28,
      currency: 'JPY',
    },
    jobs,
    templates,
    shifts: shiftsMap,
    expenses: expensesByMonth,
    categories,
    goals,
    monthNotes,
    entries: [],
  }

  const csvText = buildCsvText(data)
  return { data, csvText }
}

// ── CSV serializer ────────────────────────────────────────────────────
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean'
    ? String(v)
    : JSON.stringify(v)
  const needsQuote = /[\",\r\n]/.test(s)
  if (!needsQuote) return s
  return '"' + s.replace(/"/g, '""') + '"'
}

function buildCsvText(data: BackupData): string {
  const parts: string[] = []

  // Profile ── single row
  parts.push(CSV_HEADER_LINE('profile'))
  parts.push('schemaVersion,exportedAt,country,weeklyLimit,currency')
  parts.push([
    data.schemaVersion ?? '',
    data.exportedAt,
    data.profile?.country ?? '',
    data.profile?.weeklyLimit ?? '',
    data.profile?.currency ?? '',
  ].map(csvEscape).join(','))
  parts.push('') // blank separator

  // Jobs
  parts.push(CSV_HEADER_LINE('jobs'))
  parts.push('id,name,color,rate,nightRate')
  for (const j of data.jobs ?? []) {
    parts.push([j.id, j.name, j.color, j.rate, j.nightRate].map(csvEscape).join(','))
  }
  parts.push('')

  // Templates
  parts.push(CSV_HEADER_LINE('templates'))
  parts.push('id,name,jobId,start,end,daysJson,workDetails')
  for (const t of data.templates ?? []) {
    parts.push(
      [t.id, t.name, t.jobId, t.start, t.end, JSON.stringify(t.days ?? []), JSON.stringify(t.workDetails ?? null)]
        .map(csvEscape)
        .join(',')
    )
  }
  parts.push('')

  // Shifts ── flattened, one row per shift. The global `Shift` interface
  // doesn't carry `workDetails` or `source`, so those columns are dropped
  // here (they're user-shift DB columns not exposed in the client type).
  parts.push(CSV_HEADER_LINE('shifts'))
  parts.push('date,jobId,start,end,actualLogin,actualLogout,actualBreaksJson')
  const shifts = data.shifts ?? {}
  for (const dk of Object.keys(shifts)) {
    for (const s of shifts[dk] ?? []) {
      parts.push(
        [
          dk,
          s.jobId,
          s.start,
          s.end,
          s.actualLogin ?? '',
          s.actualLogout ?? '',
          JSON.stringify((s as any).actualBreaks ?? null),
        ]
          .map(csvEscape)
          .join(',')
      )
    }
  }
  parts.push('')

  // Categories
  parts.push(CSV_HEADER_LINE('categories'))
  parts.push('id,name,icon,budget,priority,parentName')
  for (const c of data.categories ?? []) {
    parts.push([c.id, c.name, c.icon, c.budget, c.priority, (c as any).parentName ?? ''].map(csvEscape).join(','))
  }
  parts.push('')

  // Expenses ── subject to falling back to categoryName when id isn\'t durable
  parts.push(CSV_HEADER_LINE('expenses'))
  parts.push('monthKey,date,categoryId,categoryName,amount,note,id')
  const expenses = data.expenses ?? {}
  for (const monthKey of Object.keys(expenses)) {
    for (const e of expenses[monthKey] ?? []) {
      parts.push(
        [
          monthKey,
          e.date,
          e.categoryId,
          (e as any).categoryName ?? '',
          e.amount,
          e.note ?? '',
          (e as any).id ?? '',
        ]
          .map(csvEscape)
          .join(',')
      )
    }
  }
  parts.push('')

  // Goals
  parts.push(CSV_HEADER_LINE('goals'))
  parts.push('id,name,deadline,target,percentage,priority,createdMonth,monthlyProgressJson')
  for (const g of data.goals ?? []) {
    parts.push(
      [
        g.id,
        g.name,
        g.deadline,
        g.target,
        g.percentage,
        g.priority,
        g.createdMonth,
        JSON.stringify(g.monthlyProgress ?? {}),
      ]
        .map(csvEscape)
        .join(',')
    )
  }
  parts.push('')

  // Notes
  parts.push(CSV_HEADER_LINE('notes'))
  parts.push('monthKey,notes')
  const notes = data.monthNotes ?? {}
  for (const monthKey of Object.keys(notes)) {
    parts.push([monthKey, notes[monthKey] ?? ''].map(csvEscape).join(','))
  }
  parts.push('')

  return parts.join('\n')
}
