'use client'

import { useState } from 'react'
import Modal, { btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { useJobsStore } from '@/store/useJobsStore'
import { useAppStore } from '@/store/useAppStore'
import { JOB_COLORS } from '@/lib/constants'
import type { Job } from '@/types'

export default function JobManagerModal() {
  const { jobs, setJobs } = useJobsStore()
  const { closeModal } = useAppStore()
  const [temp, setTemp] = useState<Job[]>(jobs.map(j => ({ ...j })))

  const updateJob = (i: number, key: keyof Job, val: string | number) => {
    setTemp(t => t.map((j, idx) => idx === i ? { ...j, [key]: val } : j))
  }

  const addJob = () => {
    const usedColors = temp.map(j => j.color)
    const color = JOB_COLORS.find(c => !usedColors.includes(c)) || JOB_COLORS[0]
    setTemp(t => [...t, { id: 'j' + Date.now(), name: 'New Job', color, rate: 1100, nightRate: 1375 }])
  }

  const removeJob = (i: number) => {
    if (temp.length <= 1) return alert('At least one job is required.')
    setTemp(t => t.filter((_, idx) => idx !== i))
  }

  const handleSave = () => {
    if (temp.some(j => !j.name.trim())) return alert('All jobs must have a name.')
    setJobs(temp)
    closeModal()
  }

  return (
    <Modal
      title="⚙ Job Manager"
      footer={
        <>
          <button onClick={closeModal} style={btnSecondary}>Cancel</button>
          <button onClick={handleSave} style={btnPrimary}>Save & Apply</button>
        </>
      }
    >
      {temp.map((j, i) => (
        <div key={j.id} style={{
          background: 'var(--card)', borderRadius: 10,
          padding: 12, marginBottom: 10,
          borderLeft: `3px solid ${j.color}`,
        }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={j.color}
              onChange={e => updateJob(i, 'color', e.target.value)}
              style={{ width: 36, height: 36, padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 6 }}
            />
            <input
              value={j.name}
              onChange={e => updateJob(i, 'name', e.target.value)}
              placeholder="Job name"
              style={{ flex: 1 }}
            />
            {temp.length > 1 && (
              <button onClick={() => removeJob(i)} style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                color: 'var(--accent2)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 13,
              }}>✕</button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Day Rate (¥/h)</label>
              <input
                type="number" min={900} max={9999}
                value={j.rate}
                onChange={e => updateJob(i, 'rate', Number(e.target.value))}
              />
            </div>
            <div>
              <label style={labelStyle}>Night Rate (¥/h) 22–05</label>
              <input
                type="number" min={900} max={9999}
                value={j.nightRate}
                onChange={e => updateJob(i, 'nightRate', Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      ))}

      <button onClick={addJob} style={{
        width: '100%', padding: '10px 16px',
        background: 'rgba(59,130,246,0.1)', border: '1px dashed rgba(59,130,246,0.4)',
        color: 'var(--accent)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
      }}>
        + Add Another Job
      </button>
    </Modal>
  )
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }
