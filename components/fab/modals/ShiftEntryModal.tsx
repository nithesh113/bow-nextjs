'use client'

import { useEffect, useMemo, useState } from 'react'
import Modal, { btnPrimary } from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'
import { useJobsStore } from '@/store/useJobsStore'
import { useShiftsStore } from '@/store/useShiftsStore'
import { useTemplatesStore } from '@/store/useTemplatesStore'
import { dateKey, todayKey, getWeekStart } from '@/lib/dateUtils'
import { calcShiftHours, calcShiftEarned } from '@/lib/nightPayEngine'
import { formatHours, formatYen } from '@/lib/timeUtils'

type Source = 'template' | 'custom'
type ConflictPolicy = 'skip' | 'append'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_SHIFTS_PER_REQUEST = 100
const MAX_SHIFTS_PER_DAY = 5

/** Add `days` calendar days to a YYYY-MM-DD key, returning a YYYY-MM-DD key. */
function addDays(dk: string, days: number): string {
  const [y, m, d] = dk.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/** Add or remove a date from a sorted-unique list. */
function toggleDate(list: string[], dk: string): string[] {
  const i = list.indexOf(dk)
  if (i >= 0) {
    const copy = list.slice()
    copy.splice(i, 1)
    return copy
  }
  const out = [...list, dk].sort()
  return out
}

/** Format "YYYY-MM-DD" → "Mon, 22 Jun" (same shape as existing formatShortDate). */
function fmtShort(dk: string): string {
  const [y, m, d] = dk.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[(dt.getUTCDay() + 6) % 7] ?? days[0]}, ${dt.getUTCDate()} ${months[dt.getUTCMonth()]}`
}

export default function ShiftEntryModal() {
  const { closeModal } = useAppStore()
  const { jobs } = useJobsStore()
  const { shifts, addShiftsToDB } = useShiftsStore()
  const { templates, fetchTemplatesFromDB, apiReady } = useTemplatesStore()

  // Templates may not be loaded yet if user opens FAB before Templates tab.
  useEffect(() => {
    if (!apiReady && templates.length === 0) {
      void fetchTemplatesFromDB()
    }
  }, [apiReady, templates.length, fetchTemplatesFromDB])

  // ── Source toggle ────────────────────────────────────────────
  const [source, setSource] = useState<Source>('template')

  // ── Template mode ────────────────────────────────────────────
  const [templateId, setTemplateId] = useState<string>('')
  const selectedTpl = useMemo(
    () => templates.find((t) => t.id === templateId) || null,
    [templates, templateId]
  )

  // ── Custom mode fields ───────────────────────────────────────
  const [jobId, setJobId] = useState<string>(jobs[0]?.id || '')
  const [start, setStart] = useState('09:00')
  const [end, setEnd]     = useState('17:00')

  // ── Date picker ──────────────────────────────────────────────
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [pickerDate, setPickerDate] = useState('')
  const [showPicker, setShowPicker] = useState(false)

  // ── Conflict handling ────────────────────────────────────────
  const [conflictPolicy, setConflictPolicy] = useState<ConflictPolicy>('skip')

  // ── Save state ───────────────────────────────────────────────
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Reset interactive fields when switching source for a clean UX.
  useEffect(() => {
    if (source === 'template' && templates.length > 0 && !templateId) {
      setTemplateId(templates[0].id)
    }
  }, [source, templates, templateId])

  // Quick-pill handlers
  const today = todayKey()
  const thisWeekDates = useMemo(() => {
    const ws = getWeekStart(new Date())
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws); d.setDate(d.getDate() + i)
      return dateKey(d.getFullYear(), d.getMonth(), d.getDate())
    }).filter((dk) => dk >= today)
  }, [today])
  const nextWeekDates = useMemo(() => {
    const ws = getWeekStart(new Date())
    const nw = new Date(ws); nw.setDate(nw.getDate() + 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(nw); d.setDate(d.getDate() + i)
      return dateKey(d.getFullYear(), d.getMonth(), d.getDate())
    })
  }, [])
  const tomorrow = useMemo(() => addDays(today, 1), [today])

  const addRange = (dates: string[]) => {
    setSelectedDates((prev) => {
      const set = new Set(prev)
      for (const d of dates) set.add(d)
      return Array.from(set).sort()
    })
  }

  const onPickDate = (dk: string) => {
    if (!dk) return
    setSelectedDates((prev) => toggleDate(prev, dk))
    setPickerDate('')
  }

  const removeDate = (dk: string) => {
    setSelectedDates((prev) => prev.filter((d) => d !== dk))
  }

  // ── Per-date preview ─────────────────────────────────────────
  const preview = useMemo(() => {
    return selectedDates.map((dk) => {
      const existing = shifts[dk] || []
      const wouldConflict = existing.length > 0
      return { dk, existing, wouldConflict }
    })
  }, [selectedDates, shifts])

  const allConflict = preview.length > 0 && preview.every((p) => p.wouldConflict)
  const anyConflict = preview.some((p) => p.wouldConflict)

  // ── Summary counts ───────────────────────────────────────────
  const summary = useMemo(() => {
    const emptyConflicts = preview.filter((p) => p.wouldConflict).length
    let willAdd = 0
    let willSkip = 0
    for (const p of preview) {
      if (p.wouldConflict && conflictPolicy === 'skip') {
        willSkip++
      } else {
        willAdd++
      }
    }
    return { willAdd, willSkip, conflictCount: emptyConflicts }
  }, [preview, conflictPolicy])

  // ── Source-aware required-fields check ───────────────────────
  const hasSource =
    (source === 'template' && !!selectedTpl) ||
    (source === 'custom' && !!jobId && !!start && !!end)

  const canSave = hasSource && selectedDates.length > 0 && summary.willAdd > 0 && !allConflict && !saving

  // ── Estimate preview chip ────────────────────────────────────
  const previewShift = useMemo(() => {
    if (source === 'template' && selectedTpl) {
      return { jobId: selectedTpl.jobId, start: selectedTpl.start, end: selectedTpl.end, breaks: [] as never[] }
    }
    return { jobId, start, end, breaks: [] as never[] }
  }, [source, selectedTpl, jobId, start, end])

  const previewJob = jobs.find((j) => j.id === previewShift.jobId)
  const previewHrs = useMemo(() => calcShiftHours(previewShift), [previewShift])
  const previewEarn = previewJob ? calcShiftEarned(previewShift, previewJob) : 0

  // ── Save handler ─────────────────────────────────────────────
  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setErrorMsg(null)
    try {
      const sources = ['template', 'manual'] as const
      const shiftSource: typeof sources[number] =
        selectedTpl && source !== 'custom' ? 'template' : 'manual'

      const inputs = preview
        .filter((p) => !(p.wouldConflict && conflictPolicy === 'skip'))
        .filter((p) => (shifts[p.dk]?.length ?? 0) < MAX_SHIFTS_PER_DAY)
        .map((p) => ({
          date: p.dk,
          jobId: previewShift.jobId,
          start: previewShift.start,
          end: previewShift.end,
          templateId: selectedTpl?.id,
          source: shiftSource,
        }))

      if (inputs.length === 0) {
        setErrorMsg('Nothing to save (every selected date would exceed the per-day limit).')
        setSaving(false)
        return
      }
      if (inputs.length > MAX_SHIFTS_PER_REQUEST) {
        setErrorMsg(`Too many shifts at once (max ${MAX_SHIFTS_PER_REQUEST}). Pick fewer dates.`)
        setSaving(false)
        return
      }

      await addShiftsToDB(inputs)
      closeModal()
    } catch (err: unknown) {
      const e = err as { message?: string }
      setErrorMsg(e?.message || 'Failed to save shifts. Please try again.')
      setSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <Modal title="📅 Apply Shifts" footer={
      <div style={{ display: 'flex', gap: 10, width: '100%', alignItems: 'center' }}>
        <div style={{ flex: 1, fontSize: 11, color: 'var(--muted)' }}>
          {selectedDates.length === 0 ? (
            'Pick at least one date.'
          ) : (
            <>
              Will add <b style={{ color: 'var(--text)' }}>{summary.willAdd}</b>
              {' '}shift{summary.willAdd !== 1 ? 's' : ''}
              {summary.willSkip > 0 && (
                <> · skip <b style={{ color: 'var(--yellow, #facc15)' }}>{summary.willSkip}</b></>
              )}
            </>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            ...btnPrimary,
            opacity: canSave ? 1 : 0.5,
            cursor: canSave ? 'pointer' : 'not-allowed',
          }}
        >
          {saving
            ? 'Saving…'
            : summary.willAdd > 0
              ? `Save ${summary.willAdd} shift${summary.willAdd !== 1 ? 's' : ''}`
              : 'Save'}
        </button>
      </div>
    }>
      {/* ── Source toggle ──────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <SourceBtn
          active={source === 'template'}
          onClick={() => setSource('template')}
          label="📋 From template"
        />
        <SourceBtn
          active={source === 'custom'}
          onClick={() => setSource('custom')}
          label="✏️ Custom"
        />
      </div>

      {/* ── Source fields ──────────────────────────────────────── */}
      {source === 'template' ? (
        <div style={{ marginBottom: 14 }}>
          <label style={L}>Template</label>
          {templates.length === 0 ? (
            <div style={{ background: 'var(--card)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--muted)' }}>
              {apiReady
                ? <>No templates yet. Create one in the <b>Templates</b> tab, or switch to <b>Custom</b>.</>
                : <>Loading templates…</>}
            </div>
          ) : (
            <>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={{ width: '100%' }}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.start}–{t.end})</option>
                ))}
              </select>
              {selectedTpl && (
                <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--muted)' }}>
                  <span>
                    {selectedTpl.days
                      .slice()
                      .sort((a, b) => a - b)
                      .map((d) => DAY_NAMES[d])
                      .join(' ')}
                  </span>
                  <span>{jobs.find((j) => j.id === selectedTpl.jobId)?.name ?? ''}</span>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <label style={L}>Job</label>
          <select value={jobId} onChange={(e) => setJobId(e.target.value)} style={{ width: '100%' }}>
            {jobs.length === 0
              ? <option value="">No jobs yet — create one in the Jobs tab</option>
              : jobs.map((j) => <option key={j.id} value={j.id}>{j.name}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <div>
              <label style={L}>Start</label>
              <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label style={L}>End</label>
              <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* ── Quick date pills ───────────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <label style={L}>Dates</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <PillBtn onClick={() => addRange([today])}>Today</PillBtn>
          <PillBtn onClick={() => addRange([tomorrow])}>Tomorrow</PillBtn>
          <PillBtn onClick={() => addRange(thisWeekDates)}>This week</PillBtn>
          <PillBtn onClick={() => addRange(nextWeekDates)}>Next week</PillBtn>
          <PillBtn onClick={() => setShowPicker((v) => !v)} active={showPicker}>
            {showPicker ? '✕ Hide picker' : '📅 Pick dates…'}
          </PillBtn>
        </div>

        {showPicker && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="date"
              value={pickerDate}
              onChange={(e) => onPickDate(e.target.value)}
              min={today}
            />
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Date input (range mode):
            </span>
          </div>
        )}

        {selectedDates.length > 0 && (
          <DateRangePicker
            selected={selectedDates}
            onAdd={onPickDate}
            onRemove={removeDate}
          />
        )}
      </div>

      {/* ── Conflict policy (only if at least one conflict) ──── */}
      {anyConflict && (
        <div style={{ background: 'rgba(250, 204, 21, 0.08)', border: '1px solid rgba(250, 204, 21, 0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, color: 'var(--yellow, #facc15)', marginBottom: 4 }}>
            ⚠ {summary.conflictCount} selected date{summary.conflictCount !== 1 ? 's have' : ' has'} existing shifts
          </div>
          <label style={L}>For those dates,</label>
          <select value={conflictPolicy} onChange={(e) => setConflictPolicy(e.target.value as ConflictPolicy)} style={{ width: '100%' }}>
            <option value="skip">Skip them (leave existing shifts alone)</option>
            <option value="append">Add this shift on top of existing ones</option>
          </select>
        </div>
      )}

      {/* ── Preview list ───────────────────────────────────────── */}
      {preview.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <label style={L}>Preview ({preview.length})</label>
          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {preview.map(({ dk, existing, wouldConflict }) => (
              <div
                key={dk}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'var(--card)',
                  border: `1px solid ${wouldConflict ? 'rgba(250, 204, 21, 0.35)' : 'var(--border)'}`,
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 12,
                }}
              >
                <span style={{ color: 'var(--text)' }}>{fmtShort(dk)}</span>
                <span style={{ color: wouldConflict ? 'var(--yellow, #facc15)' : 'var(--muted)' }}>
                  {existing.length === 0
                    ? <span>empty</span>
                    : <span>⚠ {existing.length} shift{existing.length !== 1 ? 's' : ''} already</span>}
                </span>
                <button
                  onClick={() => removeDate(dk)}
                  aria-label={`Remove ${dk}`}
                  style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14 }}
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Estimate summary ───────────────────────────────────── */}
      {preview.length > 0 && (
        <div style={{ background: 'var(--card)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--muted)' }}>
          {previewJob ? (
            <>
              Per shift: <strong style={{ color: 'var(--text)' }}>{formatHours(previewHrs.total)}</strong>
              {' · '}<strong style={{ color: 'var(--green2)' }}>{formatYen(Math.round(previewEarn))}</strong>
              {previewHrs.night > 0 && (
                <span style={{ color: 'var(--info)', fontSize: 11 }}> (🌙 {formatHours(previewHrs.night)} night)</span>
              )}
            </>
          ) : (
            <>Pick a job or template to estimate earnings.</>
          )}
        </div>
      )}

      {errorMsg && (
        <div style={{ marginTop: 10, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--red, #f87171)' }}>
          {errorMsg}
        </div>
      )}
    </Modal>
  )
}

// ── Sub-components ──────────────────────────────────────────────
const L: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700,
  color: 'var(--muted)', textTransform: 'uppercase',
  letterSpacing: '0.5px', marginBottom: 4,
}

function SourceBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '8px 12px',
        background: active ? 'rgba(59,130,246,0.2)' : 'var(--card)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        color: active ? 'var(--accent)' : 'var(--text)',
        borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
      }}
    >
      {label}
    </button>
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
        borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function DateRangePicker({
  selected,
  onAdd,
  onRemove,
}: {
  selected: string[]
  onAdd: (dk: string) => void
  onRemove: (dk: string) => void
}) {
  if (selected.length === 0) return null
  return (
    <div style={{ marginTop: 8 }}>
      <label style={{ ...L, marginTop: 6 }}>Selected ({selected.length})</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {selected.map((dk) => (
          <span
            key={dk}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '3px 8px', borderRadius: 6,
              background: 'rgba(59,130,246,0.15)', color: 'var(--accent)',
              fontSize: 11, fontWeight: 600,
            }}
          >
            {fmtShort(dk)}
            <button
              onClick={() => onRemove(dk)}
              style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}
              aria-label={`Remove ${dk}`}
            >×</button>
          </span>
        ))}
      </div>
    </div>
  )
}
