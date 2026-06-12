import Link from 'next/link'
import Card from '@/components/ui/Card'

type AuthShellProps = {
  title: string
  subtitle: string
  footerText: string
  footerHref: string
  footerAction: string
  children: React.ReactNode
}

export default function AuthShell({
  title,
  subtitle,
  footerText,
  footerHref,
  footerAction,
  children,
}: AuthShellProps) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
    >
      <section style={{ width: '100%', maxWidth: 430 }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 700 }}>BOW</div>
          <h1 style={{ fontFamily: 'var(--font-syne)', fontSize: 30, lineHeight: 1.1, marginTop: 4 }}>
            {title}
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: 14 }}>{subtitle}</p>
        </div>

        <Card style={{ padding: 18 }}>{children}</Card>

        <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--muted)', fontSize: 13 }}>
          {footerText}{' '}
          <Link href={footerHref} style={{ color: 'var(--accent)', fontWeight: 800, textDecoration: 'none' }}>
            {footerAction}
          </Link>
        </p>
      </section>
    </main>
  )
}
