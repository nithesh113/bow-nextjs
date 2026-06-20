'use server'

import { prisma } from '@/lib/auth/prisma'
import { getCurrentUser } from '@/lib/auth/session'
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

export async function createTemplate(data: {
  name: string
  days: number[]
  jobId: string
  start: string
  end: string
}): Promise<TemplateRow> {
  const userId = await requireUserId()
  const row = await prisma.userTemplate.create({
    data: {
      userId,
      name: data.name,
      days: data.days,
      jobId: data.jobId,
      start: data.start,
      end: data.end,
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
  }
): Promise<TemplateRow> {
  const userId = await requireUserId()
  const row = await prisma.userTemplate.update({
    where: { id, userId },
    data,
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
