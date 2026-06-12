'use client'

import { useState, useMemo } from 'react'
import Modal, { btnPrimary, btnSecondary } from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'
import { useJobsStore } from '@/store/useJobsStore'
import { useShiftsStore } from '@/store/useShiftsStore'
import { useTemplatesStore } from '@/store/useTemplatesStore'
import { formatDayTitle, getWeekStart, weekDays, dateKey } from '@/lib/dateUtils'
import { getDayHours, getNightHours } from '@/services/storage'
import { formatHours, formatYen, timeToMins, minsToTime, nowTime } from '@/lib/timeUtils'
import { calcShiftHours, calcShiftEarned } from '@/lib/nightPayEngine'
import { CONFIG } from '@/lib/constants'
import type { Shift, Break } from '@/types'
import DayShiftsList from './DayShiftsList'
import DayTimeline from './DayTimeline'

export default function DayModal() {
  const { modalDateKey: dk, closeModal, setModal, perMinutePay } = useAppStore()
  const { jobs } = useJobsStore()
  const { shifts, addShift, deleteShift: deleteShiftStore, recalculateDayHours } = useShiftsStore()
  const { templates } = useTemplatesStore()

  const dayShifts = dk ? (shifts[dk] || []) : []

  // Form state
  const [jobId, setJobId]     = useState(jobs[0]?.id || '')
  const [start, setStart]     = useState('09:00')
  const [end, setEnd]         = useState('17:00')
  const [breakRows, setBreakRows] = useState<Break[]>([])
  const [actualLogin, setActualLogin]   = useState('')
  const [actualLogout, setActualLogout] = useState('')
  const [actualBreaks, setActualBreaks] = useState<Break[]>([])
  const [showActualBreaks, setShowActualBreaks] = useState(false)
  const [selectedTmpl, setSelectedTmpl] = useState('')

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

  const handleTmplChange = (tmplId: string) => {
    setSelectedTmpl(tmplId)
    const t = templates.find(t => t.id === tmplId)
    if (!t) return
    setJobId(t.jobId)
    setStart(t.start)
    setEnd(t.end)
    setBreakRows([])
  }

  const handleSave = () => {
    if (!jobId || !start || !end) return

    // Visa warning
    if (weekTotal + previewHrs.total > CONFIG.WEEKLY_HOUR_LIMIT) {
      setModal('visaWarning')
      return
    }

    const shift: Shift = {
      jobId, start, end, breaks: breakRows,
      ...(perMinutePay && actualLogin && actualLogout ? {
        actualLogin, actualLogout,
        ...(showActualBreaks ? { actualBreaks } : {}),
      } : {}),
    }
    addShift(dk, shift)
    recalculateDayHours(dk)
    // Reset form
    setBreakRows([])
    setActualLogin('')
    setActualLogout('')
    setActualBreaks([])
    setSelectedTmpl('')
  }

  const handleDeleteShift = (index: number) => {
    deleteShiftStore(dk, index)
    recalculateDayHours(dk)
  }

  return (
    <Modal
      title={title}
      footer={
        <>
          <button onClick={closeModal} style={btnSecondary}>Close</button>
          <button onClick={handleSave} style={btnPrimary}>Save Shift</button>
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
      <DayShiftsList shifts={dayShifts} jobs={jobs} onDelete={handleDeleteShift} />

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0', paddingTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Add New Shift
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={labelStyle}>Breaks</label>
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

        {/* Actual Times (per-minute mode) */}
        {perMinutePay && (
          <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>⏱ Actual Times</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Actual Login</label>
                <input type="time" value={actualLogin} onChange={e => setActualLogin(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Actual Logout</label>
                <input type="time" value={actualLogout} onChange={e => setActualLogout(e.target.value)} style={inputStyle} />
              </div>
            </div>
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
