// ═══════════════════════════════════════════
// useCalendar hook — BOW v6.3
// Manages calendar navigation state
// ═══════════════════════════════════════════

import { useAppStore } from '@/store/useAppStore'
import { useJobsStore } from '@/store/useJobsStore'
import { useShiftsStore } from '@/store/useShiftsStore'
import { calendarGridDates, getWeekStart, weekDays, dateKey, monthKey } from '@/lib/dateUtils'
import { getDayHours, getNightHours } from '@/lib/dayHours'
import { useMemo } from 'react'

export function useCalendar() {
  const { curY, curM, changeMonth, goToday, setModal } = useAppStore()
  const { jobs } = useJobsStore()
  const { shifts } = useShiftsStore()

  const gridDates = useMemo(() => calendarGridDates(curY, curM), [curY, curM])

  const monthStats = useMemo(() => {
    const days = new Date(curY, curM + 1, 0).getDate()
    let hours = 0, earned = 0, daysWorked = 0
    const jobsSet = new Set<string>()

    for (let d = 1; d <= days; d++) {
      const dk = dateKey(curY, curM, d)
      let dayH = 0
      for (const j of jobs) {
        const total = getDayHours(dk, j.id)
        const night = getNightHours(dk, j.id)
        const nightRate = j.nightRate || Math.round(j.rate * 1.25)
        earned += (total - night) * j.rate + night * nightRate
        hours  += total
        dayH   += total
        if (total > 0) jobsSet.add(j.id)
      }
      if (dayH > 0) daysWorked++
    }

    return { hours, earned: Math.round(earned), daysWorked, jobCount: jobsSet.size }
  }, [curY, curM, jobs])

  const currentMonthKey = monthKey(curY, curM)

  const openDay = (dk: string) => setModal('day', dk)

  return {
    curY, curM,
    gridDates,
    monthStats,
    currentMonthKey,
    jobs, shifts,
    changeMonth,
    goToday,
    openDay,
  }
}
