import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth/session'
import { logoutAction } from '@/app/auth/actions'
import { prisma } from '@/lib/auth/prisma'

/**
 * Admin route group shell.
 *
 * Plan §17: server-side guard on every admin page. We don't expose an
 * /admin/login — `requireAdmin()` is inlined here and re-applied by
 * each child page, so even if Next.js misses this layout in some edge
 * case (cache, race) the page itself still rejects non-admins.
 *
 * Cosmetic deferred: `lucide-react` icons + the existing Topbar style
 * are re-used verbatim for visual continuity. Audit log + emails +
 * analytics + feature flags / support panel land in later phases.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.role !== 'ADMIN') redirect('/dashboard')

  // Lightweight count for the admin sidebar header. Cheap aggregate
  // query; runs on every /admin render but no client-side hydration.
  const auditCount = await prisma.adminAuditLog.count().catch(() => 0)

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10,12,20,0.96)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        padding: '8px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: -0.2, fontFamily: 'var(--display)' }}>
            🛡 BOW Admin
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
            {auditCount} audit {auditCount === 1 ? 'entry' : 'entries'}
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
          padding: '2px 8px', borderRadius: 20,
          background: 'rgba(99,102,241,0.16)',
          color: '#a5b4fc',
          border: '1px solid rgba(99,102,241,0.30)',
        }}>
          ADMIN
        </span>
        <form action={logoutAction}>
          <button title={`Signed in as ${user.name}`} style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            padding: '4px 10px', borderRadius: 6,
            fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
          }}>
            Logout
          </button>
        </form>
      </header>

      {/* Tab-style sub-nav. Order matches the plan's recommended
          admin pages. Audit Log slots in last — it is the newest
          feature and gets a clear "history" position. */}
      <nav style={{
        display: 'flex',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        position: 'sticky',
        top: 44,
        zIndex: 99,
      }}>
        {[
          { href: '/admin',          label: '📊 Overview' },
          { href: '/admin/users',    label: '👥 Users' },
          { href: '/admin/emails',   label: '✉️ Emails' },
          { href: '/admin/feedback', label: '💬 Feedback' },
          { href: '/admin/audit-log', label: '📜 Audit Log' },
        ].map((t) => (
          <AdminNavLink key={t.href} href={t.href} label={t.label} />
        ))}
      </nav>

      <main style={{ flex: 1, padding: '20px 14px 120px 14px' }}>
        {children}
      </main>
    </div>
  )
}

function AdminNavLink({ href, label }: { href: string; label: string }) {
  // We can't import usePathname() into a server component, so the
  // active-state styling is left as a default non-active look here.
  // Marking each item as plain links keeps the surface tiny.
  return (
    <Link
      href={href}
      style={{
        flex: 1, minWidth: 88,
        padding: '12px 10px',
        background: 'none', border: 'none',
        borderBottom: '3px solid transparent',
        color: 'var(--muted)',
        fontSize: 11, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.5px',
        whiteSpace: 'nowrap',
        textAlign: 'center',
      }}
    >
      {label}
    </Link>
  )
}
