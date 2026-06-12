'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { resetPasswordAction, type AuthActionState } from '@/app/auth/actions'
import Button from '@/components/ui/Button'
import PasswordField from '@/components/ui/PasswordField'
import AuthFormStatus from './AuthFormStatus'

const initialState: AuthActionState = {}

function SubmitButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={pending}>{pending ? 'Updating...' : 'Update password'}</Button>
}

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useFormState(resetPasswordAction, initialState)

  return (
    <form action={formAction} style={{ display: 'grid', gap: 14 }}>
      <AuthFormStatus error={state.error} />
      <input type="hidden" name="token" value={token} />
      <PasswordField label="New password" name="password" autoComplete="new-password" minLength={8} required />
      <SubmitButton />
    </form>
  )
}
