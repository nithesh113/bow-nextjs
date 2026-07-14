'use server'

import { prisma } from '@/lib/auth/prisma'
import { getCurrentUser } from '@/lib/auth/session'
import { revalidatePath } from 'next/cache'

// ── Types ──────────────────────────────────────────

export interface JobRow {
  id: string          // stable client id (e.g. "j1", "j_<ts>")
  userId: string
  name: string
  color: string
  rate: number
  nightRate: number
  sortOrder: number
  createdAt: string
  updatedAt: string
}

/** Subset of JobRow the client sends for create/update. */
export interface JobData {
  id?: string         // optional: if absent we generate a "j_<ts>" client id
  name: string
  color: string
  rate: number
  nightRate: number
  sortOrder?: number
}

// ── Helpers ────────────────────────────────────────

async function requireUserId(): Promise<string> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

function mapJob(row: any): JobRow {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    color: row.color,
    rate: row.rate,
    nightRate: row.nightRate,
    sortOrder: row.sortOrder ?? 0,
    createdAt: row.createdAt?.toISOString?.() ?? '',
    updatedAt: row.updatedAt?.toISOString?.() ?? '',
  }
}

/** Mint a fresh client-side id (`j_<base36-timestamp>`) for new jobs. */
function newJobId(): string {
  return `j_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

// ── Validation ─────────────────────────────────────

function validate(data: JobData): string | null {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0)
    return 'Job name is required'
  if (!data.color || typeof data.color !== 'string')
    return 'Job color is required'
  if (!Number.isFinite(data.rate) || data.rate <= 0)
    return 'Job rate must be a positive number'
  if (!Number.isFinite(data.nightRate) || data.nightRate <= 0)
    return 'Job night rate must be a positive number'
  return null
}

// ── Job CRUD ───────────────────────────────────────

/** Fetch all DB-backed jobs for the authenticated user, ordered by creation. */
export async function getJobs(): Promise<JobRow[]> {
  const userId = await requireUserId()
  const rows = await prisma.userJob.findMany({
    where: { userId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return rows.map(mapJob)
}

/**
 * Seed the default jobs (McDonald's + Big Boy) for a brand-new user the
 * first time they hit the dashboard. Idempotent: if any rows already
 * exist for this user, returns the existing set.
 *
 * Called from AppShell on session load so we can drop the localStorage
 * `wh_jobs3` default entirely without booting a new user into an empty
 * job list.
 */
export async function seedDefaultJobsIfEmpty(): Promise<JobRow[]> {
  const userId = await requireUserId()
  // Always fetch the user's current jobs first — even if createMany below
  // returns count:0 (e.g. all-duplicate → skipDuplicates), we still want to
  // hand back the existing rows so the caller's `set({jobs: ...})` doesn't
  // wipe a populated store on every re-mount. (Race with fetchJobsFromDB
  // was triggering this empty-overwrite on Vercel.)
  const existingRows = await prisma.userJob.findMany({
    where: { userId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  if (existingRows.length > 0) {
    return existingRows.map(mapJob)
  }

  const created = await prisma.userJob.createMany({
      data: [
        {
          id: 'j1',
          userId,
          name: "McDonald's",
          color: '#f59e0b',
          rate: 1250,
          nightRate: 1562,
          sortOrder: 0,
        },
        {
          id: 'j2',
          userId,
          name: 'Big Boy',
          color: '#6366f1',
          rate: 1300,
          nightRate: 1700,
          sortOrder: 1,
        },
      ],
      skipDuplicates: true, // P2002 if j1/j2 already exist → safe for re-import
    })
  // Don't bail on count:0 — even an all-skipDuplicates insert is fine, just
  // re-fetch whatever now lives in the DB. Returning [] here used to wipe
  // the client store on every concurrent seed-then-fetch race.
  revalidatePath('/dashboard')
  const rows = await prisma.userJob.findMany({
    where: { userId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return rows.map(mapJob)
}

/** Insert a new job. Server mints the client id if absent. */
export async function createJob(data: JobData): Promise<JobRow> {
  const userId = await requireUserId()
  const err = validate(data)
  if (err) throw new Error(err)

  // Mint a unique client-id; if a collision occurs (very unlikely),
  // reroll once and retry.
  const candidateId = data.id || newJobId()

  try {
    const row = await prisma.userJob.create({
      data: {
        id: candidateId,
        userId,
        name: data.name.trim(),
        color: data.color,
        rate: data.rate,
        nightRate: data.nightRate,
        sortOrder: data.sortOrder ?? 0,
      },
    })
    revalidatePath('/dashboard')
    return mapJob(row)
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code === 'P2002') {
      // Unique constraint on id — retry with a freshly-minted id.
      const fresh = newJobId()
      const row = await prisma.userJob.create({
        data: {
          id: fresh,
          userId,
          name: data.name.trim(),
          color: data.color,
          rate: data.rate,
          nightRate: data.nightRate,
          sortOrder: data.sortOrder ?? 0,
        },
      })
      revalidatePath('/dashboard')
      return mapJob(row)
    }
    throw e
  }
}

/** Patch a job's mutable fields by id (must belong to the current user). */
export async function updateJob(
  id: string,
  data: Partial<{
    name: string
    color: string
    rate: number
    nightRate: number
    sortOrder: number
  }>
): Promise<JobRow | null> {
  const userId = await requireUserId()
  if (!id) throw new Error('id is required')

  // Build only the fields the request supplies — leave others as-is on the row.
  const patch: Record<string, unknown> = {}
  if (data.name !== undefined) patch.name = data.name.trim()
  if (data.color !== undefined) patch.color = data.color
  if (data.rate !== undefined) {
    if (!Number.isFinite(data.rate) || data.rate <= 0) throw new Error('rate must be positive')
    patch.rate = data.rate
  }
  if (data.nightRate !== undefined) {
    if (!Number.isFinite(data.nightRate) || data.nightRate <= 0)
      throw new Error('nightRate must be positive')
    patch.nightRate = data.nightRate
  }
  if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder
  if (Object.keys(patch).length === 0) throw new Error('No updatable fields supplied')

  try {
    // Composite where-key ensures defence-in-depth: row must belong to user.
    const row = await prisma.userJob.update({
      where: { id, userId } as any,
      data: patch,
    }).catch(async (e: unknown) => {
      // Prisma may not have a compound id+userId unique key — fall back to
      // findUnique → ownership-check → update.
      const code = (e as { code?: string })?.code
      if (code !== 'P2025' && code !== 'P2009') throw e
      const existing = await prisma.userJob.findUnique({ where: { id } })
      if (!existing || existing.userId !== userId) throw new Error('Job not found')
      return prisma.userJob.update({ where: { id }, data: patch })
    })
    revalidatePath('/dashboard')
    return mapJob(row)
  } catch (err) {
    console.error('[updateJob] failed', err)
    return null
  }
}

/** Delete a job by id (must belong to current user). Returns rows affected. */
export async function deleteJob(id: string): Promise<{ count: number }> {
  const userId = await requireUserId()
  if (!id) throw new Error('id is required')

  const existing = await prisma.userJob.findUnique({ where: { id } })
  if (!existing || existing.userId !== userId) throw new Error('Job not found')

  const { count } = await prisma.userJob.deleteMany({
    where: { id, userId },
  })
  revalidatePath('/dashboard')
  return { count }
}

/** Replace the user's full job list with the supplied rows.
 *  Used by the export/import flow (future) — not by JobManagerModal. */
export async function replaceJobs(rows: JobData[]): Promise<JobRow[]> {
  const userId = await requireUserId()
  if (!Array.isArray(rows)) throw new Error('rows must be an array')
  for (const r of rows) {
    const err = validate(r)
    if (err) throw new Error(err)
  }
  await prisma.$transaction([
    prisma.userJob.deleteMany({ where: { userId } }),
    prisma.userJob.createMany({
      data: rows.map((r, i) => ({
        id: r.id || newJobId(),
        userId,
        name: r.name.trim(),
        color: r.color,
        rate: r.rate,
        nightRate: r.nightRate,
        sortOrder: r.sortOrder ?? i,
      })),
    }),
  ])
  revalidatePath('/dashboard')
  const after = await prisma.userJob.findMany({ where: { userId } })
  return after.map(mapJob)
}
