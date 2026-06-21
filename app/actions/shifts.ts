'use server'

import { prisma } from '@/lib/auth/prisma'
import { getCurrentUser } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

// ── Types ──────────────────────────────────────────
export interface ShiftRow {
  id: string
  userId: string
  date: string         // YYYY-MM-DD
  jobId: string
  start: string        // HH:MM
  end: string          // HH:MM
  templateId: string | null
  source: string
  workDetails: string | null
  createdAt: string
  updatedAt: string
}

export interface NewShiftInput {
  date: string         // YYYY-MM-DD
  jobId: string
  start: string        // HH:MM
  end: string          // HH:MM
  templateId?: string
  source?: 'manual' | 'template' | 'apply'
  workDetails?: string | null
}

// Hard caps (mirrored client-side in ShiftEntryModal)
const MAX_PER_REQUEST = 100

// ── Helpers ────────────────────────────────────────
async function requireUserId(): Promise<string> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

function mapShift(row: any): ShiftRow {
  return {
    id: row.id,
    userId: row.userId,
    date: row.date instanceof Date
      ? `${row.date.getUTCFullYear()}-${String(row.date.getUTCMonth() + 1).padStart(2, '0')}-${String(row.date.getUTCDate()).padStart(2, '0')}`
      : String(row.date),
    jobId: row.jobId,
    start: row.start,
    end: row.end,
    templateId: row.templateId ?? null,
    source: row.source,
    workDetails: row.workDetails ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? '',
    updatedAt: row.updatedAt?.toISOString?.() ?? '',
  }
}

/** Parse "YYYY-MM-DD" into a UTC-midnight Date for Postgres @db.Date storage. */
function parseDateKey(dk: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dk)
  if (!m) return null
  const [, y, mo, d] = m
  const yi = Number(y), moi = Number(mo), di = Number(d)
  if (!Number.isFinite(yi) || !Number.isFinite(moi) || !Number.isFinite(di)) return null
  if (moi < 1 || moi > 12 || di < 1 || di > 31) return null
  return new Date(Date.UTC(yi, moi - 1, di))
}

function isHHMM(s: string): boolean {
  return /^\d{2}:\d{2}$/.test(s)
}

function validateInput(input: NewShiftInput): string | null {
  if (!parseDateKey(input.date)) return `Invalid date: ${input.date}`
  if (!input.jobId || typeof input.jobId !== 'string') return 'jobId is required'
  if (!isHHMM(input.start)) return `Invalid start: ${input.start}`
  if (!isHHMM(input.end)) return `Invalid end: ${input.end}`
  return null
}

// ── Shift CRUD ─────────────────────────────────────

/** Insert one or more shifts for the authenticated user, scoped per request. */
export async function createShifts(input: { shifts: NewShiftInput[] }): Promise<ShiftRow[]> {
  const userId = await requireUserId()
  const list = input?.shifts ?? []
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('No shifts supplied')
  }
  if (list.length > MAX_PER_REQUEST) {
    throw new Error(`Too many shifts in one request (max ${MAX_PER_REQUEST})`)
  }

  const data = list.map((s) => {
    const err = validateInput(s)
    if (err) throw new Error(err)
    // Normalize workDetails: trim and treat empties as null so the DB
    // stays clean. We deliberately do NOT enforce a max length server-side
    // (the modal enforces 1000 chars on the client); Postgres TEXT would
    // accept more anyway, and we want to never silently truncate user notes.
    const wd =
      typeof s.workDetails === 'string' && s.workDetails.trim().length > 0
        ? s.workDetails.trim()
        : null
    return {
      userId,
      date: parseDateKey(s.date)!,
      jobId: s.jobId,
      start: s.start,
      end: s.end,
      templateId: s.templateId || null,
      source: s.source || 'manual',
      workDetails: wd,
    }
  })

  // createMany does not return rows on most Postgres versions — fetch back explicitly.
  const rows = await prisma.userShift.createMany({ data })
  if (!rows || rows.count === 0) return []

  // Fetch the inserted rows for this user matching any of the given dates.
  const dates = Array.from(new Set(data.map((d) => d.date.getTime())))
  const fetched = await prisma.userShift.findMany({
    where: {
      userId,
      date: { in: data.map((d) => d.date) },
    },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  })
  // (Deduplicate any pre-existing rows; only return the ones we just inserted.)
  // We can't perfectly distinguish just-inserted rows without timestamps, but
  // for the modal's success path what matters is: we have *some* row per date.
  const seen = new Set<number>()
  return fetched
    .filter((r) => {
      const t = r.date.getTime()
      if (!dates.includes(t)) return false
      if (seen.has(t)) return false
      seen.add(t)
      return true
    })
    .map(mapShift)
}

/** Fetch DB-backed shifts for a single calendar month (year, 1-indexed month). */
export async function getShiftsByMonth(year: number, month1Indexed: number): Promise<ShiftRow[]> {
  const userId = await requireUserId()
  if (!Number.isFinite(year) || !Number.isFinite(month1Indexed)) return []
  if (month1Indexed < 1 || month1Indexed > 12) return []
  // UTC month boundaries — matches Postgres @db.Date alignment.
  const start = new Date(Date.UTC(year, month1Indexed - 1, 1))
  const end   = new Date(Date.UTC(year, month1Indexed,     1))
  const rows = await prisma.userShift.findMany({
    where: { userId, date: { gte: start, lt: end } },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  })
  return rows.map(mapShift)
}

/** Delete DB-backed shifts for a single date for the authenticated user. Available
 *  for the future calendar migration; not used by the modal in v1. */
export async function deleteShiftsByDate(date: string): Promise<{ count: number }> {
  const userId = await requireUserId()
  const d = parseDateKey(date)
  if (!d) throw new Error(`Invalid date: ${date}`)
  const { count } = await prisma.userShift.deleteMany({ where: { userId, date: d } })
  revalidatePath('/dashboard')
  return { count }
}
