'use client'

import { useMemo } from 'react'
import type { Job, ShiftsStore } from '@/types'
import { calendarGridDates, getWeekStart, weekDays, dateKey } from '@/lib/dateUtils'
import { getDayHours } from '@/services/storage'
import { CONFIG } from '@/lib/constants'
import CalendarCell from './CalendarCell'
import WeekSummaryRow from './WeekSummaryRow'

interface Props {
  curY: number
  curM: number
  jobs: Job[]
  shifts: ShiftsStore
}

export default function CalendarGrid({ curY, curM, jobs, shifts }: Props) {
  const cells = useMemo(() => calendarGridDates(curY, curM), [curY, curM])
  const today = useMemo(() => {
    const t = new Date(); return dateKey(t.getFullYear(), t.getMonth(), t.getDate())
  }, [])

  // Build weeks array: chunks of 7
  const weeks: (Date | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  return (
    <div>
      {weeks.map((week, wi) => {
        const weekStart = week.find(Boolean) ? getWeekStart(week.find(Boolean)!) : null
        return (
          <div key={wi}>
            {/* 7-day row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
              {week.map((day, di) => (
                <CalendarCell
                  key={di}
                  day={day}
                  isToday={!!day && dateKey(day.getFullYear(), day.getMonth(), day.getDate()) === today}
                  isOrientation={!!day && dateKey(day.getFullYear(), day.getMonth(), day.getDate()) === CONFIG.ORIENTATION_DATE}
                  jobs={jobs}
                  shifts={shifts}
                  curM={curM}
                />
              ))}
            </div>
            {/* Week summary after each row */}
            {weekStart && (
              <WeekSummaryRow weekStart={weekStart} jobs={jobs} />
            )}
          </div>
        )
      })}
    </div>
  )
}
