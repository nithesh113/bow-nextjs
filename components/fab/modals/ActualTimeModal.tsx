'use client'

import { useMemo, useState } from 'react'
import Modal, { btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'
import { useJobsStore } from '@/store/useJobsStore'
import { useShiftsStore } from '@/store/useShiftsStore'
import {
  calcShiftHours,
  calcShiftEarned,
  requiredBreakMins,
  defaultBreakWindow,
} from '@/lib/nightPayEngine'
import { formatHours, formatYen, nowTime, todayISO, timeToMins } from '@/lib/timeUtils'
import type { Break } from '@/types'

const L: React.CSSProperties = {
  display: 'block',
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 4,
}
const inputStyle: React.CSSProperties = { width: '100%' }

/**
 * The FAB "Actual Time" modal — quick-log of when the user really clocked
 * in/out and any breaks they took. Persists to BOTH the Zustand store and
 * Postgres (via `updateActualTimes`).
 *
 * Bug-4 fixes:
 *   4a) Multi-shift picker — radio list when the day has 2+ shifts.
 *   4b) "Next Shift →" replaces the meaningless "Save + Log Again".
 *   4c) Real actual-break editor.
 *   4d) Empty-state CTA — directs the user to Add Shift first.
 *
 * Plus the Japan-law break prompt (Bug 3) is integrated here too.
 */
export default function ActualTimeModal() {
  const { closeModal } = useAppStore()
  const { jobs } = useJobsStore()
  const { shifts, updateActualTimes, recalculateDayHours } = useShiftsStore()

  // Default the date to today, but allow picking any date with a shift.
  const [date, setDate] = useState(todayISO())
  const [selectedIndex, setIdx] = useState<number>(0)
  const [login, setLogin] = useState(nowTime())
  const [logout, setLogout] = useState(nowTime())
  const [breakRows, setBreaks] = useState<Break[]>([])
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const dayShifts = shifts[date] || []
  const effectiveIndex =
    dayShifts.length === 0 ? -1 : Math.min(selectedIndex, dayShifts.length - 1)
  const selectedShift = effectiveIndex >= 0 ? dayShifts[effectiveIndex] : null

  // Sync local form state whenever the date or chosen shift changes. Using a
  // `previousKey` sentinel + a guarded setState (officially supported pattern
  // for deriving state from props) avoids a flickering `useEffect` cascade.
  const shiftKey = `${date}#${effectiveIndex}`
  const [lastKey, setLastKey] = useState<string>('')
  if (lastKey !== shiftKey) {
    setLastKey(shiftKey)
    setLogin(selectedShift?.actualLogin || nowTime())
    setLogout(selectedShift?.actualLogout || nowTime())
    setBreaks(selectedShift?.actualBreaks || [])
    setSavedAt(null)
  }

  // Real jobs lookup for the picked shift.
  const previewJob =
    selectedShift ? jobs.find((j) => j.id === selectedShift.jobId) ?? null : null

  // Re-derive earnings with the current form values.
  const previewShift = useMemo(
    () =>
      selectedShift
        ? {
            ...selectedShift,
            actualLogin: login,
            actualLogout: logout,
            actualBreaks: breakRows,
          }
        : null,
    [selectedShift, login, logout, breakRows],
  )
  const hrs = previewShift ? calcShiftHours(previewShift) : { total: 0, day: 0, night: 0 }
  const earned = previewJob && previewShift ? calcShiftEarned(previewShift, previewJob) : 0

  // Japan-law prompt — measure against the form window so it warns before save,
  // not just from the existing rows.
  const formHrs = hrs.total || (selectedShift ? calcShiftHours(selectedShift).total : 0)
  const requiredMins = formHrs >= 6 ? requiredBreakMins(formHrs) : 0
  const loggedBreakMins = breakRows.reduce((acc, b) => {
    let s = timeToMins(b.start)
    let e = timeToMins(b.end)
    if (e <= s) e += 24 * 60
    return acc + (e - s)
  }, 0)
  const missingBreakMins = Math.max(0, requiredMins - loggedBreakMins)

  const handleInsertDefaultBreak = () => {
    const win = defaultBreakWindow(login, logout, requiredMins)
    if (!win) return
    setBreaks((rs) => [...rs, { start: win.start, end: win.end }])
  }

  const handleSave = async () => {
    if (!login || !logout || !date) return
    if (effectiveIndex < 0 || !selectedShift) return
    await updateActualTimes(
      date,
      effectiveIndex,
      login,
      logout,
      breakRows.length ? breakRows : undefined,
    )
    recalculateDayHours(date)
    setSavedAt(Date.now())
  }

  const handleNextShift = () => {
    if (dayShifts.length <= 1) return
    setIdx((effectiveIndex + 1) % dayShifts.length)
  }

  const handleDateChange = (next: string) => {
    setDate(next)
    setIdx(0)
    setSavedAt(null)
  }

  // Empty-state view: no shifts logged for this date yet — point the user to
  // the Add Shift FAB instead of just erroring out (Bug 4d).
  if (dayShifts.length === 0) {
    return (
      <Modal
        title="⏱ Actual Time"
        footer={
          <button onClick={closeModal} style={btnSecondary}>Close</button>
        }
      >
        <div
          style={{
            background: 'rgba(250,204,21,0.08)',
            border: '1px solid rgba(250,204,21,0.3)',
            borderRadius: 8,
            padding: '12px',
            color: 'var(--yellow, #facc15)',
            fontSize: 12,
            marginBottom: 12,
            fontWeight: 700,
          }}
        >
          ⚠ No shift is scheduled for {date}.
        </div>
        <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>
          To log actual times, first add the shift on the calendar (or via the
          FAB → "Add Shift"), then open Actual Time for it.
        </p>
        <p style={{ fontSize: 11, color: 'var(--muted)' }}>
          Or pick a different date below.
        </p>
        <div style={{ marginTop: 12 }}>
          <label style={L}>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => handleDateChange(e.target.value)}
            style={inputStyle}
          />
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title="⏱ Actual Time"
      footer={
        <>
          <button onClick={closeModal} style={btnSecondary}>Close</button>
          <button
            onClick={handleNextShift}
            disabled={dayShifts.length <= 1}
            style={{
              ...btnSecondary,
              opacity: dayShifts.length > 1 ? 1 : 0.5,
              cursor: dayShifts.length > 1 ? 'pointer' : 'not-allowed',
            }}
            title="Advance to the next shift on the same day"
          >
            Next Shift →
          </button>
          <button onClick={handleSave} style={btnPrimary}>
            {savedAt && Date.now() - savedAt < 1500 ? '✓ Saved' : 'Save Actuals'}
          </button>
        </>
      }
    >
      {/* Date */}
      <div style={{ marginBottom: 10 }}>
        <label style={L}>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Multi-shift picker (Bug 4a) — only when >1 shift on the day. */}
      {dayShifts.length > 1 && (
        <div style={{ marginBottom: 10 }}>
          <label style={L}>Which shift?</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {dayShifts.map((s, i) => {
              const job = jobs.find((j) => j.id === s.jobId)
              const checked = i === effectiveIndex
              return (
                <label
                  key={i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: checked ? 'rgba(59,130,246,0.10)' : 'var(--card)',
                    border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 6, padding: '6px 10px',
                    fontSize: 12, cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="shift-pick"
                    checked={checked}
                    onChange={() => { setIdx(i); setSavedAt(null) }}
                  />
                  <span style={{ flex: 1 }}>
                    <b>{job?.name ?? '—'}</b>
                    <span style={{ color: 'var(--muted)' }}> · {s.start}–{s.end}</span>
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {selectedShift && (
        <>
          {/* Scheduled reminder + previous actuals */}
          <div
            style={{
              background: 'rgba(59,130,246,0.08)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 11,
              color: 'var(--muted)',
              marginBottom: 10,
            }}
          >
            Scheduled:{' '}
            <strong style={{ color: 'var(--text)' }}>
              {selectedShift.start}–{selectedShift.end}
            </strong>
            {' · '}{previewJob?.name ?? '—'}
            {(selectedShift.actualLogin || selectedShift.actualLogout) && (
              <div style={{ marginTop: 4 }}>
                Previous actuals:{' '}
                <strong style={{ color: 'var(--info)' }}>
                  {selectedShift.actualLogin || '—'}–{selectedShift.actualLogout || '—'}
                </strong>
              </div>
            )}
          </div>

          {/* Login / Logout */}
          <div
            style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: 10, marginBottom: 10,
            }}
          >
            <div>
              <label style={L}>Actual Login</label>
              <input
                type="time"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={L}>Actual Logout</label>
              <input
                type="time"
                value={logout}
                onChange={(e) => setLogout(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Japan-law break prompt (Bug 3) */}
          {missingBreakMins > 0 && (
            <div
              style={{
                background: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.35)',
                borderRadius: 6,
                padding: '8px 10px',
                marginBottom: 10,
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: 11, color: 'var(--accent2)',
                  fontWeight: 700, flex: 1,
                }}
              >
                ⚠ Japan law requires ≥{requiredMins}-min break for{' '}
                {Math.floor(formHrs)}h shifts.
              </span>
              <button
                onClick={handleInsertDefaultBreak}
                style={{
                  background: 'rgba(239,68,68,0.18)',
                  border: '1px solid rgba(239,68,68,0.4)',
                  color: 'var(--accent2)',
                  padding: '4px 10px', borderRadius: 6,
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                }}
              >
                + Insert {requiredMins}-min break
              </button>
            </div>
          )}

          {/* Breaks editor (Bug 4c) */}
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: 4,
              }}
            >
              <label style={L}>Actual Breaks</label>
              <button
                onClick={() => setBreaks((rs) => [...rs, { start: '12:00', end: '13:00' }])}
                style={{
                  background: 'rgba(59,130,246,0.15)',
                  border: '1px solid rgba(59,130,246,0.3)',
                  color: 'var(--accent)',
                  padding: '3px 8px', borderRadius: 6,
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                + Break
              </button>
            </div>
            {breakRows.map((br, i) => (
              <div
                key={i}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 32px',
                  gap: 6, marginBottom: 4,
                }}
              >
                <input
                  type="time"
                  value={br.start}
                  onChange={(e) => {
                    const next = [...breakRows]
                    next[i] = { ...next[i], start: e.target.value }
                    setBreaks(next)
                  }}
                  style={inputStyle}
                />
                <input
                  type="time"
                  value={br.end}
                  onChange={(e) => {
                    const next = [...breakRows]
                    next[i] = { ...next[i], end: e.target.value }
                    setBreaks(next)
                  }}
                  style={inputStyle}
                />
                <button
                  onClick={() => setBreaks((rs) => rs.filter((_, j) => j !== i))}
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid var(--accent2)',
                    color: 'var(--accent2)',
                    borderRadius: 6, cursor: 'pointer', fontSize: 14,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Earnings preview */}
          <div
            style={{
              background: 'var(--card)',
              borderRadius: 8, padding: '8px 12px', fontSize: 12,
            }}
          >
            <div style={{ color: 'var(--muted)', marginBottom: 2 }}>
              Actual Earnings:
            </div>
            <div>
              <strong style={{ color: 'var(--text)' }}>{formatHours(hrs.total)}</strong>
              {' · '}
              <strong style={{ color: 'var(--green2)' }}>{formatYen(Math.round(earned))}</strong>
              {hrs.night > 0 && (
                <span style={{ color: 'var(--info)' }}>
                  {' '}(🌙 {formatHours(hrs.night)} night)
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
              Final calculation based on actual times
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}
