'use server'

import { prisma } from '@/lib/auth/prisma'
import { getCurrentUser } from '@/lib/auth/session'
import { makeUserRowId } from '@/lib/ids'
import { revalidatePath } from 'next/cache'

// ── Types ──────────────────────────────────────────

export interface JobRow {
  id: string
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
  id?: string
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

/** Insert a new job. Server generates a user-prefixed id (e.g. `nithesh_j1`),
 *  or accepts the provided id if its prefix matches the user's public handle. */
export async function createJob(data: JobData): Promise<JobRow> {
  const authUser = await getCurrentUser()
  if (!authUser) throw new Error('Not authenticated')
  const { id: dbId, userId: handle } = authUser
  const err = validate(data)
  if (err) throw new Error(err)

  const rawId = data.id?.trim()

  // If the user has no handle yet (userId is null), reject any client-supplied
  // id and let the server generate a fresh one.
  if (rawId && !handle) {
    throw new Error(
      `Job id cannot be accepted until your account has a public handle set. A new id will be generated.`,
    )
  }

  const userRowIdPrefix = handle ? `${handle}_` : null

  // Validate any client-supplied id belongs to this user.
  if (rawId && userRowIdPrefix && !rawId.startsWith(userRowIdPrefix)) {
    throw new Error(
      `Job id "${rawId}" does not belong to your account — a new id will be generated instead.`,
    )
  }

  // Use handle for the ID prefix (e.g. nithesh_j1). Store UUID as userId FK.
  const id =
    rawId ||
    (await prisma.$transaction(async (tx) =>
      makeUserRowId(handle ?? dbId, 'j', tx as any),
    ))

  const row = await prisma.userJob.create({
    data: {
      id,
      userId: dbId,
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

/** Patch a job's mutable fields by id (must belong to the current user). */
export async function updateJob(
  id: string,
  data: Partial<{
    name: string
    color: string
    rate: number
    nightRate: number
    sortOrder: number
  }>,
): Promise<JobRow | null> {
  const userId = await requireUserId()
  if (!id) throw new Error('id is required')

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
    const row = await prisma.userJob
      .update({
        where: { id, userId } as any,
        data: patch,
      })
      .catch(async (e: unknown) => {
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

/** Replace the user's full job list. Used by import. */
export async function replaceJobs(rows: JobData[]): Promise<JobRow[]> {
  const authUser = await getCurrentUser()
  if (!authUser) throw new Error('Not authenticated')
  const userId = authUser.id
  if (!Array.isArray(rows)) throw new Error('rows must be an array')
  for (const r of rows) {
    const err = validate(r)
    if (err) throw new Error(err)
  }
  await prisma.$transaction([
    prisma.userJob.deleteMany({ where: { userId } }),
    ...rows.map((r) =>
      prisma.userJob.create({
        data: {
          id: r.id || `import_${Date.now().toString(36)}`,
          userId,
          name: r.name.trim(),
          color: r.color,
          rate: r.rate,
          nightRate: r.nightRate,
          sortOrder: r.sortOrder ?? 0,
        },
      }),
    ),
  ])
  revalidatePath('/dashboard')
  const after = await prisma.userJob.findMany({ where: { userId } })
  return after.map(mapJob)
}