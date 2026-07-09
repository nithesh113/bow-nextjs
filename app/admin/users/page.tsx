import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { listUsersForAdmin } from '@/app/actions/admin/users'

export const dynamic = 'force-dynamic'

/**
 * /admin/users — paginated user list with search + role/verification
 * filters. Plan §7. Each filter is a server-readable URL searchParam
 * so admins can bookmark or share a filtered view.
 *
 * No client-side React state — filters live in the URL, the page is
 * fully server-rendered. The form is a tiny HTML form that submits
 * via GET, so refreshes and back/forward work cleanly.
 */
export default async function AdminUsersPage({
  searchParams = {},
}: {
  searchParams?: Record<string, string | undefined>
}) {
  await requireAdmin()

  const search = (searchParams.search ?? '').trim()
  const verifiedFilter =
    searchParams.verified === 'verified'  ? 'verified'   :
    searchParams.verified === 'unverified' ? 'unverified' :
    'all'
  const role =
    searchParams.role === 'ADMIN' ? 'ADMIN' :
    searchParams.role === 'USER'  ? 'USER'  :
    undefined
  const page = Number(searchParams.page ?? '1') || 1

  const { rows, total, pageSize } = await listUsersForAdmin({
    search, role, verifiedFilter, page,
  })

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      <h1 style={{
        fontSize: 22, fontWeight: 800, fontFamily: 'var(--display)',
        margin: '0 0 14px 0',
      }}>
        Users
        <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8, fontWeight: 600 }}>
          {total} total
        </span>
      </h1>

      <form
        method="GET"
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 8,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 10, marginBottom: 14,
        }}
      >
        <input
          name="search"
          defaultValue={search}
          placeholder="Search name or email…"
          style={{
            flex: '1 1 220px', padding: '8px 10px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: 13,
          }}
        />
        <select
          name="role"
          defaultValue={role ?? ''}
          style={selectStyle}
        >
          <option value="">All roles</option>
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select
          name="verified"
          defaultValue={verifiedFilter}
          style={selectStyle}
        >
          <option value="all">Verified (any)</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
        </select>
        <button type="submit" style={{
          padding: '8px 14px', borderRadius: 8,
          background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
          color: '#fff', border: 'none', fontWeight: 700, fontSize: 12,
          cursor: 'pointer',
        }}>
          Apply
        </button>
      </form>

      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 14, overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
              <th style={th}>Name</th>
              <th style={th}>Email</th>
              <th style={th}>Role</th>
              <th style={th}>Status</th>
              <th style={th}>Shifts</th>
              <th style={th}>Expenses</th>
              <th style={th}>Joined</th>
              <th style={{ ...th, textAlign: 'right' as const }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 18, textAlign: 'center', color: 'var(--muted)' }}>
                  No users match this filter.
                </td>
              </tr>
            ) : rows.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <td style={td}>{r.name}</td>
                <td style={{ ...td, color: 'var(--muted)' }}>{r.email}</td>
                <td style={td}>
                  <span style={roleBadge(r.role === 'ADMIN' ? 'indigo' : 'muted')}>
                    {r.role}
                  </span>
                </td>
                <td style={td}>
                  <span style={verifiedBadge(!!r.emailVerified)}>
                    {r.emailVerified ? '✓ Verified' : '! Unverified'}
                  </span>
                </td>
                <td style={{ ...td, textAlign: 'right' as const }}>{r.shiftsCount.toLocaleString()}</td>
                <td style={{ ...td, textAlign: 'right' as const }}>{r.expensesCount.toLocaleString()}</td>
                <td style={{ ...td, color: 'var(--muted)' }}>
                  {r.createdAt.toISOString().slice(0, 10)}
                </td>
                <td style={{ ...td, textAlign: 'right' as const }}>
                  <Link href={`/admin/users/${r.id}`} style={{
                    display: 'inline-block',
                    padding: '4px 10px', borderRadius: 8,
                    background: 'rgba(99,102,241,0.14)',
                    border: '1px solid rgba(99,102,241,0.30)',
                    color: '#a5b4fc',
                    fontWeight: 700, fontSize: 11,
                    textDecoration: 'none',
                  }}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 6,
          marginTop: 14,
          fontSize: 12, color: 'var(--muted)',
        }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={buildLink(searchParams, p)}
              style={{
                padding: '4px 10px', borderRadius: 6,
                background: p === page ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
                color: p === page ? '#fff' : 'var(--text)',
                fontWeight: 700, textDecoration: 'none',
                border: '1px solid var(--border)',
              }}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tiny local styles ──────────────────────────────────────────

const th: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left' as const,
  fontSize: 11, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
}
const td: React.CSSProperties = {
  padding: '10px 12px',
}
const selectStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 8,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 13,
  minWidth: 130,
}

function roleBadge(kind: 'indigo' | 'muted'): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
    background: kind === 'indigo' ? 'rgba(99,102,241,0.16)' : 'rgba(255,255,255,0.05)',
    color:      kind === 'indigo' ? '#a5b4fc'                 : 'var(--muted)',
    border: `1px solid ${kind === 'indigo' ? 'rgba(99,102,241,0.30)' : 'var(--border)'}`,
  }
}
function verifiedBadge(verified: boolean): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
    background: verified ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
    color:      verified ? '#34d399'              : '#fbbf24',
    border: `1px solid ${verified ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
  }
}

function buildLink(
  current: Record<string, string | undefined>,
  nextPage: number,
): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(current)) {
    if (k === 'page' || v == null) continue
    usp.set(k, v)
  }
  if (nextPage > 1) usp.set('page', String(nextPage))
  const qs = usp.toString()
  return qs ? `/admin/users?${qs}` : '/admin/users'
}
