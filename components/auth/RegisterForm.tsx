'use client'

import { useEffect, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { registerAction, type AuthActionState } from '@/app/auth/actions'
import { checkUserHandleAvailability } from '@/app/actions/account'
import { toast } from 'sonner'
import Field from '@/components/ui/Field'
import AuthFormStatus from './AuthFormStatus'

const initialState: AuthActionState = {}

/**
 * Visual states for the userId availability indicator. Kept as a union
 * string so the form can switch rendering cleanly per state.
 *
 *   idle        – 0–2 chars typed, no check yet
 *   tooShort    – 1–2 chars, format hint
 *   invalid     – 3+ chars but fails format rules
 *   checking    – debounce window, server lookup in flight
 *   unavailable – format OK but DB has it / reserved
 *   available   – format OK, not reserved, unique
 */
type HandleStatus =
  | { kind: 'idle' }
  | { kind: 'tooShort'; reason: string }
  | { kind: 'invalid'; reason: string }
  | { kind: 'checking' }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'available'; normalized: string }

const HANDLE_DEBOUNCE_MS = 350

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      style={{
        width: '100%',
        padding: '12px 20px',
        borderRadius: 10,
        background: disabled ? 'var(--surface)' : 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
        color: disabled ? 'var(--muted2)' : '#fff',
        border: 'none',
        fontWeight: 800,
        fontSize: 14,
        fontFamily: 'var(--display)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s',
        boxShadow: disabled ? 'none' : '0 4px 20px rgba(59,130,246,0.3)',
        letterSpacing: '0.02em',
      }}
    >
      {pending ? 'Creating account…' : 'Create account'}
    </button>
  )
}

