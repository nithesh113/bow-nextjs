/**
 * lib/auth/feedback.ts
 *
 * Constants used by both the server-side admin workflow
 * (`app/actions/admin/feedback.ts`) and the client status
 * dropdown (`app/admin/feedback/FeedbackStatusControl.tsx`).
 *
 * Lives outside a `'use server'` module because Next 16 disallows
 * exporting non-function values from one.
 */
export const FEEDBACK_TYPES = ['REVIEW', 'FEATURE', 'BUG', 'OTHER'] as const
export type FeedbackType = (typeof FEEDBACK_TYPES)[number]

export const FEEDBACK_STATUSES = [
  'NEW',
  'REVIEWING',
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
] as const
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]
