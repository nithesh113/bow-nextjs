'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { registerAction, type AuthActionState } from '@/app/auth/actions'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import PasswordField from '@/components/ui/PasswordField'
import AuthFormStatus from './AuthFormStatus'

const initialState: AuthActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={pending}>{pending ? 'Creating account...' : 'Create account'}</Button>
}

export default function RegisterForm() {
  const [state, formAction] = useFormState(registerAction, initialState)

  return (
    <form action={formAction} style={{ display: 'grid', gap: 14 }}>
      <AuthFormStatus error={state.error} />
      <Field label="Name" name="name" type="text" autoComplete="name" required />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <PasswordField label="Password" name="password" autoComplete="new-password" minLength={8} required />
      <SubmitButton />
    </form>
  )
}
