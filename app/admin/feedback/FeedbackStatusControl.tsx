'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  setFeedbackStatus,
} from '@/app/actions/admin/feedback'
import { FEEDBACK_STATUSES } from '@/lib/auth/feedback'

/**
 * Admin-side status workflow. The form sits inline next to each
 * feedback row so triage doesn't open a modal per item. State is
 * dirty-tracked but not blocked: a status change applies
 * immediately via server action, and the audit log records
 * before/after.
 */
export default function FeedbackStatusControl({
  feedbackId, status,
}: {
  feedbackId: string
  status: string
}) {
  const [pending, startTransition] = useTransition()
  const [current, setCurrent] = useState(status)

  return (
    <select
      value={current}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value
        if (next === current) return
        startTransition(async () => {
          const res = await setFeedbackStatus(feedbackId, next)
          if (res.success) {
            setCurrent(next)
            toast.success(`Status → ${next}`)
          } else {
            toast.error(res.error || 'Failed to update status.')
            // Snap back
            e.target.value = current
          }
        })
      }}
      style={{
        padding: '4px 8px', borderRadius: 6,
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid var(--border)',
        color: 'var(--text)', fontSize: 11, fontWeight: 600,
        cursor: pending ? 'wait' : 'pointer',
      }}
    >
      {FEEDBACK_STATUSES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  )
}
