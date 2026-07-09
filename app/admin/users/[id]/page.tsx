import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/guards'
import { getUserDetailForAdmin } from '@/app/actions/admin/users'

export const dynamic = 'force-dynamic'

/**
 * /admin/users/[id] — single-user detail view.
 *
 * Plan §8. Sections:
 *   - Profile (identity + preferences)
 *   - Usage (per-domain counts + last session)
 *   - Support actions (placeholder — wired up in phase 5 by the
 *     support actions commit; this commit ships the read-only
 *     skeleton so the link from the list page goes somewhere
 *     meaningful before destructive tooling lands).
 *
 * Sensitive fields never shown: passwordHash, reset-token hashes,
 * session token hashes. The schema's selectors don't fetch them
 * either.
 */
export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string }
}) {
  await requireAdmin()
  const { id } = await Promise.resolve(params)
  const detail = await getUserDetailForAdmin(id)
  if (!detail) notFound()

  const initials = detail.name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Link
        href="/admin/users"
        style={{
          display: 'inline-block',
          fontSize: 11, color: 'var(--muted)',
          textDecoration: 'none', marginBottom: 10,
        }}
      >
        ← All users
      </Link>

      <header style={{
        display: 'flex', alignItems: 'center', gap: 14,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: '14px 16px', marginBottom: 14,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 800, color: '#fff',
          fontFamily: 'var(--display)',
        }}>
          {initials || '·'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            margin: 0, fontSize: 18, fontWeight: 800,
            fontFamily: 'var(--display)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {detail.name}
          </h2>
          <p style={{
            margin: '2px 0 0 0', fontSize: 12, color: 'var(--muted)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {detail.email}
          </p>
        </div>
        <span style={badgePill(detail.role === 'ADMIN' ? 'indigo' : 'muted')}>
          {detail.role}
        </span>
        <span style={badgePill(detail.emailVerified ? 'green' : 'amber')}>
          {detail.emailVerified ? '✓ Verified' : '! Unverified'}
        </span>
      </header>

      <Section title="Profile">
        <DetailRow label="Email" value={detail.email} />
        <DetailRow label="Currency" value={detail.currency ?? '—'} />
        <DetailRow label="Location" value={detail.location ?? '—'} />
        <DetailRow label="School fee target" value={`¥${(detail.schoolFee ?? 0).toLocaleString()}`} />
        <DetailRow label="Per-minute pay" value={detail.actualTimesEnabled ? 'Enabled' : 'Disabled'} />
        <DetailRow label="Joined" value={detail.createdAt.toISOString().slice(0, 10)} />
        <DetailRow
          label="Email verified"
          value={detail.emailVerified ? detail.emailVerified.toISOString().slice(0, 10) : 'Not yet'}
        />
        <DetailRow
          label="Last session"
          value={detail.lastSessionAt ? detail.lastSessionAt.toISOString().slice(0, 16).replace('T', ' ') : 'No recorded session'}
          last
        />
      </Section>

      <Section title="Usage">
        <CardGrid>
          <Card label="Active sessions"  value={detail.usage.sessions} />
          <Card label="Jobs"        value={detail.usage.jobs} />
          <Card label="Shifts"      value={detail.usage.shifts} />
          <Card label="Templates"   value={detail.usage.templates} />
          <Card label="Expenses"    value={detail.usage.expenses} />
          <Card label="Budget goals"  value={detail.usage.budgetGoals} />
        </CardGrid>
      </Section>

      {/* Support actions placeholder — wired in phase 5. We
          intentionally render an empty section now so the detail
          view feels complete-but-disabled rather than 404-ish. */}
      <Section title="Support actions">
        <div style={{
          padding: 14, borderRadius: 10,
          background: 'rgba(255,255,255,0.03)',
          border: '1px dashed var(--border)',
          color: 'var(--muted)',
          fontSize: 12, lineHeight: 1.6,
        }}>
          Resend verification, force logout, and role-flip controls
          land in the next phase. Open this page for the read-only
          view until then.
        </div>
      </Section>
    </div>
  )
}

// ── UI primitives (admin-local) ──────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ margin: '0 0 18px 0' }}>
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

function DetailRow({
  label, value, last,
}: {
  label: string; value: string; last?: boolean
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '10px 14px',
      borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.02)',
    }}>
      <div style={{
        flex: '0 0 170px', fontSize: 11, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        fontWeight: 600,
      }}>
        {label}
      </div>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>
        {value}
      </div>
    </div>
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

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '14px 14px',
    }}>
      <div style={{
        fontSize: 22, fontWeight: 800, fontFamily: 'var(--display)',
        color: 'var(--text)', lineHeight: 1.1,
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

type BadgeKind = 'green' | 'amber' | 'indigo' | 'muted'
const BADGE: Record<BadgeKind, { fg: string; bg: string; ring: string }> = {
  green:  { fg: '#34d399', bg: 'rgba(16,185,129,0.12)', ring: 'rgba(16,185,129,0.25)' },
  amber:  { fg: '#fbbf24', bg: 'rgba(245,158,11,0.12)', ring: 'rgba(245,158,11,0.25)' },
  indigo: { fg: '#a5b4fc', bg: 'rgba(99,102,241,0.16)', ring: 'rgba(99,102,241,0.30)' },
  muted:  { fg: 'var(--muted)', bg: 'rgba(255,255,255,0.05)', ring: 'var(--border)' },
}

function badgePill(kind: BadgeKind): React.CSSProperties {
  const b = BADGE[kind]
  return {
    flexShrink: 0,
    padding: '2px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
    background: b.bg, color: b.fg,
    border: `1px solid ${b.ring}`,
  }
}
