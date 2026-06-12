'use client'

import type { Shift, Job } from '@/types'
import { calcShiftHours, calcShiftEarned } from '@/lib/nightPayEngine'
import { formatHours, formatYen } from '@/lib/timeUtils'

interface Props {
  shifts: Shift[]
  jobs: Job[]
  onDelete: (index: number) => void
}

export default function DayShiftsList({ shifts, jobs, onDelete }: Props) {
  if (!shifts.length) return (
    <div style={{ color: 'var(--muted)', fontSize: 12, padding: '8px 0', marginBottom: 8 }}>
      No shifts logged for this day.
    </div>
  )

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
        Logged Shifts
      </div>
      {shifts.map((s, i) => {
        const job = jobs.find(j => j.id === s.jobId)
        if (!job) return null
        const hrs    = calcShiftHours(s)
        const earned = calcShiftEarned(s, job)
        const hasActual = !!(s.actualLogin && s.actualLogout)

        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            borderLeft: `3px solid ${job.color}`,
            background: 'var(--card)',
            borderRadius: '0 8px 8px 0',
            padding: '8px 10px', marginBottom: 6,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: job.color }}>{job.name}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                {s.start} – {s.end}
                {hasActual && (
                  <span style={{ color: 'var(--info)' }}> (A: {s.actualLogin}–{s.actualLogout})</span>
                )}
                {s.breaks.length > 0 && (
                  <span> · {s.breaks.length} break{s.breaks.length > 1 ? 's' : ''}</span>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 700 }}>{formatHours(hrs.total)}</div>
              <div style={{ fontSize: 10, color: 'var(--green2)' }}>{formatYen(Math.round(earned))}</div>
            </div>
            <button
              onClick={() => { if (window.confirm('Delete this shift?')) onDelete(i) }}
              style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                color: 'var(--accent2)', borderRadius: 6, padding: '4px 8px',
                fontSize: 11, cursor: 'pointer',
              }}
            >
              Delete
            </button>
          </div>
        )
      })}
    </div>
  )
}
