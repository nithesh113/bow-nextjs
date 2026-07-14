'use server'

import { prisma } from '@/lib/auth/prisma'
import { getCurrentUser } from '@/lib/auth/session'
import { makeUserRowId } from '@/lib/ids'
import { revalidatePath } from 'next/cache'

// ── Types ──────────────────────────────────────────
export interface TemplateRow {
  id: string
  userId: string
  name: string
  days: number[]
  jobId: string
  start: string
  end: string
  workDetails: string | null
  createdAt: string
  updatedAt: string
}

/** Subset of TemplateRow the client sends for create/update. */
export interface TemplateData {
  id?: string
  name: string
  days: number[]
  jobId: string
  start: string
  end: string
  workDetails?: string | null
}

// ── Helpers ────────────────────────────────────────
async function requireUserId(): Promise<string> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  return user.id
}

function mapTemplate(row: any): TemplateRow {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    days: Array.isArray(row.days) ? row.days : [],
    jobId: row.jobId,
    start: row.start,
    end: row.end,
    workDetails: row.workDetails ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? '',
    updatedAt: row.updatedAt?.toISOString?.() ?? '',
  }
}

// ── Template CRUD ──────────────────────────────────
export async function getTemplates(): Promise<TemplateRow[]> {
  const userId = await requireUserId()
  const rows = await prisma.userTemplate.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(mapTemplate)
}

export async function createTemplate(data: TemplateData): Promise<TemplateRow> {
  const userId = await requireUserId()
  // Normalize workDetails: trim and treat empties as null so the DB stays clean.
  const wd =
    typeof data.workDetails === 'string' && data.workDetails.trim().length > 0
      ? data.workDetails.trim()
      : null
  // Generate user-prefixed id inside a transaction.
  const id = await prisma.$transaction(async (tx) =>
    makeUserRowId(userId, 'tpl', tx as any),
  )
  const row = await prisma.userTemplate.create({
    data: {
      id,
      userId,
      name: data.name,
      days: data.days,
      jobId: data.jobId,
      start: data.start,
      end: data.end,
      workDetails: wd,
    },
  })

  revalidatePath('/dashboard')
  return mapTemplate(row)
}

export async function updateTemplate(
  id: string,
  data: {
    name?: string
    days?: number[]
    jobId?: string
    start?: string
    end?: string
    workDetails?: string | null
  }
): Promise<TemplateRow> {
  const userId = await requireUserId()
  // Normalize workDetails updates the same way as create, so a user
  // clearing the field actually clears it instead of storing "".
  let normalizedWorkDetails: string | null | undefined = data.workDetails
  if (typeof data.workDetails === 'string') {
    const trimmed = data.workDetails.trim()
    normalizedWorkDetails = trimmed.length > 0 ? trimmed : null
  }
  const row = await prisma.userTemplate.update({
    where: { id, userId },
    data: { ...data, workDetails: normalizedWorkDetails },
  })
  revalidatePath('/dashboard')
  return mapTemplate(row)
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const userId = await requireUserId()
  await prisma.userTemplate.delete({ where: { id, userId } })
  revalidatePath('/dashboard')
  return true
}
