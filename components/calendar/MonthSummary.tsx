'use client'

import { useMemo } from 'react'
import type { Job } from '@/types'
import { dateKey } from '@/lib/dateUtils'
import { getDayHours, getNightHours } from '@/lib/dayHours'
import { formatHours, formatYen } from '@/lib/timeUtils'

interface Props { curY: number; curM: number; jobs: Job[] }

export default function MonthSummary({ curY, curM, jobs }: Props) {
  const stats = useMemo(() => {
    const daysInMonth = new Date(curY, curM + 1, 0).getDate()
    let hours = 0, earned = 0, days = 0
    const jobSet = new Set<string>()

    for (let d = 1; d <= daysInMonth; d++) {
      const dk = dateKey(curY, curM, d)
      let dayHours = 0
      for (const j of jobs) {
        const total = getDayHours(dk, j.id)
        const night = getNightHours(dk, j.id)
        const day   = total - night
        const nightRate = j.nightRate || Math.round(j.rate * 1.25)
        earned += day * j.rate + night * nightRate
        hours  += total
        dayHours += total
        if (total > 0) jobSet.add(j.id)
      }
      if (dayHours > 0) days++
    }

    return { hours, earned: Math.round(earned), days, jobCount: jobSet.size }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curY, curM, jobs])

  const cells = [
    { label: 'Hours',  value: formatHours(stats.hours) },
    { label: 'Earned', value: formatYen(stats.earned)  },
    { label: 'Days',   value: String(stats.days)        },
    { label: 'Jobs',   value: String(stats.jobCount)    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 8 }}>
      {cells.map((c) => (
        <div key={c.label} style={{
          background: 'var(--card)', borderRadius: 8, padding: '8px 6px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>{c.value}</div>
          <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{c.label}</div>
        </div>
      ))}
    </div>
  )
}
