'use client'

import { useMemo } from 'react'
import type { Job } from '@/types'
import { weekDays, dateKey } from '@/lib/dateUtils'
import { getDayHours, getNightHours } from '@/lib/dayHours'
import { formatHours, formatYen } from '@/lib/timeUtils'
import { CONFIG } from '@/lib/constants'
import ProgressBar from '@/components/ui/ProgressBar'

interface Props { weekStart: Date; jobs: Job[] }

export default function WeekSummaryRow({ weekStart, jobs }: Props) {
  const stats = useMemo(() => {
    const days = weekDays(weekStart)
    let hours = 0, earned = 0
    const jobsWorked: Job[] = []

    for (const d of days) {
      const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate())
      for (const j of jobs) {
        const total = getDayHours(dk, j.id)
        const night = getNightHours(dk, j.id)
        const dayH  = total - night
        const nightRate = j.nightRate || Math.round(j.rate * 1.25)
        earned += dayH * j.rate + night * nightRate
        hours  += total
        if (total > 0 && !jobsWorked.find(jw => jw.id === j.id)) jobsWorked.push(j)
      }
    }

    return { hours, earned: Math.round(earned), jobsWorked }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, jobs])

  const limit = CONFIG.WEEKLY_HOUR_LIMIT
  const pct   = Math.min(100, (stats.hours / limit) * 100)
  const isOver = stats.hours > limit
  const isNear = stats.hours >= CONFIG.WEEK_NEAR_THRESHOLD && !isOver
  const barColor = isOver ? 'var(--red)' : isNear ? 'var(--yellow)' : 'var(--accent)'

  // Week date range label
  const endDay = new Date(weekStart); endDay.setDate(endDay.getDate() + 6)
  const fmtDay = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--border)',
      borderRadius: 6, padding: '6px 10px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 9, color: 'var(--muted)' }}>
          {fmtDay(weekStart)}–{fmtDay(endDay)}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: barColor }}>
          {formatHours(stats.hours)}/{limit}h
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green2)' }}>
          {formatYen(stats.earned)}
        </span>
        <div style={{ display: 'flex', gap: 3 }}>
          {stats.jobsWorked.map(j => (
            <span key={j.id} style={{
              fontSize: 8, background: `${j.color}33`,
              color: j.color, padding: '1px 4px', borderRadius: 3, fontWeight: 700,
            }}>{j.name.substring(0, 3)}</span>
          ))}
        </div>
      </div>
      <ProgressBar value={pct} color={barColor} height={4} />
    </div>
  )
}
