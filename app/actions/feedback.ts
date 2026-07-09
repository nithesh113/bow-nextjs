'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/auth/prisma'
import { getCurrentUser } from '@/lib/auth/session'

/**
 * User-side: submit a piece of feedback (Plan §26 recommendation).
 *
 * Anyone signed in can post. Empty / oversized messages are rejected
 * server-side with no DB round trip. Status defaults to 'NEW' so the
 * admin queue always shows what hasn't been triaged.
 *
 * Rating is optional — feature suggestions don't usually need one,
 * reviews always include one. We clamp to [1..5] server-side so the
 * admin sort-by-low-rating works regardless of bad client input.
 */

const VALID_TYPES = new Set(['REVIEW', 'FEATURE', 'BUG', 'OTHER'])
const MAX_MESSAGE_LEN = 2000
const MIN_MESSAGE_LEN = 3

export async function submitFeedback(input: {
  type: string
  rating?: number | null
  message: string
  page?: string | null
}): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: 'Please sign in to send feedback.' }

  const type = (input.type ?? '').toUpperCase()
  if (!VALID_TYPES.has(type)) {
    return { success: false, error: 'Pick a feedback type first.' }
  }
  const msg = (input.message ?? '').trim()
  if (msg.length < MIN_MESSAGE_LEN) {
    return { success: false, error: 'Please write a few words first.' }
  }
  if (msg.length > MAX_MESSAGE_LEN) {
    return { success: false, error: `Keep it under ${MAX_MESSAGE_LEN} characters.` }
  }
  let rating: number | null = null
  if (input.rating != null && input.rating !== ('' as unknown)) {
    const n = Number(input.rating)
    if (!Number.isFinite(n)) {
      rating = null
    } else {
      rating = Math.max(1, Math.min(5, Math.round(n)))
    }
  }
  // Reviews want a rating; if missing, we still record the message,
  // rating stays null. The admin sees this and can follow up.
  const page = (input.page ?? null)?.toString().slice(0, 200) ?? null

  await prisma.userFeedback.create({
    data: {
      userId: user.id,
      type,
      rating,
      message: msg,
      page,
      status: 'NEW',
    },
  })
  revalidatePath('/admin/feedback')
  return { success: true }
}
