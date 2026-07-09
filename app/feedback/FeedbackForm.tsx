'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { submitFeedback } from '@/app/actions/feedback'

/**
 * User-side feedback form (Plan §26). Reads the optional
 * `from=...` query param so we know which page in the app the
 * user was on when they opened the form (helps the admin triage
 * the issue).
 *
 * Client-only because every field has optimistic-disable behavior
 * while the server action is pending, plus the Sonner toast.
 */
export default function FeedbackForm({ sourcePage }: { sourcePage: string | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [type, setType] = useState<'REVIEW' | 'FEATURE' | 'BUG' | 'OTHER'>('FEATURE')
  const [rating, setRating] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const res = await submitFeedback({
        type,
        rating,
        message,
        page: sourcePage,
      })
      if (res.success) {
        toast.success('Thanks — feedback sent.')
        setSubmitted(true)
        router.refresh()
      } else {
        toast.error(res.error || 'Could not send feedback.')
      }
    })
  }

  if (submitted) {
    return (
      <div style={{
        padding: '24px 16px', borderRadius: 14,
        background: 'rgba(16,185,129,0.07)',
        border: '1px solid rgba(16,185,129,0.30)',
        color: '#34d399', fontSize: 13, textAlign: 'center',
      }}>
        ✓ Got it. Admins will see your note in the feedback queue.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={label}>Type</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {(['REVIEW', 'FEATURE', 'BUG', 'OTHER'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: type === t
                  ? 'rgba(59,130,246,0.16)'
                  : 'rgba(255,255,255,0.04)',
                border: `1px solid ${type === t ? 'rgba(59,130,246,0.40)' : 'var(--border)'}`,
                color:     type === t ? '#93c5fd' : 'var(--text)',
                fontWeight: 700, fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {t === 'REVIEW'  ? '★ Review'        :
               t === 'FEATURE' ? '💡 Feature idea' :
               t === 'BUG'     ? '🐛 Bug report'   :
                                  '· Other'}
            </button>
          ))}
        </div>
      </div>

      {type === 'REVIEW' && (
        <div>
          <label style={label}>Rating (1–5)</label>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(rating === n ? null : n)}
                style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: rating != null && n <= rating
                    ? 'rgba(245,158,11,0.20)'
                    : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${rating != null && n <= rating ? 'rgba(245,158,11,0.40)' : 'var(--border)'}`,
                  color:     rating != null && n <= rating ? '#fbbf24' : 'var(--muted)',
                  fontSize: 18, fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ☆
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label style={label}>
          Message
          <span style={{ float: 'right', color: 'var(--muted)', fontWeight: 500 }}>
            {message.length} / 2000
          </span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
          placeholder="Tell us what's on your mind…"
          rows={5}
          style={{
            ...inputStyle,
            fontFamily: 'inherit',
            resize: 'vertical',
            minHeight: 120,
          }}
        />
      </div>

      {sourcePage && (
        <div style={{
          fontSize: 11, color: 'var(--muted)',
          padding: '6px 10px', borderRadius: 6,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)',
        }}>
          📍 Source page: <span style={{ fontFamily: 'ui-monospace, monospace' }}>{sourcePage}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={pending || message.trim().length < 3}
        style={{
          padding: '12px 16px', borderRadius: 12,
          background: pending ? 'var(--surface)'
            : 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
          color:  pending ? 'var(--muted2)' : '#fff',
          border: 'none', fontWeight: 800, fontSize: 14,
          fontFamily: 'var(--display)',
          cursor: pending ? 'not-allowed' : 'pointer',
          opacity: pending ? 0.7 : 1,
          transition: 'all 0.15s',
        }}
      >
        {pending ? 'Sending…' : 'Send feedback'}
      </button>
    </form>
  )
}

const label: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
  marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px', borderRadius: 10,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 13,
  boxSizing: 'border-box',
}
