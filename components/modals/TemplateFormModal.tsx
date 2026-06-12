'use client'

import { useState } from 'react'
import Modal, { btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'
import { useJobsStore } from '@/store/useJobsStore'
import { useTemplatesStore } from '@/store/useTemplatesStore'
import { calcShiftHours } from '@/lib/nightPayEngine'
import { formatHours } from '@/lib/timeUtils'
import { DAY_NAMES } from '@/lib/constants'
import type { Template, Shift } from '@/types'

export default function TemplateFormModal() {
  const { closeModal } = useAppStore()
  const { jobs } = useJobsStore()
  const { addTemplate } = useTemplatesStore()

  const [name, setName]   = useState('')
  const [jobId, setJobId] = useState(jobs[0]?.id || '')
  const [start, setStart] = useState('09:00')
  const [end, setEnd]     = useState('17:00')
  const [days, setDays]   = useState<number[]>([])

  const toggleDay = (d: number) =>
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])

  const preview: Shift = { jobId, start, end, breaks: [] }
  const hrs = calcShiftHours(preview)

  const handleSave = () => {
    if (!name.trim())    return alert('Template name is required.')
    if (!jobId)          return alert('Please select a job.')
    if (days.length < 1) return alert('Select at least one day.')

    const t: Template = { id: 't' + Date.now(), name: name.trim(), days, jobId, start, end }
    addTemplate(t)
    closeModal()
  }

  return (
    <Modal
      title="🔁 Create Template"
      footer={
        <>
          <button onClick={closeModal} style={btnSecondary}>Cancel</button>
          <button onClick={handleSave} style={btnPrimary}>Save Template</button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={L}>Template Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning Shift" />
        </div>

        {/* Day selector */}
        <div>
          <label style={L}>Repeat Days</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
            {DAY_NAMES.map((d, i) => (
              <button key={i} onClick={() => toggleDay(i)} style={{
                padding: '8px 0',
                borderRadius: 8,
                border: days.includes(i) ? '2px solid var(--accent)' : '1px solid var(--border)',
                background: days.includes(i) ? 'rgba(59,130,246,0.2)' : 'var(--card)',
                color: days.includes(i) ? 'var(--accent)' : 'var(--muted)',
                fontWeight: 700, fontSize: 10, cursor: 'pointer',
              }}>
                {d.slice(0, 2)}
              </button>
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
          <div>
            <label style={L}>Start Time</label>
            <input type="time" value={start} onChange={e => setStart(e.target.value)} />
          </div>
          <div>
            <label style={L}>End Time</label>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)} />
          </div>
        </div>

        <div style={{ background: 'var(--card)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--muted)' }}>
          Hours/day: <strong style={{ color: 'var(--text)' }}>{formatHours(hrs.total)}</strong>
        </div>
      </div>
    </Modal>
  )
}
const L: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }
