'use client'

import { useState } from 'react'
import Modal, { btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'
import { useTemplatesStore } from '@/store/useTemplatesStore'
import { useShiftsStore } from '@/store/useShiftsStore'
import { CONFIG } from '@/lib/constants'
import { getWeekStart } from '@/lib/dateUtils'

export default function ApplyTemplateModal() {
  const { closeModal, modalDateKey: tmplId } = useAppStore()
  const { templates, applyTemplateToWeeks } = useTemplatesStore()
  const { addShift } = useShiftsStore()

  const template = templates.find(t => t.id === tmplId)
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>([])

  // Generate next 8 week-start dates from today
  const weeks: Date[] = []
  const today = new Date()
  let ws = getWeekStart(today)
  for (let i = 0; i < CONFIG.APPLY_TEMPLATE_WEEKS; i++) {
    weeks.push(new Date(ws))
    ws = new Date(ws); ws.setDate(ws.getDate() + 7)
  }

  const toggleWeek = (iso: string) =>
    setSelectedWeeks(prev => prev.includes(iso) ? prev.filter(x => x !== iso) : [...prev, iso])

  const handleApply = () => {
    if (!selectedWeeks.length) return alert('Select at least one week.')
    const weekDates = selectedWeeks.map(iso => new Date(iso))
    applyTemplateToWeeks(tmplId!, weekDates, addShift)
    closeModal()
  }

  const fmtWeek = (d: Date) => {
    const end = new Date(d); end.setDate(end.getDate() + 6)
    const fmt = (dt: Date) => `${dt.getDate()}/${dt.getMonth() + 1}`
    return `${fmt(d)} – ${fmt(end)}`
  }

  return (
    <Modal
      title={`Apply: ${template?.name || 'Template'}`}
      footer={
        <>
          <button onClick={closeModal} style={btnSecondary}>Cancel</button>
          <button onClick={handleApply} style={btnPrimary}>
            Apply to {selectedWeeks.length} Week{selectedWeeks.length !== 1 ? 's' : ''}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
        Select weeks to apply this template pattern to:
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {weeks.map(w => {
          const iso = w.toISOString().slice(0, 10)
          const sel = selectedWeeks.includes(iso)
          return (
            <button key={iso} onClick={() => toggleWeek(iso)} style={{
              padding: '10px 14px', textAlign: 'left',
              background: sel ? 'rgba(59,130,246,0.15)' : 'var(--card)',
              border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 8, color: sel ? 'var(--accent)' : 'var(--text)',
              fontSize: 13, fontWeight: sel ? 700 : 400, cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              {fmtWeek(w)}
              {sel && <span>✓</span>}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
