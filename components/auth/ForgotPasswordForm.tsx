'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { forgotPasswordAction, type AuthActionState } from '@/app/auth/actions'
import Button from '@/components/ui/Button'
import Field from '@/components/ui/Field'
import AuthFormStatus from './AuthFormStatus'

const initialState: AuthActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={pending}>{pending ? 'Sending link...' : 'Send reset link'}</Button>
}

export default function ForgotPasswordForm() {
  const [state, formAction] = useFormState(forgotPasswordAction, initialState)

  return (
    <form action={formAction} style={{ display: 'grid', gap: 14 }}>
      <AuthFormStatus error={state.error} success={state.success} />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <SubmitButton />
    </form>
  )
}
