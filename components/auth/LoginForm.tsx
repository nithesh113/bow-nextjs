'use client'

import Link from 'next/link'
import { useFormState, useFormStatus } from 'react-dom'
import { loginAction, type AuthActionState } from '@/app/auth/actions'
import Button from '@/components/ui/Button'
import PasswordField from '@/components/ui/PasswordField'
import AuthFormStatus from './AuthFormStatus'

const initialState: AuthActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={pending}>{pending ? 'Signing in...' : 'Sign in'}</Button>
}

export default function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initialState)

  return (
    <form action={formAction} style={{ display: 'grid', gap: 14 }}>
      <AuthFormStatus error={state.error} />
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }}>
          Email or handle
        </span>
        <input
          name="identifier"
          type="text"
          autoComplete="username"
          required
          placeholder="you@example.com  or  @nithesh_99"
          style={{
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
          }}
        />
      </label>
      <PasswordField label="Password" name="password" autoComplete="current-password" required />
      <div style={{ textAlign: 'right', marginTop: -4 }}>
        <Link href="/forgot-password" style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
          Forgot password?
        </Link>
      </div>
      <SubmitButton />
    </form>
  )
}
