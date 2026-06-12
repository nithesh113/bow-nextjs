'use client'

import { useMemo } from 'react'
import type { Job } from '@/types'
import { getWeekStart, weekDays, dateKey } from '@/lib/dateUtils'
import { getDayHours } from '@/services/storage'
import { formatHours } from '@/lib/timeUtils'
import { CONFIG } from '@/lib/constants'

interface Props { curY: number; curM: number; jobs: Job[] }

export default function VisaBar({ curY, curM, jobs }: Props) {
  const weekHours = useMemo(() => {
    const today = new Date()
    const ws = getWeekStart(today)
    const days = weekDays(ws)
    let total = 0
    for (const d of days) {
      const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate())
      for (const j of jobs) total += getDayHours(dk, j.id)
    }
    return total
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curY, curM, jobs])

  const limit = CONFIG.WEEKLY_HOUR_LIMIT
  const pct = Math.min(100, (weekHours / limit) * 100)
  const isOver = weekHours > limit
  const isNear = weekHours >= CONFIG.WEEK_NEAR_THRESHOLD && !isOver

  const barColor = isOver ? 'var(--red)' : isNear ? 'var(--yellow)' : 'var(--green)'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 4px', marginBottom: 6,
    }}>
      <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, minWidth: 60 }}>This week</span>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 300ms ease' }} />
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, minWidth: 60, color: barColor }}>
        {formatHours(weekHours)}/{limit}h
      </span>
      <span style={{
        fontSize: 9, fontWeight: 700,
        color: barColor,
        animation: isOver ? 'pulse 1s infinite' : 'none',
      }}>
        {isOver ? '⚠ OVER!' : isNear ? '⚡ Near' : '✓ Safe'}
      </span>
    </div>
  )
}
