'use client'

import type { Job } from '@/types'
import { formatYen } from '@/lib/timeUtils'

export default function JobLegend({ jobs }: { jobs: Job[] }) {
  if (!jobs.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
      {jobs.map((j) => (
        <div key={j.id} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'var(--card)', borderRadius: 6, padding: '4px 8px',
          border: `1px solid ${j.color}40`,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: j.color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700 }}>{j.name}</span>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>
            {formatYen(j.rate)}/h · N:{formatYen(j.nightRate || Math.round(j.rate * 1.25))}/h
          </span>
        </div>
      ))}
    </div>
  )
}
