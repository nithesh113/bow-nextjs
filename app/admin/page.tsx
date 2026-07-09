import { prisma } from '@/lib/auth/prisma'
import { requireAdmin } from '@/lib/auth/guards'

/**
 * Admin overview cards.
 *
 * Plan §6 (Feature 1). Each card is an inline `prisma.aggregate` so
 * the data is fresh on every request. No caching yet — v7.0 minimum
 * viable. Counts come from one Promise.all round-trip; likely under
 * ~30ms on a small dataset.
 *
 * Plan §21 explicitly scopes this for v7.0. Email monitoring,
 * analytics charts, feature flags are deferred.
 */
export default async function AdminOverviewPage() {
  await requireAdmin()

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    verifiedUsers,
    adminUsers,
    newLast7d,
    totalJobs,
    totalShifts,
    totalExpenses,
    totalTemplates,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: { not: null } } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.userJob.count(),
    prisma.userShift.count(),
    prisma.expense.count(),
    prisma.userTemplate.count(),
  ])

  const unverifiedUsers = totalUsers - verifiedUsers

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{
        fontSize: 22, fontWeight: 800, fontFamily: 'var(--display)',
        margin: '0 0 16px 0',
      }}>
        Admin Overview
      </h1>

      <Section title="Users">
        <CardGrid>
          <Card label="Total users" value={totalUsers} />
          <Card label="Verified" value={verifiedUsers} accent="green" />
          <Card label="Unverified" value={unverifiedUsers} accent={unverifiedUsers > 0 ? 'amber' : undefined} />
          <Card label="Admins" value={adminUsers} accent="indigo" />
          <Card label="New (7d)" value={newLast7d} />
        </CardGrid>
      </Section>

      <Section title="App usage">
        <CardGrid>
          <Card label="Jobs" value={totalJobs} />
          <Card label="Shifts" value={totalShifts} />
          <Card label="Expenses" value={totalExpenses} />
          <Card label="Templates" value={totalTemplates} />
        </CardGrid>
      </Section>

      <Section title="Next steps">
        <ul style={{
          margin: 0, paddingLeft: 18,
          fontSize: 13, lineHeight: 1.7, color: 'var(--muted)',
        }}>
          <li>Open <strong style={{ color: 'var(--text)' }}>Users</strong> in the top nav to inspect accounts, resend verification, or change roles.</li>
          <li>Open <strong style={{ color: 'var(--text)' }}>Audit Log</strong> to see what admins have done.</li>
        </ul>
      </Section>
    </div>
  )
}

// ── Local UI primitives (admin-only — kept inline to avoid coupling
//    with the user dashboard's design tokens). ────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ margin: '0 0 22px 0' }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        margin: '0 0 8px 0',
      }}>
        {title}
      </div>
      {children}
    </section>
  )
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
      gap: 10,
    }}>
      {children}
    </div>
  )
}

type Accent = 'green' | 'amber' | 'indigo'
const ACCENT_COLORS: Record<Accent, { fg: string; ring: string }> = {
  green:  { fg: '#34d399', ring: 'rgba(16,185,129,0.22)' },
  amber:  { fg: '#fbbf24', ring: 'rgba(245,158,11,0.22)' },
  indigo: { fg: '#a5b4fc', ring: 'rgba(99,102,241,0.22)' },
}

function Card({
  label, value, accent,
}: {
  label: string; value: number; accent?: Accent
}) {
  const a = accent && ACCENT_COLORS[accent]
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '14px 14px',
      boxShadow: a ? `0 0 0 1px ${a.ring}` : undefined,
    }}>
      <div style={{
        fontSize: 24, fontWeight: 800, fontFamily: 'var(--display)',
        color: a?.fg ?? 'var(--text)',
        lineHeight: 1.1,
      }}>
        {value.toLocaleString()}
      </div>
      <div style={{
        fontSize: 11, color: 'var(--muted)',
        marginTop: 4, fontWeight: 600,
      }}>
        {label}
      </div>
    </div>
  )
}
