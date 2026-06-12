import AuthShell from '@/components/auth/AuthShell'
import ResetPasswordForm from '@/components/auth/ResetPasswordForm'

export default function ResetPasswordPage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token || ''

  return (
    <AuthShell
      title="Choose new password"
      subtitle="Set a new password for your BOW account."
      footerText="Back to"
      footerHref="/login"
      footerAction="sign in"
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div style={{ color: '#fecaca', fontSize: 13, fontWeight: 700 }}>Reset token is missing.</div>
      )}
    </AuthShell>
  )
}
