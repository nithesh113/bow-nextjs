'use client'

import { useEffect, useTransition } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { resendVerificationAction, type AuthActionState } from '@/app/auth/actions'
import { toast } from 'sonner'

const initialState: AuthActionState = {}

function ResendButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        width: '100%',
        padding: '12px 24px',
        background: pending ? 'var(--surface)' : 'var(--accent, #3b82f6)',
        border: '1px solid var(--border)',
        color: '#ffffff',
        borderRadius: '10px',
        fontWeight: 700,
        fontSize: '15px',
        cursor: pending ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? 'Sending...' : 'Resend Verification Email'}
    </button>
  )
}

interface ResendVerificationFormProps {
  defaultEmail?: string
}

export default function ResendVerificationForm({ defaultEmail }: ResendVerificationFormProps) {
  const [state, formAction] = useFormState(resendVerificationAction, initialState)

  useEffect(() => {
    if (state.error) {
      toast.error(state.error)
    }
    if (state.success) {
      toast.success(state.success)
    }
  }, [state.error, state.success])

  return (
    <form action={formAction} style={{ display: 'grid', gap: 12, marginTop: 24 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <label
          htmlFor="resend-email"
          style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}
        >
          Email Address
        </label>
        <input
          id="resend-email"
          name="email"
          type="email"
          defaultValue={defaultEmail}
          required
          placeholder="you@example.com"
          style={{
            padding: '10px 14px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text)',
            fontSize: '14px',
            outline: 'none',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      </div>
      <ResendButton />
    </form>
  )
}
