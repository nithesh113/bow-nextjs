'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Modal from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'
import { useTemplatesStore } from '@/store/useTemplatesStore'
import { useShiftsStore } from '@/store/useShiftsStore'
import { useJobsStore } from '@/store/useJobsStore'
import { dateKey, todayKey, getWeekStart } from '@/lib/dateUtils'
import { calcShiftHours, calcShiftEarned } from '@/lib/nightPayEngine'
import { formatHours, formatYen } from '@/lib/timeUtils'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function addDays(dk: string, days: number): string {
  const [y, m, d] = dk.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function toggleDate(list: string[], dk: string): string[] {
  const i = list.indexOf(dk)
  if (i >= 0) {
    const copy = list.slice()
    copy.splice(i, 1)
    return copy
  }
  return [...list, dk].sort()
}

function fmtShort(dk: string): string {
  const [y, m, d] = dk.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[(dt.getUTCDay() + 6) % 7] ?? days[0]}, ${dt.getUTCDate()} ${months[dt.getUTCMonth()]}`
}

export default function ApplyTemplateModal() {
  const { closeModal, modalDateKey: tmplId } = useAppStore()
  const { templates, fetchTemplatesFromDB, apiReady } = useTemplatesStore()
  const { shifts } = useShiftsStore()
  const { jobs } = useJobsStore()

  // Ensure templates are loaded (modal can open before the Templates tab is visited)
  useEffect(() => {
    if (!apiReady && templates.length === 0) {
      void fetchTemplatesFromDB()
    }
  }, [apiReady, templates.length, fetchTemplatesFromDB])

  const template = templates.find(t => t.id === tmplId) || null
  const job = template ? jobs.find(j => j.id === template.jobId) : null

  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [pickerDate, setPickerDate] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)

  const today = todayKey()
  const tomorrow = useMemo(() => addDays(today, 1), [today])

  // "This week" / "Next week" dates, filtered to the template's own working days
  const thisWeekDates = useMemo(() => {
    const ws = getWeekStart(new Date())
    const all = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws)
      d.setDate(d.getDate() + i)
      return dateKey(d.getFullYear(), d.getMonth(), d.getDate())
    })
    return all.filter(dk => dk >= today && template && template.days.includes((new Date(dk + 'T00:00:00').getUTCDay() + 6) % 7))
  }, [today, template])

  const nextWeekDates = useMemo(() => {
    const ws = getWeekStart(new Date())
    const nw = new Date(ws)
    nw.setDate(nw.getDate() + 7)
    const all = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(nw)
      d.setDate(d.getDate() + i)
      return dateKey(d.getFullYear(), d.getMonth(), d.getDate())
    })
    return template ? all.filter(dk => template.days.includes((new Date(dk + 'T00:00:00').getUTCDay() + 6) % 7)) : all
  }, [template])

  const addRange = (dates: string[]) => {
    setSelectedDates(prev => {
      const set = new Set(prev)
      for (const d of dates) set.add(d)
      return Array.from(set).sort()
    })
  }

  const onPickDate = (dk: string) => {
    if (!dk) return
    setSelectedDates(prev => toggleDate(prev, dk))
    setPickerDate('')
  }

  const removeDate = (dk: string) => setSelectedDates(prev => prev.filter(d => d !== dk))

  // Preview + conflicts
  const preview = useMemo(() => {
    return selectedDates.map(dk => {
      const existing = shifts[dk] || []
      return { dk, existing, wouldConflict: existing.length > 0 }
    })
  }, [selectedDates, shifts])

  // Estimate
  const previewShift = useMemo(() => {
    if (!template) return null
    return { jobId: template.jobId, start: template.start, end: template.end, breaks: [] as never[] }
  }, [template])

  const previewJob = previewShift ? jobs.find(j => j.id === previewShift.jobId) : null
  const previewHrs = useMemo(() => previewShift ? calcShiftHours(previewShift) : null, [previewShift])
  const previewEarn = previewJob && previewHrs && previewShift ? calcShiftEarned(previewShift, previewJob) : 0

  const canSave = !!template && selectedDates.length > 0 && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    // ═══ TODO: wire persistence here (localStorage or DB) ═══
    console.log('[ApplyTemplateModal] save pending — template:', template?.id, 'dates:', selectedDates)
    await new Promise(r => setTimeout(r, 300)) // simulate save UX
    closeModal()
  }

  return (
    <Modal
      title={`📅 Apply: ${template?.name || 'Template'}`}
      footer={
        <div style={{ display: 'flex', gap: 10, width: '100%', alignItems: 'center' }}>
          <div style={{ flex: 1, fontSize: 11, color: 'var(--muted)' }}>
            {selectedDates.length === 0
              ? 'Pick at least one date.'
              : <>Will add <b style={{ color: 'var(--text)' }}>{selectedDates.length}</b> shift{selectedDates.length !== 1 ? 's' : ''}</>
            }
          </div>
          <button onClick={closeModal} style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text)' }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              padding: '10px 14px',
              background: canSave ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
              color: canSave ? '#fff' : 'var(--muted)',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Saving…' : `Save ${selectedDates.length} shift${selectedDates.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      }
    >
      {/* Template context chip */}
      {template && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{template.name}</div>
            <div style={{ color: 'var(--muted)', marginTop: 2 }}>
              {job?.name ?? 'Unknown job'} · {template.start}–{template.end} · {formatHours(previewHrs?.total ?? 0)}/day
              {previewHrs && previewHrs.night > 0 && <span style={{ color: 'var(--info)', marginLeft: 4 }}>🌙 {formatHours(previewHrs.night)} night</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right', color: 'var(--muted)', fontSize: 11 }}>
            {previewJob ? (
              <>est. <b style={{ color: 'var(--green2)' }}>{formatYen(Math.round(previewEarn))}</b>/day</>
            ) : (
              <span style={{ color: 'var(--muted)' }}>no rate</span>
            )}
          </div>
        </div>
      )}

      {/* Days-of-week pills */}
      {template && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
          {DAY_NAMES.map((d, i) => {
            const active = template.days.includes(i)
            return (
              <span key={i} style={{
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                background: active ? (job?.color || 'var(--accent)') + '22' : 'rgba(255,255,255,0.04)',
                color: active ? (job?.color || 'var(--accent)') : 'var(--muted2)',
                border: `1px solid ${active ? (job?.color || 'var(--accent)') + '55' : 'transparent'}`,
              }}>{d}</span>
            )
          })}
        </div>
      )}

      {/* Quick-pick pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        <PillBtn onClick={() => addRange([today])}>Today</PillBtn>
        <PillBtn onClick={() => addRange([tomorrow])}>Tomorrow</PillBtn>
        <PillBtn onClick={() => addRange(thisWeekDates)}>This week</PillBtn>
        <PillBtn onClick={() => addRange(nextWeekDates)}>Next week</PillBtn>
        <PillBtn onClick={() => setShowPicker(v => !v)} active={showPicker}>
          {showPicker ? '✕ Hide picker' : '📅 Pick dates…'}
        </PillBtn>
      </div>

      {showPicker && (
        <div style={{ marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="date"
            value={pickerDate}
            onChange={e => onPickDate(e.target.value)}
            min={today}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              padding: '8px 10px',
              borderRadius: 8,
              fontFamily: 'inherit',
              fontSize: 13,
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Pick one by one — each date toggles on/off.</span>
        </div>
      )}

      {/* Selected chips */}
      {selectedDates.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Selected ({selectedDates.length})</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {selectedDates.map(dk => (
              <span key={dk} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '3px 8px', borderRadius: 6,
                background: 'rgba(59,130,246,0.15)', color: 'var(--accent)',
                fontSize: 11, fontWeight: 600,
              }}>
                {fmtShort(dk)}
                <button
                  onClick={() => removeDate(dk)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}
                  aria-label={`Remove ${dk}`}
                >×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Preview list */}
      {preview.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Preview ({preview.length})</label>
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {preview.map(({ dk, existing, wouldConflict }) => (
              <div key={dk} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--card)',
                border: `1px solid ${wouldConflict ? 'rgba(250, 204, 21, 0.35)' : 'var(--border)'}`,
                borderRadius: 6, padding: '6px 10px', fontSize: 12,
              }}>
                <span style={{ color: 'var(--text)' }}>{fmtShort(dk)}</span>
                <span style={{ color: wouldConflict ? 'var(--yellow, #facc15)' : 'var(--muted)' }}>
                  {existing.length === 0
                    ? <span>empty</span>
                    : <span>⚠ {existing.length} shift{existing.length !== 1 ? 's' : ''} already</span>}
                </span>
                <button
                  onClick={() => removeDate(dk)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, padding: 0 }}
                  aria-label={`Remove ${dk}`}
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estimate summary */}
      {preview.length > 0 && previewJob && previewHrs && (
        <div style={{ background: 'var(--card)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
          <div style={{ marginBottom: 4 }}>
            Per shift: <strong style={{ color: 'var(--text)' }}>{formatHours(previewHrs.total)}</strong>
            {' · '}<strong style={{ color: 'var(--green2)' }}>{formatYen(Math.round(previewEarn))}</strong>
            {previewHrs.night > 0 && (
              <span style={{ color: 'var(--info)', fontSize: 11 }}> (🌙 {formatHours(previewHrs.night)} night)</span>
            )}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, color: 'var(--text)' }}>
            Total for <strong>{selectedDates.length}</strong> shift{selectedDates.length !== 1 ? 's' : ''}:
            {' '}<strong>{formatHours(previewHrs.total * selectedDates.length)}</strong>
            {' · '}<strong style={{ color: 'var(--green2)' }}>{formatYen(Math.round(previewEarn * selectedDates.length))}</strong>
          </div>
        </div>
      )}

      {!template && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--red, #f87171)',
        }}>
          Template not found. It may have been deleted.
        </div>
      )}
    </Modal>
  )
}

function PillBtn({ onClick, children, active }: { onClick: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 12px',
        background: active ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        color: active ? 'var(--accent)' : 'var(--text)',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}
