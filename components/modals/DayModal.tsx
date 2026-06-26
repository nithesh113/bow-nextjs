'use client'

import { useState, useEffect, useMemo } from 'react'
import Modal, { btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'
import { useJobsStore } from '@/store/useJobsStore'
import { useShiftsStore } from '@/store/useShiftsStore'
import { useTemplatesStore } from '@/store/useTemplatesStore'
import { formatDayTitle, getWeekStart, weekDays, dateKey } from '@/lib/dateUtils'
import { getDayHours, getNightHours } from '@/services/storage'
import { formatHours, formatYen, timeToMins, minsToTime, nowTime } from '@/lib/timeUtils'
import { calcShiftHours, calcShiftEarned, requiredBreakMins, defaultBreakWindow } from '@/lib/nightPayEngine'
import { CONFIG } from '@/lib/constants'
import type { Shift, Break } from '@/types'
import DayShiftsList from './DayShiftsList'
import DayTimeline from './DayTimeline'

/**
 * The "Add New Shift" form is reused as an *edit-existing* form when a single
 * shift already exists for the day. Editing it calls `updateShift`, which
 * rewrites the existing entry in place (instead of appending a duplicate).
 *
 * When more than one shift is logged (rare), the form is locked into "add
 * another" mode so the user can never accidentally overwrite the wrong row.
 */
type FormMode = 'add' | 'edit'

export default function DayModal() {
  const { modalDateKey: dk, closeModal, setModal, perMinutePay } = useAppStore()
  const { jobs } = useJobsStore()
  const { shifts, addShift, updateShift, deleteShift: deleteShiftStore, updateActualTimes, recalculateDayHours } = useShiftsStore()
  const { templates } = useTemplatesStore()

  const dayShifts = dk ? (shifts[dk] || []) : []

  // Existing-shift edit target. We only auto-edit a single shift; with 2+ we
  // leave the form in "add" mode so the user adds a third shift explicitly.
  const editingIndex = dayShifts.length === 1 ? 0 : -1
  const editingShift = editingIndex >= 0 ? dayShifts[editingIndex] : null
  const formMode: FormMode = editingShift ? 'edit' : 'add'

  // Form state — pre-filled with the existing shift's times when editing so
  // the visible times match the actual logged shift (the previous 09:00/17:00
  // defaults conflated "the form is empty" with "the shift is 09–17", which
  // made the calendar look like it was showing the wrong times).
  const [jobId, setJobId]     = useState(editingShift?.jobId    ?? jobs[0]?.id ?? '')
  const [start, setStart]     = useState(editingShift?.start    ?? '09:00')
  const [end, setEnd]         = useState(editingShift?.end      ?? '17:00')
  const [breakRows, setBreakRows] = useState<Break[]>(editingShift?.breaks ?? [])
  const [selectedTmpl, setSelectedTmpl] = useState('')

  // When the modal closes & re-opens for a different date, the useState
  // initializers above only fire on first mount — the modal stays mounted in
  // the AppShell. Re-sync the form whenever the date shifts so a previous
  // shift's times don't bleed into a fresh empty date (or vice versa).
  useEffect(() => {
    if (!dk) return
    const next = shifts[dk] || []
    const single = next.length === 1 ? next[0] : null
    setJobId(single?.jobId   ?? jobs[0]?.id ?? '')
    setStart(single?.start   ?? '09:00')
    setEnd  (single?.end     ?? '17:00')
    setBreakRows(single?.breaks ?? [])
    setSelectedTmpl('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dk])

  if (!dk) return null

  const day = parseInt(dk.split('-')[2])
  const dayOfWeek = new Date(dk).toLocaleDateString('en-US', { weekday: 'long' })
  const title = `${day} ${dayOfWeek}`

  // Week info
  const ws = getWeekStart(new Date(dk))
  const weekTotal = weekDays(ws).reduce((s, d) => {
    const k = dateKey(d.getFullYear(), d.getMonth(), d.getDate())
    return s + jobs.reduce((js, j) => js + getDayHours(k, j.id), 0)
  }, 0)
  const remaining = Math.max(0, CONFIG.WEEKLY_HOUR_LIMIT - weekTotal)
  const weekEarned = weekDays(ws).reduce((s, d) => {
    const k = dateKey(d.getFullYear(), d.getMonth(), d.getDate())
    return s + jobs.reduce((js, j) => {
      const night = getNightHours(k, j.id)
      const dayH  = getDayHours(k, j.id) - night
      const nr    = j.nightRate || Math.round(j.rate * 1.25)
      return js + dayH * j.rate + night * nr
    }, 0)
  }, 0)

  // Estimated hours from current form
  const previewShift: Shift = { jobId, start, end, breaks: breakRows }
  const previewHrs  = calcShiftHours(previewShift)
  const job = jobs.find(j => j.id === jobId)
  const previewEarned = job ? calcShiftEarned(previewShift, job) : 0

  // Japan-law break prompt: only when per-minute pay is on AND scheduled hours
  // cross the 6h threshold. Updates live as the user edits start/end.
  const requiredMins = perMinutePay && previewHrs.total >= 6
    ? requiredBreakMins(previewHrs.total)
    : 0
  const totalBreakMins = breakRows.reduce((acc, b) => {
    let s = timeToMins(b.start)
    let e = timeToMins(b.end)
    if (e <= s) e += 24 * 60
    return acc + (e - s)
  }, 0)
  const missingBreakMins = Math.max(0, requiredMins - totalBreakMins)

  /**
   * Auto-insert a default break when the form crosses the Japan-law threshold
   * and the user has no break logged. Uses a sentinel key derived from the
   * required length so the auto-insert only fires once per crossing — the user
   * can still edit, delete, or add more breaks freely.
   *
   * If the user clears all breaks (back below threshold + back above again),
   * this re-fires automatically.
   */
  const autoKey = requiredMins > 0 ? `${requiredMins}#${start}#${end}` : 'off'
  const [lastAutoKey, setLastAutoKey] = useState<string>('')
  if (
    perMinutePay &&
    requiredMins > 0 &&
    missingBreakMins > 0 &&
    lastAutoKey !== autoKey
  ) {
    const win = defaultBreakWindow(start, end, requiredMins)
    if (win) {
      setLastAutoKey(autoKey)
      setBreakRows((rows) => [...rows, { start: win.start, end: win.end }])
    }
  } else if (requiredMins === 0 && lastAutoKey !== 'off') {
    setLastAutoKey('off')
  }

  const handleTmplChange = (tmplId: string) => {
    setSelectedTmpl(tmplId)
    const t = templates.find(t => t.id === tmplId)
    if (!t) return
    setJobId(t.jobId)
    setStart(t.start)
    setEnd(t.end)
    setBreakRows([])
  }

  const handleInsertDefaultBreak = () => {
    const win = defaultBreakWindow(start, end, requiredMins)
    if (!win) return
    setBreakRows((rows) => [...rows, { start: win.start, end: win.end }])
  }

  const handleSave = () => {
    if (!jobId || !start || !end) return

    // Visa warning
    if (weekTotal + previewHrs.total > CONFIG.WEEKLY_HOUR_LIMIT) {
      setModal('visaWarning')
      return
    }

    const shift: Shift = { jobId, start, end, breaks: breakRows }
    if (formMode === 'edit' && editingIndex >= 0) {
      // Preserve the server-side id so future actual-time edits still target
      // the right DB row.
      void updateShift(dk, editingIndex, { ...editingShift, ...shift } as Shift)
    } else {
      void addShift(dk, shift)
    }
    recalculateDayHours(dk)
    // Reset form
    setBreakRows([])
    setSelectedTmpl('')
  }

  const handleDeleteShift = (index: number) => {
    deleteShiftStore(dk, index)
    recalculateDayHours(dk)
  }

  const handleUpdateActual = async (index: number, login: string, logout: string, breaks?: Break[]) => {
    await updateActualTimes(dk, index, login, logout, breaks)
    recalculateDayHours(dk)
  }

  return (
    <Modal
      title={title}
      footer={
        <>
          <button onClick={closeModal} style={btnSecondary}>Close</button>
          <button onClick={handleSave} style={btnPrimary}>
            {formMode === 'edit' ? 'Save Changes' : 'Save Shift'}
          </button>
        </>
      }
    >
      {/* Week info bar */}
      <div style={{
        background: 'var(--card)', borderRadius: 8, padding: '8px 12px',
        display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12,
        fontSize: 11, color: 'var(--muted)',
      }}>
        <span>Week: <strong style={{ color: 'var(--text)' }}>{formatHours(weekTotal)}/28h</strong></span>
        <span>Remaining: <strong style={{ color: 'var(--green2)' }}>{formatHours(remaining)}</strong></span>
        <span>Earned: <strong style={{ color: 'var(--green2)' }}>{formatYen(Math.round(weekEarned))}</strong></span>
      </div>

      {/* Existing shifts */}
      <DayShiftsList
        shifts={dayShifts}
        jobs={jobs}
        onDelete={handleDeleteShift}
        onUpdateActual={handleUpdateActual}
      />

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0', paddingTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {formMode === 'edit' ? '✏️ Edit Shift' : (dayShifts.length > 1 ? 'Add Another Shift' : 'Add New Shift')}
        </div>

        {/* Template picker */}
        {templates.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Quick Fill from Template</label>
            <select value={selectedTmpl} onChange={e => handleTmplChange(e.target.value)} style={inputStyle}>
              <option value="">— Select template —</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Job selector */}
        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Job</label>
          <select value={jobId} onChange={e => setJobId(e.target.value)} style={inputStyle}>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
        </div>

        {/* Start / End */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>Start</label>
            <input type="time" value={start} onChange={e => setStart(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>End</label>
            <input type="time" value={end} onChange={e => setEnd(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {/* Calculated hours preview */}
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, background: 'var(--card)', padding: '6px 10px', borderRadius: 6 }}>
          Est: <strong style={{ color: 'var(--text)' }}>{formatHours(previewHrs.total)}</strong>
          {' · '}
          <strong style={{ color: 'var(--green2)' }}>{formatYen(Math.round(previewEarned))}</strong>
          {previewHrs.night > 0 && (
            <span style={{ color: 'var(--info)' }}> (🌙 {formatHours(previewHrs.night)} night)</span>
          )}
        </div>

        {/* Breaks */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={{ flex: 1, paddingRight: 8 }}>
              <label style={labelStyle}>Breaks</label>
              {/* Still missing required break — red warning + manual insert button. */}
              {missingBreakMins > 0 && (
                <div style={{
                  marginTop: 6, padding: '8px 10px',
                  background: 'rgba(239,68,68,0.10)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  borderRadius: 6,
                  display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                }}>
                  <span style={{ fontSize: 11, color: 'var(--accent2)', fontWeight: 700, flex: 1 }}>
                    ⚠ Japan law requires ≥{requiredMins}-min break for {Math.floor(previewHrs.total)}h shifts.
                    None logged — paid hours will include this gap unless you save a break.
                  </span>
                  <button
                    onClick={handleInsertDefaultBreak}
                    style={{
                      ...addBtnStyle,
                      background: 'rgba(239,68,68,0.18)',
                      border: '1px solid rgba(239,68,68,0.4)',
                      color: 'var(--accent2)',
                    }}
                  >
                    + Insert {requiredMins}-min break
                  </button>
                </div>
              )}
              {/* Auto-inserted break — small confirmation that's easy to miss-edit. */}
              {missingBreakMins === 0 && requiredMins > 0 && (
                <div style={{
                  marginTop: 6, padding: '6px 10px',
                  background: 'rgba(59,130,246,0.08)',
                  border: '1px solid rgba(59,130,246,0.22)',
                  borderRadius: 6,
                  fontSize: 10, color: 'var(--accent)', fontWeight: 600,
                }}>
                  ℹ Per Japan Labor Standards Act, a ≥{requiredMins}-min break has been
                  auto-inserted. Edit or delete if it doesn’t match your actual time.
                </div>
              )}
            </div>
            <button onClick={() => setBreakRows(r => [...r, { start: '12:00', end: '13:00' }])} style={addBtnStyle}>+ Add Break</button>
          </div>
          {breakRows.map((br, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 32px', gap: 6, marginBottom: 6 }}>
              <input type="time" value={br.start} onChange={e => {
                const next = [...breakRows]; next[i] = { ...next[i], start: e.target.value }; setBreakRows(next)
              }} style={inputStyle} />
              <input type="time" value={br.end} onChange={e => {
                const next = [...breakRows]; next[i] = { ...next[i], end: e.target.value }; setBreakRows(next)
              }} style={inputStyle} />
              <button onClick={() => setBreakRows(r => r.filter((_, j) => j !== i))}
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid var(--accent2)', color: 'var(--accent2)', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
                ×
              </button>
            </div>
          ))}
        </div>

        {perMinutePay && (
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8, padding: '6px 8px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 6 }}>
            ⏱ <strong>Per-minute pay is ON.</strong> After saving this shift, expand the
            "Actual Times" section in the row above to enter clock-in / clock-out.
          </div>
        )}
      </div>

      {/* Timeline visualization */}
      <DayTimeline shifts={dayShifts} jobs={jobs} dateKey={dk} />
    </Modal>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }
const inputStyle: React.CSSProperties = { width: '100%' }
const addBtnStyle: React.CSSProperties = { background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--accent)', padding: '3px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }
