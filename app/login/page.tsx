import AuthShell from '@/components/auth/AuthShell'
import LoginForm from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to manage shifts, earnings, budgets, and visa-safe work hours."
      footerText="New to BOW?"
      footerHref="/register"
      footerAction="Create an account"
    >
      <LoginForm />
    </AuthShell>
  )
}
