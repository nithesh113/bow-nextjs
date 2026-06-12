'use client'

import { useState, useMemo } from 'react'
import Modal, { btnPrimary, btnSuccess } from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'
import { useJobsStore } from '@/store/useJobsStore'
import { useShiftsStore } from '@/store/useShiftsStore'
import { dateKey, todayKey } from '@/lib/dateUtils'
import { calcShiftHours, calcShiftEarned } from '@/lib/nightPayEngine'
import { formatHours, formatYen, todayISO } from '@/lib/timeUtils'
import type { Shift } from '@/types'

export default function ShiftEntryModal() {
  const { closeModal } = useAppStore()
  const { jobs } = useJobsStore()
  const { shifts, addShift, recalculateDayHours } = useShiftsStore()

  // Smart default: find next date without shifts
  const nextEmptyDate = useMemo(() => {
    const today = new Date()
    for (let i = 0; i < 30; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i)
      const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate())
      if (!shifts[dk]?.length) return dk
    }
    return todayISO()
  }, [shifts])

  const [date, setDate]   = useState(nextEmptyDate)
  const [jobId, setJobId] = useState(jobs[0]?.id || '')
  const [start, setStart] = useState('09:00')
  const [end, setEnd]     = useState('17:00')
  const [breaks, setBreaks] = useState(0)

  const job = jobs.find(j => j.id === jobId)
  const previewShift: Shift = { jobId, start, end, breaks: [] }
  const hrs    = calcShiftHours(previewShift)
  const earned = job ? calcShiftEarned(previewShift, job) : 0

  const save = () => {
    if (!jobId || !start || !end || !date) return false
    const shift: Shift = { jobId, start, end, breaks: [] }
    addShift(date, shift)
    recalculateDayHours(date)
    return true
  }

  const handleSave = () => { if (save()) closeModal() }
  const handleSaveContinue = () => {
    if (save()) {
      // Advance to next empty date
      const nextD = new Date(date); nextD.setDate(nextD.getDate() + 1)
      setDate(dateKey(nextD.getFullYear(), nextD.getMonth(), nextD.getDate()))
    }
  }

  return (
    <Modal title="📅 Add Shift" footer={
      <>
        <button onClick={handleSave} style={btnPrimary}>Save</button>
        <button onClick={handleSaveContinue} style={btnSuccess}>Save + Continue</button>
      </>
    }>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={L}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label style={L}>Job</label>
          <select value={jobId} onChange={e => setJobId(e.target.value)}>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={L}>Start Time</label>
            <input type="time" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div>
            <label style={L}>End Time</label>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
        </div>
        {/* Estimated earnings */}
        <div style={{ background: 'var(--card)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
          <div style={{ color: 'var(--muted)' }}>Estimated:</div>
          <div>
            <strong style={{ color: 'var(--text)' }}>{formatHours(hrs.total)}</strong>
            {' · '}
            <strong style={{ color: 'var(--green2)' }}>{formatYen(Math.round(earned))}</strong>
            {hrs.night > 0 && <span style={{ color: 'var(--info)', fontSize: 11 }}> (🌙 {formatHours(hrs.night)} night)</span>}
          </div>
        </div>
      </div>
    </Modal>
  )
}
const L: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }
