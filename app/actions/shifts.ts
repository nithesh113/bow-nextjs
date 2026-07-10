'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/auth/prisma'
import { getCurrentUser } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'
import type { Break } from '@/types'

// A `NullableJson` field in Prisma 6 accepts only two null-ish shapes:
//   - `Prisma.JsonNull` — explicit JSON-null sentinel (DB stores JSON null)
//   - `null` literal    — JS null, treated by Prisma as SQL NULL
// `Prisma.JsonNull` is still re-exported from the generated namespace in v6;
// only `InputJsonValue` was dropped from the `Prisma.*` namespace. We don't
// reference `InputJsonValue` here — Prisma's generated input types accept
// `JsonValue | null` for our `actualBreaks` field, of which `Break[]` is one.

// ── Types ──────────────────────────────────────────
export interface ShiftRow {
  id: string
  userId: string
  date: string         // YYYY-MM-DD
  jobId: string
  start: string        // HH:MM
  end: string          // HH:MM
  actualLogin: string | null
  actualLogout: string | null
  actualBreaks: import('@/types').Break[] | null
  templateId: string | null
  source: string
  workDetails: string | null
  createdAt: string
  updatedAt: string
}

export interface NewShiftInput {
  date: string             // YYYY-MM-DD
  jobId: string
  start: string            // HH:MM
  end: string              // HH:MM
  actualLogin?: string | null
  actualLogout?: string | null
  actualBreaks?: import('@/types').Break[] | null
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
    actualLogin: row.actualLogin ?? null,
    actualLogout: row.actualLogout ?? null,
    actualBreaks: (row.actualBreaks as import('@/types').Break[] | null) ?? null,
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
    // Validate and trim actual-times if supplied.
    const actualLogin =
      s.actualLogin && isHHMM(s.actualLogin) ? s.actualLogin : null
    const actualLogout =
      s.actualLogout && isHHMM(s.actualLogout) ? s.actualLogout : null
    // Prisma's NullableJson field requires either:
    //   - `Prisma.JsonNull` for explicit JSON null in the DB, or
    //   - a value typed as JSON-serializable (`Prisma.InputJsonValue`).
    // We cast our `Break[]` to `Prisma.InputJsonValue` because TS cannot
    // structurally prove an arbitrary array of objects conforms to the
    // JSON input type — runtime serialization is what makes it safe.
    const actualBreaks: Prisma.InputJsonValue | typeof Prisma.JsonNull =
      Array.isArray(s.actualBreaks) && s.actualBreaks.length > 0
        ? (s.actualBreaks as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull

    return {
      userId,
      date: parseDateKey(s.date)!,
      jobId: s.jobId,
      start: s.start,
      end: s.end,
      actualLogin,
      actualLogout,
      actualBreaks,
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
  // Deduplicate: skip rows we've already returned (same date+jobId+start+end).
    // Using a string key so (date + jobId + start) and (date + jobId2 + start)
    // are distinct — multiple shifts per day are all preserved.
    const seen = new Set<string>()
    return fetched
      .filter((r: { date: Date; jobId: string; start: string }) => {
        const key = `${r.date.toISOString().slice(0, 10)}\u0001${r.jobId}\u0001${r.start}`
        if (seen.has(key)) return false
        seen.add(key)
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

/** Fetch all DB-backed shifts for the authenticated user. */
export async function getAllShifts(): Promise<ShiftRow[]> {
  const userId = await requireUserId()
  const rows = await prisma.userShift.findMany({
    where: { userId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
  })
  return rows.map(mapShift)
}

/** Replace only the per-minute actual-time fields on one shift by id.
 *  Other fields (start/end/jobId/templateId/etc.) are untouched.
 *  Pass any field as `null` to clear it; omit to leave the existing value. */
export async function updateShiftActuals(input: {
  shiftId: string
  actualLogin?: string | null
  actualLogout?: string | null
  actualBreaks?: import('@/types').Break[] | null
}): Promise<ShiftRow | null> {
  const userId = await requireUserId()
  if (!input.shiftId || typeof input.shiftId !== 'string') {
    throw new Error('shiftId is required')
  }
  // Validate HH:MM (or null/undefined) before touching the DB.
  const data: Record<string, unknown> = {}
  if (input.actualLogin !== undefined) {
    if (input.actualLogin === null) data.actualLogin = null
    else if (!isHHMM(input.actualLogin)) throw new Error(`Invalid actualLogin: ${input.actualLogin}`)
    else data.actualLogin = input.actualLogin
  }
  if (input.actualLogout !== undefined) {
    if (input.actualLogout === null) data.actualLogout = null
    else if (!isHHMM(input.actualLogout)) throw new Error(`Invalid actualLogout: ${input.actualLogout}`)
    else data.actualLogout = input.actualLogout
  }
  if (input.actualBreaks !== undefined) {
    data.actualBreaks = input.actualBreaks === null
      ? Prisma.JsonNull
      : (Array.isArray(input.actualBreaks)
          ? (input.actualBreaks as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull)
  }
  if (Object.keys(data).length === 0) {
    throw new Error('No actual-time fields supplied')
  }

  // First confirm ownership (defense in depth — the update would fail with
  // a record-not-found on a row belonging to a different user too).
  const existing = await prisma.userShift.findUnique({
    where: { id: input.shiftId },
    select: { userId: true },
  })
  if (!existing || existing.userId !== userId) {
    throw new Error('Shift not found')
  }

  try {
    const row = await prisma.userShift.update({
      where: { id: input.shiftId },
      data,
    })
    revalidatePath('/dashboard')
    return mapShift(row)
  } catch (err) {
    console.error('[updateShiftActuals] DB update failed', err)
    return null
  }
}
