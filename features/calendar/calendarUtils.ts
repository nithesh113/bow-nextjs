// ═══════════════════════════════════════════
// Calendar Utilities — BOW v6.3
// ═══════════════════════════════════════════

import { dateKey, getWeekStart, weekDays } from '@/lib/dateUtils'
import { getDayHours, getNightHours } from '@/services/storage'
import { CONFIG } from '@/lib/constants'
import type { Job, ShiftsStore } from '@/types'

/** Get total hours for a day across all jobs */
export function dayTotalHours(dk: string, jobs: Job[]): number {
  return jobs.reduce((s, j) => s + getDayHours(dk, j.id), 0)
}

/** Get total earned for a day across all jobs */
export function dayTotalEarned(dk: string, jobs: Job[]): number {
  return jobs.reduce((s, j) => {
    const night = getNightHours(dk, j.id)
    const day   = getDayHours(dk, j.id) - night
    const nr    = j.nightRate || Math.round(j.rate * 1.25)
    return s + day * j.rate + night * nr
  }, 0)
}

/** Get total hours for a Mon–Sun week */
export function weekTotalHours(weekStart: Date, jobs: Job[]): number {
  return weekDays(weekStart).reduce((s, d) => {
    const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate())
    return s + dayTotalHours(dk, jobs)
  }, 0)
}

/** Get total earned for a Mon–Sun week */
export function weekTotalEarned(weekStart: Date, jobs: Job[]): number {
  return weekDays(weekStart).reduce((s, d) => {
    const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate())
    return s + dayTotalEarned(dk, jobs)
  }, 0)
}

/** Hours for a specific job in a week */
export function weekJobHours(weekStart: Date, jobId: string): number {
  return weekDays(weekStart).reduce((s, d) => {
    const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate())
    return s + getDayHours(dk, jobId)
  }, 0)
}

/** Visa bar color based on hours */
export function visaBarColor(hours: number): string {
  if (hours > CONFIG.WEEKLY_HOUR_LIMIT) return '#ef4444'
  if (hours >= CONFIG.WEEK_NEAR_THRESHOLD) return '#f59e0b'
  return '#10b981'
}

/** Per-job color segments for day cell bar */
export function jobColorSegments(dk: string, jobs: Job[]): { job: Job; hours: number }[] {
  return jobs
    .map(j => ({ job: j, hours: getDayHours(dk, j.id) }))
    .filter(s => s.hours > 0)
}
