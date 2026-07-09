import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { listEmailLog } from '@/app/actions/admin/emails'

export const dynamic = 'force-dynamic'

/**
 * /admin/emails — paginated email log (Plan §32).
 *
 * Filters: search (recipient / type / subject), status filter
 * (all / sent / failed). Tables newest-first because admins
 * usually come here when a user complains "I didn't get my
 * email" within an hour or two of the action.
 *
 * Failed rows are highlighted with a red chip and the provider's
 * error message rendered inline so a quick scan reveals the
 * dominant failure mode (auth failure, rate limit, missing DNS, …).
 */
export default async function AdminEmailsPage({
  searchParams = {},
}: {
  searchParams?: Record<string, string | undefined>
}) {
  await requireAdmin()

  const search = (searchParams.search ?? '').trim()
  const statusFilter =
    searchParams.status === 'sent'   ? 'sent'   :
    searchParams.status === 'failed' ? 'failed' :
    'all'
  const page = Number(searchParams.page ?? '1') || 1

  const { rows, total, pageSize } = await listEmailLog({
    search, statusFilter, page,
  })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // Aggregate counts for the section header — cheap and gives
  // operators immediate visibility into recent failure rate.
  const [sentCount, failedCount] = await Promise.all([
    listEmailLog({ statusFilter: 'sent',   pageSize: 1_000_000 }).catch(() => ({ total: 0, rows: [], page: 1, pageSize: 0 })),
    listEmailLog({ statusFilter: 'failed', pageSize: 1_000_000 }).catch(() => ({ total: 0, rows: [], page: 1, pageSize: 0 })),
  ]).then((r) => [r[0].total, r[1].total]) as unknown as [number, number]

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <h1 style={{
        fontSize: 22, fontWeight: 800, fontFamily: 'var(--display)',
        margin: '0 0 14px 0',
      }}>
        Email Log
        <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8, fontWeight: 600 }}>
          {total.toLocaleString()} of {sentCount + failedCount}
        </span>
        <span style={{ fontSize: 12, marginLeft: 12, color: '#34d399' }}>
          ✓ {sentCount}
        </span>
        <span style={{ fontSize: 12, marginLeft: 6, color: failedCount > 0 ? '#fca5a5' : 'var(--muted)' }}>
          ✗ {failedCount}
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
          placeholder="Filter by recipient, type, or subject…"
          style={{
            flex: 1, padding: '8px 10px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: 13,
          }}
        />
        <select
          name="status"
          defaultValue={statusFilter}
          style={{
            padding: '8px 10px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: 13,
            minWidth: 130,
          }}
        >
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
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
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)' }}>
              <th style={th}>When</th>
              <th style={th}>To</th>
              <th style={th}>Type</th>
              <th style={th}>Subject</th>
              <th style={th}>Status</th>
              <th style={th}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 18, textAlign: 'center', color: 'var(--muted)' }}>
                  No email entries match this filter.
                </td>
              </tr>
            ) : rows.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ ...td, whiteSpace: 'nowrap' as const, color: 'var(--muted)' }}>
                  {r.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap' as const }}>{r.to}</td>
                <td style={td}>
                  <span style={typeBadge}>{r.type}</span>
                </td>
                <td style={td}>{r.subject ?? '—'}</td>
                <td style={td}>
                  <span style={statusBadge(r.status)}>
                    {r.status === 'sent' ? '✓ sent' : '✗ failed'}
                  </span>
                </td>
                <td style={td}>
                  {r.status === 'sent' && r.providerMessageId ? (
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'var(--muted)' }}>
                      {r.providerMessageId}
                    </span>
                  ) : r.status === 'failed' && r.error ? (
                    <span style={{ fontSize: 11, color: '#fca5a5' }}>{r.error}</span>
                  ) : (
                    '—'
                  )}
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

// ── Local styles ──────────────────────────────────────────────

const th: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left' as const,
  fontSize: 11, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
}
const td: React.CSSProperties = {
  padding: '10px 12px', verticalAlign: 'top' as const,
}
const typeBadge: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px', borderRadius: 6,
  background: 'rgba(59,130,246,0.14)',
  color: '#93c5fd',
  border: '1px solid rgba(59,130,246,0.28)',
  fontWeight: 700, fontSize: 11,
}
function statusBadge(s: 'sent' | 'failed'): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '2px 8px', borderRadius: 6,
    fontWeight: 700, fontSize: 11,
    background: s === 'sent' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.16)',
    color:      s === 'sent' ? '#34d399'             : '#fca5a5',
    border: `1px solid ${s === 'sent' ? 'rgba(16,185,129,0.28)' : 'rgba(239,68,68,0.32)'}`,
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
  return qs ? `/admin/emails?${qs}` : '/admin/emails'
}
