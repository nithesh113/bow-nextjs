import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/guards'
import { listFeedback } from '@/app/actions/admin/feedback'
import FeedbackStatusControl from './FeedbackStatusControl'

export const dynamic = 'force-dynamic'

/**
 * /admin/feedback — paginated list of community feedback (Plan §26).
 *
 * Filters: search (message / user name / email), status (NEW /
 * PLANNED / etc), type (REVIEW / FEATURE / BUG / OTHER). Inline
 * status dropdown per row drives `setFeedbackStatus`, which audits
 * itself (Plan §13).
 */
export default async function AdminFeedbackPage({
  searchParams = {},
}: {
  searchParams?: Record<string, string | undefined>
}) {
  await requireAdmin()

  const search = (searchParams.search ?? '').trim()
  const statusFilter = searchParams.status ?? 'all'
  const typeFilter   = searchParams.type   ?? 'all'
  const page = Number(searchParams.page ?? '1') || 1

  const { rows, total, pageSize } = await listFeedback({
    search, statusFilter, typeFilter, page,
  })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <h1 style={{
        fontSize: 22, fontWeight: 800, fontFamily: 'var(--display)',
        margin: '0 0 14px 0',
      }}>
        User Feedback
        <span style={{ fontSize: 13, color: 'var(--muted)', marginLeft: 8, fontWeight: 600 }}>
          {total.toLocaleString()} {total === 1 ? 'entry' : 'entries'}
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
          placeholder="Search message or user…"
          style={{
            flex: '1 1 220px', padding: '8px 10px', borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: 13,
          }}
        />
        <select name="type" defaultValue={typeFilter} style={selectStyle}>
          <option value="all">All types</option>
          <option value="REVIEW">Review</option>
          <option value="FEATURE">Feature idea</option>
          <option value="BUG">Bug report</option>
          <option value="OTHER">Other</option>
        </select>
        <select name="status" defaultValue={statusFilter} style={selectStyle}>
          <option value="all">All statuses</option>
          <option value="NEW">NEW</option>
          <option value="REVIEWING">REVIEWING</option>
          <option value="PLANNED">PLANNED</option>
          <option value="IN_PROGRESS">IN PROGRESS</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="REJECTED">REJECTED</option>
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
              <th style={th}>User</th>
              <th style={th}>Type</th>
              <th style={th}>Rating</th>
              <th style={th}>Message</th>
              <th style={th}>Page</th>
              <th style={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 18, textAlign: 'center', color: 'var(--muted)' }}>
                  No feedback matches this filter.
                </td>
              </tr>
            ) : rows.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ ...td, whiteSpace: 'nowrap' as const, color: 'var(--muted)' }}>
                  {r.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                </td>
                <td style={td}>
                  <div style={{ fontWeight: 700 }}>{r.user.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.user.email}</div>
                </td>
                <td style={td}>
                  <span style={typeBadge(typeColor(r.type))}>{r.type}</span>
                </td>
                <td style={{ ...td, textAlign: 'center' as const }}>
                  {r.rating != null ? '★'.repeat(r.rating) : <span style={{ color: 'var(--muted)' }}>—</span>}
                </td>
                <td style={td}>
                  <div style={{
                    maxWidth: 360, whiteSpace: 'pre-wrap' as const,
                    overflow: 'hidden',
                  }}>
                    {r.message}
                  </div>
                </td>
                <td style={{ ...td, color: 'var(--muted)', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>
                  {r.page ?? '—'}
                </td>
                <td style={td}>
                  <FeedbackStatusControl feedbackId={r.id} status={r.status} />
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
const selectStyle: React.CSSProperties = {
  padding: '8px 10px', borderRadius: 8,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 13,
  minWidth: 130,
}
function typeColor(type: 'REVIEW' | 'FEATURE' | 'BUG' | 'OTHER'): 'green' | 'amber' | 'red' | 'indigo' {
  switch (type) {
    case 'REVIEW':  return 'green'
    case 'FEATURE': return 'indigo'
    case 'BUG':     return 'red'
    case 'OTHER':   return 'amber'
  }
}
const TYPE_COLORS = {
  green:  { fg: '#34d399', bg: 'rgba(16,185,129,0.12)',  ring: 'rgba(16,185,129,0.28)' },
  amber:  { fg: '#fbbf24', bg: 'rgba(245,158,11,0.12)',  ring: 'rgba(245,158,11,0.28)' },
  red:    { fg: '#fca5a5', bg: 'rgba(239,68,68,0.16)',   ring: 'rgba(239,68,68,0.32)' },
  indigo: { fg: '#a5b4fc', bg: 'rgba(99,102,241,0.16)',  ring: 'rgba(99,102,241,0.30)' },
}
function typeBadge(kind: keyof typeof TYPE_COLORS): React.CSSProperties {
  const b = TYPE_COLORS[kind]
  return {
    display: 'inline-block',
    padding: '2px 8px', borderRadius: 6,
    background: b.bg, color: b.fg,
    border: `1px solid ${b.ring}`,
    fontWeight: 700, fontSize: 11,
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
  return qs ? `/admin/feedback?${qs}` : '/admin/feedback'
}
