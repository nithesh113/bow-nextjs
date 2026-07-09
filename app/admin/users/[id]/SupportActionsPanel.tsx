'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  adminForceLogoutUser,
  adminResendVerification,
  adminSetUserRole,
} from '@/app/actions/admin/support'

/**
 * Client-side panel for the three support actions. Lives as a
 * thin wrapper because `useActionState` / `useTransition` are
 * client-only, and per Plan §17 these must be CSRF-protected
 * server actions invoked from a click — Next.js does the CSRF
 * guard for us on 'use server' boundaries.
 *
 * Status feedback is purely toast-based (Sonner). No persistent
 * message in the page tree — keeps the server boundary clean.
 */
export default function SupportActionsPanel({
  targetUserId,
  targetIsVerified,
  targetRole,
  isSelf,
}: {
  targetUserId: string
  targetIsVerified: boolean
  targetRole: 'USER' | 'ADMIN'
  isSelf: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<null | 'resend' | 'logout' | 'role'>(null)

  const wrap = (key: 'resend' | 'logout' | 'role', fn: () => Promise<{ success: boolean; error?: string }>) => {
    startTransition(async () => {
      setBusy(key)
      try {
        const res = await fn()
        if (res.success) {
          toast.success(
            key === 'resend' ? 'Verification email resent.'
            : key === 'logout' ? `Force-logged out. ${'revokedCount' in res && res.revokedCount != null ? `(${res.revokedCount} session${res.revokedCount === 1 ? '' : 's'} revoked)` : ''}`
            : `Role updated to ${targetRole === 'ADMIN' ? 'USER' : 'ADMIN'}.`
          )
        } else {
          toast.error(res.error || 'Action failed.')
        }
      } finally {
        setBusy(null)
      }
    })
  }

  const disabled = pending || !!busy || isSelf

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <ActionButton
        label={targetIsVerified ? 'Already verified' : 'Resend verification email'}
        disabled={disabled || targetIsVerified}
        loading={busy === 'resend'}
        tone="primary"
        onClick={() => wrap('resend', () => adminResendVerification(targetUserId))}
        hint={isSelf ? 'Disabled for your own account.' : undefined}
      />
      <ActionButton
        label="Force logout (revoke all sessions)"
        disabled={disabled}
        loading={busy === 'logout'}
        tone="danger"
        onClick={() => wrap('logout', () => adminForceLogoutUser(targetUserId))}
        hint={isSelf ? 'Disabled for your own account.' : 'The user will be signed out of every device.'}
      />
      <ActionButton
        label={targetRole === 'ADMIN' ? 'Demote to USER' : 'Promote to ADMIN'}
        disabled={disabled}
        loading={busy === 'role'}
        tone={targetRole === 'ADMIN' ? 'danger' : 'primary'}
        onClick={() =>
          wrap('role', () =>
            adminSetUserRole(targetUserId, targetRole === 'ADMIN' ? 'USER' : 'ADMIN'),
          )
        }
        hint={isSelf ? 'Change your own role from the database directly.' : undefined}
      />
    </div>
  )
}

function ActionButton({
  label,
  loading,
  tone,
  hint,
  disabled,
  onClick,
}: {
  label: string
  loading?: boolean
  tone: 'primary' | 'danger'
  disabled?: boolean
  hint?: string
  onClick: () => void
}) {
  const palette = TONES[tone]
  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '11px 14px', borderRadius: 10,
          background: disabled ? 'var(--surface)' : palette.bg,
          color:      disabled ? 'var(--muted2)'  : palette.fg,
          border: `1px solid ${disabled ? 'var(--border)' : palette.ring}`,
          fontWeight: 700, fontSize: 13,
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {loading && <span style={{ fontSize: 14 }}>⏳</span>}
        {label}
      </button>
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--muted)', margin: '4px 2px 0' }}>
          {hint}
        </div>
      )}
    </div>
  )
}

const TONES = {
  primary: {
    bg: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
    fg: '#fff',
    ring: 'rgba(99,102,241,0.40)',
  },
  danger: {
    bg: 'rgba(239,68,68,0.16)',
    fg: '#fca5a5',
    ring: 'rgba(239,68,68,0.35)',
  },
} as const
