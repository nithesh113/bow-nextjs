'use client'

import { useState } from 'react'
import Modal, { btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { useJobsStore } from '@/store/useJobsStore'
import { useAppStore } from '@/store/useAppStore'
import { JOB_COLORS } from '@/lib/constants'
import type { Job } from '@/types'

export default function JobManagerModal() {
  const { jobs, addJob, updateJob, removeJob } = useJobsStore()
  const { closeModal } = useAppStore()

  // Local edit buffer; we diff against `jobs` on save and dispatch per-row
  // server actions (create / update / delete). This preserves the existing
  // "edit many, save once" UX.
  const [temp, setTemp] = useState<Job[]>(jobs.map((j) => ({ ...j })))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateRow = (i: number, key: keyof Job, val: string | number) => {
    setTemp((t) => t.map((j, idx) => (idx === i ? { ...j, [key]: val } : j)))
  }

  const addRow = () => {
    const usedColors = temp.map((j) => j.color)
    const color = JOB_COLORS.find((c) => !usedColors.includes(c)) || JOB_COLORS[0]
    setTemp((t) => [
      ...t,
      {
        id: 'pending_' + Date.now(), // placeholder; server mints the real id
        name: 'New Job',
        color,
        rate: 1100,
        nightRate: 1375,
      },
    ])
  }

  const removeRow = (i: number) => {
    if (temp.length <= 1) return alert('At least one job is required.')
    setTemp((t) => t.filter((_, idx) => idx !== i))
  }

  const handleSave = async () => {
    if (saving) return
    if (temp.some((j) => !j.name.trim())) {
      setError('All jobs must have a name.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      // Diff temp vs canonical jobs.
      const prev = jobs
      const prevById = new Map(prev.map((j) => [j.id, j] as const))
      const tempById = new Map(temp.map((j) => [j.id, j] as const))

      // Apply additive + updated first (so removals can't accidentaly
      // orphan referenced shifts if the user also added a replacement).
      for (const j of temp) {
        const existing = prevById.get(j.id)
        if (!existing) {
          // New row — server mints the real id; strip the placeholder.
          const { id: _placeholder, ...payload } = j
          // `payload` is { name, color, rate, nightRate }; cast through the
          // Omit type that `addJob` accepts.
          await addJob(payload as Omit<Job, 'id'> & { id?: string })
        } else {
          // Existing row — diff the canonical-update set server-side expects.
          const changed: Partial<Job> = {}
          if (existing.name      !== j.name)      changed.name      = j.name
          if (existing.color     !== j.color)     changed.color     = j.color
          if (existing.rate      !== j.rate)      changed.rate      = j.rate
          if (existing.nightRate !== j.nightRate) changed.nightRate = j.nightRate
          if (Object.keys(changed).length > 0) {
            await updateJob(j.id, changed)
          }
        }
      }
      // Remove rows that disappeared from temp.
      for (const j of prev) {
        if (!tempById.has(j.id)) {
          await removeJob(j.id)
        }
      }
      closeModal()
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message || 'Failed to save jobs.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title="⚙ Job Manager"
      footer={
        <>
          <button onClick={closeModal} style={btnSecondary} disabled={saving}>
            Cancel
          </button>
          <button onClick={handleSave} style={btnPrimary} disabled={saving}>
            {saving ? 'Saving…' : 'Save & Apply'}
          </button>
        </>
      }
    >
      {error && (
        <div
          style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--accent2)',
            padding: '8px 12px',
            borderRadius: 8,
            marginBottom: 10,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {temp.map((j, i) => (
        <div
          key={j.id}
          style={{
            background: 'var(--card)',
            borderRadius: 10,
            padding: 12,
            marginBottom: 10,
            borderLeft: `3px solid ${j.color}`,
          }}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={j.color}
              onChange={(e) => updateRow(i, 'color', e.target.value)}
              style={{ width: 36, height: 36, padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 6 }}
            />
            <input
              value={j.name}
              onChange={(e) => updateRow(i, 'name', e.target.value)}
              placeholder="Job name"
              style={{ flex: 1 }}
            />
            {temp.length > 1 && (
              <button
                onClick={() => removeRow(i)}
                style={{
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.3)',
                  color: 'var(--accent2)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                ✕
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={labelStyle}>Day Rate (¥/h)</label>
              <input
                type="number"
                min={900}
                max={9999}
                value={j.rate}
                onChange={(e) => updateRow(i, 'rate', Number(e.target.value))}
              />
            </div>
            <div>
              <label style={labelStyle}>Night Rate (¥/h) 22–05</label>
              <input
                type="number"
                min={900}
                max={9999}
                value={j.nightRate}
                onChange={(e) => updateRow(i, 'nightRate', Number(e.target.value))}
              />
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={addRow}
        style={{
          width: '100%',
          padding: '10px 16px',
          background: 'rgba(59,130,246,0.1)',
          border: '1px dashed rgba(59,130,246,0.4)',
          color: 'var(--accent)',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        + Add Another Job
      </button>
    </Modal>
  )
}
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 4,
}
