'use client'

import { useState, useEffect } from 'react'
import type { Shift, Job, Break } from '@/types'
import { calcShiftHours, calcShiftEarned } from '@/lib/nightPayEngine'
import { formatHours, formatYen } from '@/lib/timeUtils'
import { useAppStore } from '@/store/useAppStore'

interface Props {
  shifts: Shift[]
  jobs: Job[]
  onDelete: (index: number) => void
  /** Update actual-times for an existing shift (DB-persisted via store). */
  onUpdateActual?: (index: number, login: string, logout: string, breaks?: Break[]) => void
}

export default function DayShiftsList({ shifts, jobs, onDelete, onUpdateActual }: Props) {
  const { perMinutePay } = useAppStore()

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
            borderLeft: `3px solid ${job.color}`,
            background: 'var(--card)',
            borderRadius: '0 8px 8px 0',
            padding: '8px 10px', marginBottom: 6,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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

            {/* Per-minute actual-times editor — only when toggle is ON. */}
            {perMinutePay && onUpdateActual && <ShiftActualTimesEditor shift={s} onSave={(login, logout, breaks) => onUpdateActual(i, login, logout, breaks)} />}
          </div>
        )
      })}
    </div>
  )
}

function ShiftActualTimesEditor({ shift, onSave }: { shift: Shift; onSave: (login: string, logout: string, breaks?: Break[]) => void }) {
  const [login, setLogin]   = useState(shift.actualLogin  || '')
  const [logout, setLogout] = useState(shift.actualLogout || '')
  const [breaks, setBreaks] = useState<Break[]>(shift.actualBreaks || [])
  const [open, setOpen]     = useState(!!(shift.actualLogin || shift.actualLogout))

  // Re-sync local state when the underlying shift's actuals change externally
  // (e.g. after `syncShiftsFromDB` reloads).
  useEffect(() => {
    setLogin(shift.actualLogin || '')
    setLogout(shift.actualLogout || '')
    setBreaks(shift.actualBreaks || [])
  }, [shift.actualLogin, shift.actualLogout, shift.actualBreaks])

  const dirty =
    login  !== (shift.actualLogin  || '') ||
    logout !== (shift.actualLogout || '') ||
    JSON.stringify(breaks) !== JSON.stringify(shift.actualBreaks || [])

  const handleSave = () => {
    if (!login || !logout) {
      window.alert('Both login and logout times are required.')
      return
    }
    onSave(login, logout, breaks.length ? breaks : undefined)
  }

  return (
    <div style={{ marginTop: 8, padding: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}
      >
        {open ? '▾' : '▸'} ⏱ Actual Times {login && logout ? `(${login}–${logout})` : ''}
      </button>
      {open && (
        <div style={{ marginTop: 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ fontSize: 10, color: 'var(--muted)' }}>
              Actual Login
              <input type="time" value={login} onChange={(e) => setLogin(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2 }} />
            </label>
            <label style={{ fontSize: 10, color: 'var(--muted)' }}>
              Actual Logout
              <input type="time" value={logout} onChange={(e) => setLogout(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 2 }} />
            </label>
          </div>

          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Actual Breaks</span>
              <button
                onClick={() => setBreaks((rs) => [...rs, { start: '12:00', end: '13:00' }])}
                style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--accent)', padding: '2px 6px', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}
              >
                + Break
              </button>
            </div>
            {breaks.map((b, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 4, marginBottom: 4 }}>
                <input type="time" value={b.start} onChange={(e) => setBreaks((rs) => rs.map((x, j) => j === idx ? { ...x, start: e.target.value } : x))} />
                <input type="time" value={b.end}   onChange={(e) => setBreaks((rs) => rs.map((x, j) => j === idx ? { ...x, end: e.target.value   } : x))} />
                <button
                  onClick={() => setBreaks((rs) => rs.filter((_, j) => j !== idx))}
                  style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid var(--accent2)', color: 'var(--accent2)', borderRadius: 4, cursor: 'pointer' }}
                >×</button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button
              onClick={handleSave}
              disabled={!dirty || !login || !logout}
              style={{
                background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
                color: '#fff', border: 'none', borderRadius: 6,
                padding: '6px 12px', fontSize: 11, fontWeight: 700,
                cursor: dirty && login && logout ? 'pointer' : 'not-allowed',
                opacity: dirty && login && logout ? 1 : 0.5,
              }}
            >
              Update Actuals
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
