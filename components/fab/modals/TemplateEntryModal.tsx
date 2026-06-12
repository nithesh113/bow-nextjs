'use client'

import { useState } from 'react'
import Modal, { btnPrimary, btnSuccess } from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'
import { useJobsStore } from '@/store/useJobsStore'
import { useTemplatesStore } from '@/store/useTemplatesStore'
import { useShiftsStore } from '@/store/useShiftsStore'
import { DAY_NAMES } from '@/lib/constants'
import { calcShiftHours } from '@/lib/nightPayEngine'
import { formatHours } from '@/lib/timeUtils'
import type { Template, Shift } from '@/types'
import { getWeekStart } from '@/lib/dateUtils'

export default function TemplateEntryModal() {
  const { closeModal } = useAppStore()
  const { jobs } = useJobsStore()
  const { addTemplate } = useTemplatesStore()
  const { addShift } = useShiftsStore()

  const [name, setName]   = useState('')
  const [jobId, setJobId] = useState(jobs[0]?.id || '')
  const [start, setStart] = useState('09:00')
  const [end, setEnd]     = useState('17:00')
  const [days, setDays]   = useState<number[]>([])

  const toggleDay = (d: number) =>
    setDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d])

  const preview: Shift = { jobId, start, end, breaks: [] }
  const hrs = calcShiftHours(preview)

  const handleSave = () => {
    if (!name.trim() || !jobId || days.length < 1) return alert('Fill all fields and select at least one day.')
    const t: Template = { id: 't' + Date.now(), name: name.trim(), days, jobId, start, end }
    addTemplate(t)
    closeModal()
  }

  const handleSaveAndUse = () => {
    if (!name.trim() || !jobId || days.length < 1) return alert('Fill all fields and select at least one day.')
    const t: Template = { id: 't' + Date.now(), name: name.trim(), days, jobId, start, end }
    addTemplate(t)
    // Apply to current week
    const ws = getWeekStart(new Date())
    const daysArr = Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(d.getDate() + i); return d })
    for (const d of daysArr) {
      const mi = (d.getDay() + 6) % 7
      if (!days.includes(mi)) continue
      const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      addShift(dk, { jobId, start, end, breaks: [] })
    }
    closeModal()
  }

  return (
    <Modal title="📋 New Template" footer={
      <>
        <button onClick={handleSave} style={btnPrimary}>Save</button>
        <button onClick={handleSaveAndUse} style={btnSuccess}>Save + Use Now</button>
      </>
    }>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={L}>Template Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning Shift" autoFocus />
        </div>

        <div>
          <label style={L}>Repeat Days</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>
            {DAY_NAMES.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)} style={{
                padding: '7px 0', borderRadius: 7, fontSize: 10, fontWeight: 700,
                cursor: 'pointer',
                border: days.includes(i) ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: days.includes(i) ? 'rgba(59,130,246,0.2)' : 'var(--card)',
                color: days.includes(i) ? 'var(--accent)' : 'var(--muted)',
              }}>{d.slice(0, 2)}</button>
            ))}
          </div>
        </div>

        <div>
          <label style={L}>Job</label>
          <select value={jobId} onChange={e => setJobId(e.target.value)}>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><label style={L}>Start</label><input type="time" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div><label style={L}>End</label><input type="time" value={end} onChange={e => setEnd(e.target.value)} /></div>
        </div>

        <div style={{ background: 'var(--card)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: 'var(--muted)' }}>
          Hours/day: <strong style={{ color: 'var(--text)' }}>{formatHours(hrs.total)}</strong>
        </div>
      </div>
    </Modal>
  )
}
const L: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }
