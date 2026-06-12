// ═══════════════════════════════════════════════
// Night Pay Calculation Engine — BOW v6.3
//
// Night rate applies: 22:00–05:00
// Calculation: minute-by-minute (exact match of original)
// ═══════════════════════════════════════════════

import type { Shift, Break, Job } from '@/types'
import { timeToMins } from './timeUtils'

interface ShiftHoursResult {
  total: number   // total hours (decimal)
  day: number     // day-rate hours
  night: number   // night-rate hours
}

/** Calculate day/night hours for a shift */
export function calcShiftHours(shift: Shift): ShiftHoursResult {
  const useStart  = shift.actualLogin  || shift.start
  const useEnd    = shift.actualLogout || shift.end
  const useBreaks = (shift.actualLogin && shift.actualBreaks)
    ? shift.actualBreaks
    : shift.breaks

  let startM = timeToMins(useStart)
  let endM   = timeToMins(useEnd)
  if (endM <= startM) endM += 24 * 60  // overnight shift

  let dayMins = 0
  let nightMins = 0

  for (let m = startM; m < endM; m++) {
    // Check if minute is in a break
    const inBreak = (useBreaks || []).some(b => {
      let bs = timeToMins(b.start)
      let be = timeToMins(b.end)
      if (be <= bs) be += 24 * 60
      return m >= bs && m < be
    })
    if (inBreak) continue

    // Night = 22:00–05:00
    const norm = m % (24 * 60)
    if (norm >= 22 * 60 || norm < 5 * 60) {
      nightMins++
    } else {
      dayMins++
    }
  }

  const dayH   = dayMins / 60
  const nightH = nightMins / 60
  return { total: dayH + nightH, day: dayH, night: nightH }
}

/** Calculate earnings for a shift */
export function calcShiftEarned(shift: Shift, job: Job): number {
  const nightRate = job.nightRate || Math.round(job.rate * 1.25)
  const { day, night } = calcShiftHours(shift)
  return day * job.rate + night * nightRate
}

/** Calculate scheduled hours (ignores actual times) */
export function calcScheduledHours(shift: Shift): ShiftHoursResult {
  const scheduled: Shift = { ...shift, actualLogin: undefined, actualLogout: undefined, actualBreaks: undefined }
  return calcShiftHours(scheduled)
}

/** Check if a shift has actual times recorded */
export function hasActualTimes(shift: Shift): boolean {
  return !!(shift.actualLogin && shift.actualLogout)
}

/** Recalculate total hours for all shifts on a day, per job */
export function recalculateDayTotals(
  shifts: Shift[]
): Record<string, ShiftHoursResult> {
  const totals: Record<string, ShiftHoursResult> = {}

  for (const shift of shifts) {
    const jid = shift.jobId
    const hrs = calcShiftHours(shift)
    if (!totals[jid]) {
      totals[jid] = { total: 0, day: 0, night: 0 }
    }
    totals[jid].total += hrs.total
    totals[jid].day   += hrs.day
    totals[jid].night += hrs.night
  }

  return totals
}
