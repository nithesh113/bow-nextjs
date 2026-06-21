'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
const WORK_DETAILS_MAX = 1000
const WORK_DETAILS_PLACEHOLDER =
  'e.g.\n11:00–15:00  McDonald\u2019s Shibuya\n15:00–16:00  Break\n16:00–20:00  McDonald\u2019s Shinjuku'

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
  const { shifts, addShiftsToDB, syncShiftsFromDB } = useShiftsStore()
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

  // ── Work details note (branches, breaks, etc.) ───────────────
  // Toggle defaults OFF so the existing UX is unchanged. When ON, the user
  // can write free-text — one shared note across all selected dates.
  const [workDetailsToggle, setWorkDetailsToggle] = useState(false)
  const [workDetailsText, setWorkDetailsText] = useState('')

  // If the user picks a template that already has a workDetails note,
  // auto-toggle ON and prefill the textarea so they can edit or accept it.
  // Switching to a template without a note clears the textarea (toggle off
  // only if it was empty — respect a user-typed note they haven't saved yet).
  useEffect(() => {
    if (source !== 'template' || !selectedTpl) {
      // Custom mode — leave any user-typed note alone; they may switch back.
      return
    }
    const tplNote = (selectedTpl.workDetails ?? '').trim()
    if (tplNote.length > 0) {
      setWorkDetailsToggle(true)
      setWorkDetailsText(tplNote)
    } else if (workDetailsText.length === 0) {
      setWorkDetailsToggle(false)
    }
    // We intentionally do NOT clear `workDetailsText` when the template has
    // no note — that would wipe a user-typed note before they hit Save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, source])

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

      // Only persist workDetails when the toggle is ON. If toggle is OFF,
      // even text typed in the textarea is discarded (UX: toggle gates save).
      const trimmedNote = workDetailsText.trim()
      const detailsToSave: string | null =
        workDetailsToggle && trimmedNote.length > 0 ? trimmedNote : null

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
          workDetails: detailsToSave,
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
      // Pull fresh data from DB so Insights view & calendar reflect the new shifts
      await syncShiftsFromDB()
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
              <Dropdown<{ id: string; label: string }>
                items={templates.map((t) => ({ id: t.id, label: `${t.name} (${t.start}–${t.end})` }))}
                value={templateId}
                onChange={(v) => setTemplateId(v)}
                placeholder="— Choose a template —"
              />
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
          <Dropdown<{ id: string; label: string }>
            items={jobs.length === 0
              ? [{ id: '', label: 'No jobs yet — create one in the Jobs tab' }]
              : jobs.map((j) => ({ id: j.id, label: j.name }))}
            value={jobId}
            onChange={(v) => setJobId(v)}
            placeholder="— Choose a job —"
          />
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

      {/* ── Work details note (toggle) ─────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <label style={L}>
          <input
            type="checkbox"
            checked={workDetailsToggle}
            onChange={(e) => {
              setWorkDetailsToggle(e.target.checked)
              // Turning the toggle OFF clears the textarea so the user
              // doesn't see stale text they assumed would be saved.
              if (!e.target.checked) setWorkDetailsText('')
            }}
            style={{ marginRight: 6, verticalAlign: 'middle' }}
          />
          Add work details (branches, break locations, etc.)
        </label>

        {workDetailsToggle && (
          <div style={{ marginTop: 6 }}>
            <textarea
              value={workDetailsText}
              onChange={(e) => {
                const next = e.target.value
                // Soft-cap at WORK_DETAILS_MAX. If the user pastes more,
                // we keep the first WORK_DETAILS_MAX chars (so they don't
                // lose typing) and turn the counter red — never silent crop.
                setWorkDetailsText(
                  next.length > WORK_DETAILS_MAX ? next.slice(0, WORK_DETAILS_MAX) : next
                )
              }}
              placeholder={WORK_DETAILS_PLACEHOLDER}
              rows={4}
              maxLength={WORK_DETAILS_MAX} // browser paste cap (best-effort)
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                padding: '8px 10px',
                borderRadius: 8,
                fontFamily: 'inherit',
                fontSize: 13,
                lineHeight: 1.45,
                resize: 'vertical',
                minHeight: 80,
                outline: 'none',
              }}
            />
            <div
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: 4, fontSize: 11, color: 'var(--muted)',
              }}
            >
              <span>
                {workDetailsText.trim().length === 0
                  ? <>Optional. Write anything that helps you remember the day — branch changes, break locations, notes to self.</>
                  : <>Will be saved to all <b style={{ color: 'var(--text)' }}>{selectedDates.length || 'selected'}</b> date{(selectedDates.length || selectedDates.length) !== 1 ? 's' : ''} as a shared note.</>}
              </span>
              <span style={{ color: workDetailsText.length >= WORK_DETAILS_MAX ? 'var(--red, #f87171)' : 'var(--muted)' }}>
                {workDetailsText.length}/{WORK_DETAILS_MAX}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Conflict policy (only if at least one conflict) ──── */}
      {anyConflict && (
        <div style={{ background: 'rgba(250, 204, 21, 0.08)', border: '1px solid rgba(250, 204, 21, 0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 14 }}>
          <div style={{ fontWeight: 700, color: 'var(--yellow, #facc15)', marginBottom: 4 }}>
            ⚠ {summary.conflictCount} selected date{summary.conflictCount !== 1 ? 's have' : ' has'} existing shifts
          </div>
          <label style={L}>For those dates,</label>
          <Dropdown<{ id: ConflictPolicy; label: string }>
            items={[
              { id: 'skip', label: 'Skip them (leave existing shifts alone)' },
              { id: 'append', label: 'Add this shift on top of existing ones' },
            ]}
            value={conflictPolicy}
            onChange={(v) => setConflictPolicy(v as ConflictPolicy)}
          />
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
              <div style={{ marginBottom: 4 }}>
                Per shift: <strong style={{ color: 'var(--text)' }}>{formatHours(previewHrs.total)}</strong>
                {' · '}<strong style={{ color: 'var(--green2)' }}>{formatYen(Math.round(previewEarn))}</strong>
                {previewHrs.night > 0 && (
                  <span style={{ color: 'var(--info)', fontSize: 11 }}> (🌙 {formatHours(previewHrs.night)} night)</span>
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, color: 'var(--text)' }}>
                Total for <strong>{summary.willAdd}</strong> shift{summary.willAdd !== 1 ? 's' : ''}:
                {' '}<strong>{formatHours(previewHrs.total * summary.willAdd)}</strong>
                {' · '}<strong style={{ color: 'var(--green2)' }}>{formatYen(Math.round(previewEarn * summary.willAdd))}</strong>
                {summary.willSkip > 0 && (
                  <span style={{ marginLeft: 6, fontSize: 11 }}>
                    · {summary.willSkip} skipped
                  </span>
                )}
              </div>
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

/**
 * Custom dropdown used in place of native <select>, whose popup cannot be
 * styled cross-browser. <option> children render with the OS palette
 * (white-on-white in Windows light mode / Chromium dark mode combos), so we
 * build a fully-styled React menu instead.
 */
function Dropdown<T extends { id: string; label: string }>({
  items,
  value,
  onChange,
  placeholder = '— select —',
}: {
  items: T[]
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const current = items.find((it) => it.id === value)

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={ddControlStyle(open)}
      >
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current ? current.label : <span style={{ color: 'var(--muted)' }}>{placeholder}</span>}
        </span>
        <span style={{ marginLeft: 8, fontSize: 10, opacity: 0.7, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}>▾</span>
      </button>

      {open && (
        <div style={ddMenuStyle}>
          {items.length === 0 ? (
            <div style={{ padding: '10px 12px', color: 'var(--muted)', fontSize: 13 }}>No options</div>
          ) : (
            items.map((it) => {
              const selected = it.id === value
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => { onChange(it.id); setOpen(false) }}
                  style={ddItemStyle(selected)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,130,246,0.18)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = selected ? 'rgba(59,130,246,0.22)' : 'transparent' }}
                >
                  {it.label}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

const ddControlStyle = (open: boolean): React.CSSProperties => ({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  background: 'rgba(255,255,255,0.05)',
  border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
  color: 'var(--text)',
  padding: '10px 12px',
  borderRadius: 8,
  fontFamily: 'inherit',
  fontSize: 14,
  cursor: 'pointer',
  outline: 'none',
  boxShadow: open ? '0 0 0 3px rgba(59,130,246,0.12)' : 'none',
  transition: 'border-color 150ms ease, box-shadow 150ms ease',
})

const ddMenuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  zIndex: 10,
  maxHeight: 240,
  overflowY: 'auto',
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
  padding: 4,
  display: 'flex',
  flexDirection: 'column',
}

const ddItemStyle = (selected: boolean): React.CSSProperties => ({
  background: selected ? 'rgba(59,130,246,0.22)' : 'transparent',
  border: 'none',
  color: 'var(--text)',
  padding: '8px 10px',
  borderRadius: 6,
  fontSize: 13,
  textAlign: 'left',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: selected ? 600 : 400,
})

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
