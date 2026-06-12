// ═══════════════════════════════════════════
// Visa Compliance Engine — BOW v6.3
// Japan student visa: 28h/week limit
// Week = Monday to Sunday
// ═══════════════════════════════════════════

import { getWeekStart, weekDays, dateKey } from '@/lib/dateUtils'
import { getDayHours } from '@/services/storage'
import { CONFIG } from '@/lib/constants'
import type { Job } from '@/types'

export type VisaStatus = 'safe' | 'near' | 'over'

export interface WeekHoursResult {
  total: number
  status: VisaStatus
  remaining: number
  pct: number
}

/** Calculate total hours for a Mon–Sun week */
export function getWeekHours(weekStart: Date, jobs: Job[]): number {
  const days = weekDays(weekStart)
  let total = 0
  for (const d of days) {
    const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate())
    for (const j of jobs) total += getDayHours(dk, j.id)
  }
  return total
}

/** Get full visa status for current week */
export function getCurrentWeekStatus(jobs: Job[]): WeekHoursResult {
  const ws    = getWeekStart(new Date())
  const total = getWeekHours(ws, jobs)
  const remaining = Math.max(0, CONFIG.WEEKLY_HOUR_LIMIT - total)
  const pct   = Math.min(100, (total / CONFIG.WEEKLY_HOUR_LIMIT) * 100)

  let status: VisaStatus = 'safe'
  if (total > CONFIG.WEEKLY_HOUR_LIMIT) status = 'over'
  else if (total >= CONFIG.WEEK_NEAR_THRESHOLD) status = 'near'

  return { total, status, remaining, pct }
}

/** Check if adding N hours to current week would breach the limit */
export function wouldBreachLimit(addHours: number, jobs: Job[]): boolean {
  const ws    = getWeekStart(new Date())
  const total = getWeekHours(ws, jobs)
  return (total + addHours) > CONFIG.WEEKLY_HOUR_LIMIT
}

/** Get visa status label and color */
export function getVisaStatusDisplay(status: VisaStatus) {
  return {
    safe: { label: '✓ Safe',    color: '#10b981' },
    near: { label: '⚡ Near',   color: '#f59e0b' },
    over: { label: '⚠ OVER!',  color: '#ef4444' },
  }[status]
}
