// ═══════════════════════════════════════════
// Shift Calculations — BOW v6.3
// Re-exports from nightPayEngine + helpers
// ═══════════════════════════════════════════

export {
  calcShiftHours,
  calcShiftEarned,
  calcScheduledHours,
  hasActualTimes,
  recalculateDayTotals,
} from '@/lib/nightPayEngine'

import type { Shift, Job } from '@/types'
import { calcShiftHours, calcShiftEarned } from '@/lib/nightPayEngine'
import { formatHours, formatYen, timeToMins } from '@/lib/timeUtils'

/** Get display string for a shift's earnings */
export function shiftEarningsDisplay(shift: Shift, job: Job): string {
  const hrs    = calcShiftHours(shift)
  const earned = calcShiftEarned(shift, job)
  return `${formatHours(hrs.total)} · ${formatYen(Math.round(earned))}`
}

/** Diff between actual and scheduled hours */
export function shiftActualDiff(shift: Shift): number | null {
  if (!shift.actualLogin || !shift.actualLogout) return null
  const scheduled = calcShiftHours({ ...shift, actualLogin: undefined, actualLogout: undefined })
  const actual    = calcShiftHours(shift)
  return actual.total - scheduled.total
}

/** True if shift crosses midnight */
export function isOvernightShift(shift: Shift): boolean {
  return timeToMins(shift.end) <= timeToMins(shift.start)
}
