'use client'

import Link from 'next/link'
import { useFormState, useFormStatus } from 'react-dom'
import { loginAction, type AuthActionState } from '@/app/auth/actions'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
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
      <Field label="Email" name="email" type="email" autoComplete="email" required />
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
