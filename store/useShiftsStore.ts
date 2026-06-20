import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Shift, ShiftsStore } from '@/types'
import { recalculateDayTotals } from '@/lib/nightPayEngine'
import { setDayHours, clearDayHours } from '@/services/storage'
import { createShifts, type NewShiftInput, type ShiftRow } from '@/app/actions/shifts'

interface ShiftsState {
  shifts: ShiftsStore
  addShift: (dateKey: string, shift: Shift) => void
  updateShift: (dateKey: string, index: number, shift: Shift) => void
  deleteShift: (dateKey: string, index: number) => void
  updateActualTimes: (
    dateKey: string,
    index: number,
    login: string,
    logout: string,
    breaks?: import('@/types').Break[]
  ) => void
  recalculateDayHours: (dateKey: string) => void
  setShifts: (shifts: ShiftsStore) => void
  /** Save a batch of shifts directly to the database. Does NOT touch the
   *  in-memory `shifts` dictionary, the per-(date,job) hours cache, or
   *  localStorage — that bridge lands with the calendar migration. */
  addShiftsToDB: (inputs: NewShiftInput[]) => Promise<ShiftRow[]>
}

function writeHoursCache(dateKey: string, dayShifts: Shift[]): void {
  const totals = recalculateDayTotals(dayShifts)
  const allJobIds = [...new Set(dayShifts.map((s) => s.jobId))]
  clearDayHours(dateKey, allJobIds)
  for (const [jid, hrs] of Object.entries(totals)) {
    setDayHours(dateKey, jid, hrs.total, hrs.night)
  }
}

export const useShiftsStore = create<ShiftsState>()(
  persist(
    (set, get) => ({
      shifts: {},

      addShift: (dk, shift) => {
        set((s) => {
          const day = [...(s.shifts[dk] || []), shift]
          const next = { ...s.shifts, [dk]: day }
          writeHoursCache(dk, day)
          return { shifts: next }
        })
      },

      updateShift: (dk, index, shift) => {
        set((s) => {
          const day = [...(s.shifts[dk] || [])]
          day[index] = shift
          const next = { ...s.shifts, [dk]: day }
          writeHoursCache(dk, day)
          return { shifts: next }
        })
      },

      deleteShift: (dk, index) => {
        set((s) => {
          const day = (s.shifts[dk] || []).filter((_, i) => i !== index)
          const next = { ...s.shifts }
          if (day.length === 0) delete next[dk]
          else next[dk] = day
          writeHoursCache(dk, day)
          return { shifts: next }
        })
      },

      updateActualTimes: (dk, index, login, logout, breaks) => {
        set((s) => {
          const day = [...(s.shifts[dk] || [])]
          if (!day[index]) return {}
          day[index] = {
            ...day[index],
            actualLogin: login,
            actualLogout: logout,
            ...(breaks ? { actualBreaks: breaks } : {}),
          }
          const next = { ...s.shifts, [dk]: day }
          writeHoursCache(dk, day)
          return { shifts: next }
        })
      },

      recalculateDayHours: (dk) => {
        const day = get().shifts[dk] || []
        writeHoursCache(dk, day)
      },

      addShiftsToDB: async (inputs) => {
        const rows = await createShifts({ shifts: inputs })
        return rows
      },

      setShifts: (shifts) => set({ shifts }),
    }),
    { name: 'wh_shifts' }
  )
)
