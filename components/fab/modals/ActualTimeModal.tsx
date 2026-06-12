'use client'

import { useState } from 'react'
import Modal, { btnPrimary, btnSuccess } from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'
import { useJobsStore } from '@/store/useJobsStore'
import { useShiftsStore } from '@/store/useShiftsStore'
import { calcShiftHours, calcShiftEarned } from '@/lib/nightPayEngine'
import { formatHours, formatYen, nowTime, todayISO } from '@/lib/timeUtils'
import type { Shift } from '@/types'

export default function ActualTimeModal() {
  const { closeModal } = useAppStore()
  const { jobs } = useJobsStore()
  const { shifts, updateActualTimes, recalculateDayHours } = useShiftsStore()

  const [date, setDate]       = useState(todayISO())
  const [login, setLogin]     = useState(nowTime())
  const [logout, setLogout]   = useState(nowTime())

  const dayShifts = shifts[date] || []
  const job = dayShifts.length > 0 ? jobs.find(j => j.id === dayShifts[0].jobId) : null

  const previewShift: Shift = {
    jobId: job?.id || jobs[0]?.id || '',
    start: login, end: logout, breaks: [],
    actualLogin: login, actualLogout: logout,
  }
  const hrs    = calcShiftHours(previewShift)
  const earned = job ? calcShiftEarned(previewShift, job) : 0

  const save = () => {
    if (!login || !logout || !date) return false
    if (dayShifts.length > 0) {
      updateActualTimes(date, 0, login, logout)
    } else {
      alert('No scheduled shift found for this date.')
      return false
    }
    recalculateDayHours(date)
    return true
  }

  const handleSave = () => { if (save()) closeModal() }
  const handleSaveAgain = () => {
    if (save()) { setLogin(nowTime()); setLogout(nowTime()) }
  }

  return (
    <Modal title="⏱ Actual Time" footer={
      <>
        <button onClick={handleSave} style={btnPrimary}>Save Actuals</button>
        <button onClick={handleSaveAgain} style={btnSuccess}>Save + Log Again</button>
      </>
    }>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={L}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        {/* Scheduled shift info */}
        {dayShifts.length > 0 && (
          <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: 'var(--muted)' }}>
            Scheduled: <strong style={{ color: 'var(--text)' }}>{dayShifts[0].start} – {dayShifts[0].end}</strong>
            {' · '}{job?.name}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={L}>Actual Login</label>
            <input type="time" value={login} onChange={e => setLogin(e.target.value)} />
          </div>
          <div>
            <label style={L}>Actual Logout</label>
            <input type="time" value={logout} onChange={e => setLogout(e.target.value)} />
          </div>
        </div>

        {/* Actual earnings */}
        <div style={{ background: 'var(--card)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
          <div style={{ color: 'var(--muted)', marginBottom: 2 }}>Actual Earnings:</div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{formatHours(hrs.total)}</strong>
            {' · '}
            <strong style={{ color: 'var(--green2)' }}>{formatYen(Math.round(earned))}</strong>
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>Final calculation based on actual times</div>
        </div>
      </div>
    </Modal>
  )
}
const L: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }
