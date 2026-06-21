'use client'

import { useTemplatesStore } from '@/store/useTemplatesStore'
import { useAppStore } from '@/store/useAppStore'
import { calcShiftHours } from '@/lib/nightPayEngine'
import { formatHours } from '@/lib/timeUtils'
import { DAY_NAMES } from '@/lib/constants'
import type { Template, Job, Shift } from '@/types'

interface Props { template: Template; jobs: Job[] }

export default function TemplateCard({ template: t, jobs }: Props) {
  const { deleteTemplate } = useTemplatesStore()
  const { setModal } = useAppStore()

  const job = jobs.find(j => j.id === t.jobId)
  const preview: Shift = { jobId: t.jobId, start: t.start, end: t.end, breaks: [] }
  const hrs = calcShiftHours(preview)

  return (
    <div style={{
      background: 'var(--card)',
      border: `1px solid ${job?.color || 'var(--border)'}40`,
      borderLeft: `3px solid ${job?.color || 'var(--accent)'}`,
      borderRadius: '0 10px 10px 0', padding: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{t.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            {job?.name} · {t.start}–{t.end} · {formatHours(hrs.total)}/day
          </div>
        </div>
        <button onClick={() => { if (window.confirm(`Delete "${t.name}"?`)) deleteTemplate(t.id) }}
          style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer' }}>✕</button>
      </div>

      {/* Day pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
        {DAY_NAMES.map((d, i) => (
          <span key={i} style={{
            fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
            background: t.days.includes(i) ? `${job?.color || 'var(--accent)'}33` : 'rgba(255,255,255,0.05)',
            color: t.days.includes(i) ? (job?.color || 'var(--accent)') : 'var(--muted2)',
            border: `1px solid ${t.days.includes(i) ? (job?.color || 'var(--accent)') + '66' : 'transparent'}`,
          }}>{d}</span>
        ))}
      </div>

      <button
        onClick={() => setModal('applyTemplate', t.id)}
        style={{
          width: '100%', padding: '10px 14px',
          background: 'rgba(59,130,246,0.1)',
          border: '1px solid rgba(59,130,246,0.35)',
          color: 'var(--accent)',
          borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
          transition: 'background 120ms ease',
        }}
      >
        Apply →
      </button>
    </div>
  )
}
