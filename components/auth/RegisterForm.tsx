'use client'

import { useEffect, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { registerAction, type AuthActionState } from '@/app/auth/actions'
import { toast } from 'sonner'
import Field from '@/components/ui/Field'
import AuthFormStatus from './AuthFormStatus'

const initialState: AuthActionState = {}

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
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const strength = getStrength(password)
  const strengthLabel =
    strength === 0 ? '' : strength <= 2 ? 'Weak' : strength <= 3 ? 'Fair' : strength <= 4 ? 'Strong' : 'Very Strong'
  const strengthColor =
    strength === 0 ? 'transparent' : strength <= 2 ? '#ef4444' : strength <= 3 ? '#f97316' : strength <= 4 ? '#10b981' : '#22c55e'

  const passwordsMatch =
    password === '' || confirmPassword === '' || password === confirmPassword
  const hasMismatch = !passwordsMatch && confirmPassword.length > 0
  const canSubmit =
    password.length >= 8 &&
    confirmPassword.length > 0 &&
    passwordsMatch &&
    strength >= 3

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state.error])

  return (
    <form action={formAction} style={{ display: 'grid', gap: 14 }}>
      <AuthFormStatus error={state.error} />
      <Field label="Name" name="name" type="text" autoComplete="name" required />
      <Field label="Email" name="email" type="email" autoComplete="email" required />

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

      {/* Confirm Password — plain password input, no toggle */}
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

      <SubmitButton disabled={!canSubmit} />
    </form>
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
