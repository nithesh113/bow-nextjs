import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { listAuditLog } from '@/app/actions/admin/audit'

export const dynamic = 'force-dynamic'

/**
 * /admin/audit-log — paginated table of admin actions with a
 * single-text-box search across action / target id / admin name
 * or email. Metadata is rendered as compact <pre> chips so the
 * diff (e.g. before/after role) is human-skimmable without a
 * modal.
 */
export default async function AdminAuditLogPage({
  searchParams = {},
}: {
  searchParams?: Record<string, string | undefined>
}) {
  await requireAdmin()

  const search = (searchParams.search ?? '').trim()
  const page = Number(searchParams.page ?? '1') || 1

  const { rows, total, pageSize } = await listAuditLog({ search, page })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <h1 style={{
        fontSize: 22, fontWeight: 800, fontFamily: 'var(--display)',
        margin: '0 0 14px 0',
      }}>
        Audit Log
        <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8, fontWeight: 600 }}>
          {total.toLocaleString()} {total === 1 ? 'entry' : 'entries'}
        </span>
      </h1>

      <form
        method="GET"
        style={{
          display: 'flex', gap: 8,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: 10, marginBottom: 14,
        }}
      >
        <input
          name="search"
          defaultValue={search}
          placeholder="Filter by action, target id, admin email or name…"
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: 13,
          }}
        />
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
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
              <th style={th}>When</th>
              <th style={th}>Admin</th>
              <th style={th}>Action</th>
              <th style={th}>Target</th>
              <th style={th}>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 18, textAlign: 'center', color: 'var(--muted)' }}>
                  No audit entries match this filter.
                </td>
              </tr>
            ) : rows.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ ...td, whiteSpace: 'nowrap' as const, color: 'var(--muted)' }}>
                  {r.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                </td>
                <td style={td}>
                  <div style={{ fontWeight: 700 }}>{r.admin.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.admin.email}</div>
                </td>
                <td style={td}>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px', borderRadius: 6,
                    background: 'rgba(59,130,246,0.14)',
                    color: '#93c5fd',
                    border: '1px solid rgba(59,130,246,0.28)',
                    fontWeight: 700, fontSize: 11,
                  }}>
                    {r.action}
                  </span>
                </td>
                <td style={td}>
                  {r.targetType ? (
                    <Link
                      href={
                        r.targetType === 'user'
                          ? `/admin/users/${r.targetId ?? ''}`
                          : '#'
                      }
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px', borderRadius: 6,
                        background: 'rgba(99,102,241,0.16)',
                        color: '#a5b4fc',
                        border: '1px solid rgba(99,102,241,0.30)',
                        fontWeight: 700, fontSize: 11,
                        textDecoration: 'none',
                      }}
                    >
                      {r.targetType}
                      {r.targetId ? `:${r.targetId.slice(0, 6)}…` : ''}
                    </Link>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>—</span>
                  )}
                </td>
                <td style={td}>
                  {r.metadata ? <pre style={metaStyle}>{JSON.stringify(r.metadata, null, 0)}</pre> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 6,
          marginTop: 14, fontSize: 12, color: 'var(--muted)',
        }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={buildLink(searchParams, p)}
              style={{
                padding: '4px 10px', borderRadius: 6,
                background: p === page ? 'var(--accent)' : 'rgba(255,255,255,0.04)',
                color:      p === page ? '#fff'         : 'var(--text)',
                fontWeight:  700, textDecoration: 'none',
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

// ── Local styles (admin-only) ──────────────────────────────────

const th: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left' as const,
  fontSize: 11, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
}
const td: React.CSSProperties = {
  padding: '10px 12px', verticalAlign: 'top' as const,
}
const metaStyle: React.CSSProperties = {
  margin: 0, fontSize: 11, lineHeight: 1.4,
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  background: 'rgba(0,0,0,0.18)', padding: '4px 8px',
  borderRadius: 6, maxWidth: 380, whiteSpace: 'pre-wrap' as const,
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
  return qs ? `/admin/audit-log?${qs}` : '/admin/audit-log'
}
