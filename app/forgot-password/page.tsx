import AuthShell from '@/components/auth/AuthShell'
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm'

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset password"
      subtitle="Enter your email and BOW will send a reset link."
      footerText="Remembered it?"
      footerHref="/login"
      footerAction="Sign in"
    >
      <ForgotPasswordForm />
    </AuthShell>
  )
}