export default function RegisterForm() {
  const [state, formAction] = useFormState(registerAction, initialState)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [userId, setUserId] = useState('')
  const [handleStatus, setHandleStatus] = useState<HandleStatus>({ kind: 'idle' })

  const strength = getStrength(password)
  const strengthLabel =
    strength === 0 ? '' : strength <= 2 ? 'Weak' : strength <= 3 ? 'Fair' : strength <= 4 ? 'Strong' : 'Very Strong'
  const strengthColor =
    strength === 0 ? 'transparent' : strength <= 2 ? '#ef4444' : strength <= 3 ? '#f97316' : strength <= 4 ? '#10b981' : '#22c55e'

  const passwordsMatch =
    password === '' || confirmPassword === '' || password === confirmPassword
  const hasMismatch = !passwordsMatch && confirmPassword.length > 0

  // Submit must hold until all gates are green.
  // - handle is optional: only block when handle was provided AND unavailable
  const handleGate =
    handleStatus.kind === 'available' ||
    handleStatus.kind === 'idle' ||
    handleStatus.kind === 'checking'
  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8 &&
    confirmPassword.length > 0 &&
    passwordsMatch &&
    strength >= 3 &&
    handleGate
  // When user typed anything in userId, force valid status before submit.
  const blockSubmitOnHandle = userId.trim().length > 0 && handleStatus.kind !== 'available'
  const finalCanSubmit = canSubmit && !blockSubmitOnHandle

  // ── Debounced handle check ────────────────────────────────────────
  // Re-runs whenever `userId` changes; cancels an in-flight check if
  // the user types again before the previous round resolves.
  useEffect(() => {
    const trimmed = userId.trim()
    if (trimmed.length === 0) {
      setHandleStatus({ kind: 'idle' })
      return
    }

    const ALLOWED = /^[a-z0-9_]+$/i
    // Quick format pre-check (cheap, runs before the debounce window).
    if (trimmed.length < 3) {
      setHandleStatus({ kind: 'tooShort', reason: '3+ characters required.' })
      return
    }
    if (trimmed.length > 30) {
      setHandleStatus({ kind: 'invalid', reason: 'Max 30 characters.' })
      return
    }
    if (!/^[A-Za-z0-9_]+$/.test(trimmed)) {
      setHandleStatus({
        kind: 'invalid',
        reason: 'Only letters, digits, and underscores.',
      })
      return
    }
    if (!/^[A-Za-z0-9]/.test(trimmed) || !/[A-Za-z0-9]$/.test(trimmed)) {
      setHandleStatus({ kind: 'invalid', reason: 'Must start and end with a letter or digit.' })
      return
    }

    // Format looks fine — show "checking" before the server reply lands.
    setHandleStatus({ kind: 'checking' })

    const timer = setTimeout(async () => {
      try {
        const res = await checkUserHandleAvailability(trimmed)
        if (res.error) {
          setHandleStatus({ kind: 'unavailable', reason: res.error })
        } else if (res.available) {
          setHandleStatus({ kind: 'available', normalized: res.normalized })
        } else {
          setHandleStatus({ kind: 'unavailable', reason: 'That handle is unavailable.' })
        }
      } catch (err) {
        setHandleStatus({ kind: 'unavailable', reason: 'Check failed. Try again.' })
      }
    }, HANDLE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [userId])

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state.error])

  return (
    <form action={formAction} style={{ display: 'grid', gap: 14 }}>
      <AuthFormStatus error={state.error} />
      <div style={{ display: 'grid', gap: 6 }}>
        <Field label="Name" name="name" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <Field label="Email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      {/* userId (handle) */}
      <div style={{ display: 'grid', gap: 6 }}>
        <label
          htmlFor="userId"
          style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }}
        >
          Handle <span style={{ color: 'var(--muted)', fontSize: 10 }}>(optional)</span>
        </label>
        <input
          id="userId"
          name="userId"
          type="text"
          autoComplete="username"
          maxLength={30}
          placeholder="e.g. nithesh_99"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          style={{
            ...inputStyle,
            border: handleFieldBorder(handleStatus.kind),
          }}
        />
        <HandleStatusRow status={handleStatus} />
      </div>

      {/* Password */}
      <div style={{ display: 'grid', gap: 6 }}>
        <label
          htmlFor="password"
          style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }}
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
        {password.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3, 4, 5].map((lvl) => (
                <div
                  key={lvl}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    background: lvl <= strength ? strengthColor : 'rgba(255,255,255,0.08)',
                    transition: 'background 200ms ease',
                  }}
                />
              ))}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: strengthColor,
                opacity: strength === 0 ? 0 : 1,
                transition: 'color 200ms ease',
              }}
            >
              {strengthLabel}
            </span>
            {password.length > 0 && password.length < 8 && (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                At least 8 characters required.
              </span>
            )}
          </div>
        )}
      </div>

      {/* Confirm Password */}
      <div style={{ display: 'grid', gap: 4 }}>
        <label
          htmlFor="confirmPassword"
          style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }}
        >
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your password"
          style={{
            ...inputStyle,
            border: hasMismatch ? '1px solid rgba(239,68,68,0.5)' : '1px solid var(--border)',
          }}
        />
        {hasMismatch && (
          <span style={{ fontSize: 11, color: '#fecaca', fontWeight: 600 }}>
            Passwords do not match.
          </span>
        )}
      </div>

      <SubmitButton disabled={!finalCanSubmit} />
    </form>
  )
}

function handleFieldBorder(
  kind: HandleStatus['kind']
): string {
  switch (kind) {
    case 'available':
      return '1px solid rgba(34,197,94,0.6)'
    case 'unavailable':
    case 'invalid':
      return '1px solid rgba(239,68,68,0.55)'
    case 'checking':
    case 'tooShort':
    case 'idle':
    default:
      return '1px solid var(--border)'
  }
}

function HandleStatusRow({ status }: { status: HandleStatus }) {
  if (status.kind === 'idle') {
    return (
      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
        Letters, digits, and underscores. 3–30 chars. Optional but recommended for sharing.
      </span>
    )
  }
  if (status.kind === 'tooShort' || status.kind === 'invalid') {
    return <span style={{ fontSize: 11, color: '#fecaca', fontWeight: 600 }}>{status.reason}</span>
  }
  if (status.kind === 'checking') {
    return <span style={{ fontSize: 11, color: 'var(--muted)' }}>Checking…</span>
  }
  if (status.kind === 'unavailable') {
    return <span style={{ fontSize: 11, color: '#fecaca', fontWeight: 600 }}>⚠ {status.reason}</span>
  }
  // available
  return (
    <span style={{ fontSize: 11, color: '#86efac', fontWeight: 700 }}>
      ✓ @{status.normalized} is available
    </span>
  )
}

function getStrength(pw: string): number {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  return Math.min(5, score)
}

const inputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
  fontFamily: 'inherit',
  transition: 'border-color 150ms ease',
}
