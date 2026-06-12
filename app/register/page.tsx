import AuthShell from '@/components/auth/AuthShell'
import RegisterForm from '@/components/auth/RegisterForm'

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your BOW account"
      subtitle="Keep your work calendar and budget access protected."
      footerText="Already registered?"
      footerHref="/login"
      footerAction="Sign in"
    >
      <RegisterForm />
    </AuthShell>
  )
}
