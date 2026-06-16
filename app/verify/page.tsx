import AuthShell from '@/components/auth/AuthShell'
import ResendVerificationForm from '@/components/auth/ResendVerificationForm'

interface VerifyPageProps {
  searchParams: { email?: string }
}

export default function VerifyPage({ searchParams }: VerifyPageProps) {
  const email = searchParams.email

  return (
    <AuthShell
      title="Check your email"
      subtitle="We've sent you a verification link. Please click it to verify your account."
      footerText="Already verified?"
      footerHref="/login"
      footerAction="Sign in"
    >
      <div>
        <p style={{ color: 'var(--muted)', lineHeight: 1.6, fontSize: '14px', textAlign: 'center', marginBottom: 8 }}>
          You must verify your email before accessing your dashboard.
          If you didn&apos;t receive an email, check your spam folder or request a new one below.
        </p>

        <div style={{
          margin: '20px 0',
          borderTop: '1px solid var(--border)',
        }} />

        <p style={{
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--muted)',
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Didn&apos;t receive the email?
        </p>

        <ResendVerificationForm defaultEmail={email} />
      </div>
    </AuthShell>
  )
}
