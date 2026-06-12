// ═══════════════════════════════════════════
// useShifts hook — BOW v6.3
// Shift management with day modal state
// ═══════════════════════════════════════════

import { useShiftsStore } from '@/store/useShiftsStore'
import { useJobsStore } from '@/store/useJobsStore'
import { useTemplatesStore } from '@/store/useTemplatesStore'
import { useAppStore } from '@/store/useAppStore'
import { calcShiftHours, calcShiftEarned } from '@/lib/nightPayEngine'
import { getWeekStart } from '@/lib/dateUtils'
import { getDayHours } from '@/services/storage'
import { weekDays, dateKey } from '@/lib/dateUtils'
import { CONFIG } from '@/lib/constants'
import type { Shift, Break } from '@/types'

export function useShifts(dk: string) {
  const { shifts, addShift, deleteShift, updateActualTimes, recalculateDayHours } = useShiftsStore()
  const { jobs } = useJobsStore()
  const { perMinutePay } = useAppStore()

  const dayShifts = shifts[dk] || []

  /** Calculate estimated hours for a proposed shift */
  const estimateShift = (shift: Shift) => {
    const job = jobs.find(j => j.id === shift.jobId)
    const hrs    = calcShiftHours(shift)
    const earned = job ? calcShiftEarned(shift, job) : 0
    return { hrs, earned }
  }

  /** Week hours for visa check */
  const weekHours = (() => {
    const ws   = getWeekStart(new Date(dk))
    const days = weekDays(ws)
    return days.reduce((s, d) => {
      const k = dateKey(d.getFullYear(), d.getMonth(), d.getDate())
      return s + jobs.reduce((js, j) => js + getDayHours(k, j.id), 0)
    }, 0)
  })()

  const wouldBreachLimit = (addHours: number) =>
    weekHours + addHours > CONFIG.WEEKLY_HOUR_LIMIT

  const saveShift = (shift: Shift): 'saved' | 'visa_warning' => {
    const { hrs } = estimateShift(shift)
    if (wouldBreachLimit(hrs.total)) return 'visa_warning'
    addShift(dk, shift)
    recalculateDayHours(dk)
    return 'saved'
  }

  const removeShift = (index: number) => {
    deleteShift(dk, index)
    recalculateDayHours(dk)
  }

  const updateActual = (index: number, login: string, logout: string, breaks?: Break[]) => {
    updateActualTimes(dk, index, login, logout, breaks)
    recalculateDayHours(dk)
  }

  return {
    dayShifts, jobs, perMinutePay,
    weekHours, wouldBreachLimit,
    saveShift, removeShift, updateActual,
    estimateShift,
  }
}
