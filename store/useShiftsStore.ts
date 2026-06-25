import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Shift, ShiftsStore, Break } from '@/types'
import { recalculateDayTotals } from '@/lib/nightPayEngine'
import { setDayHours, clearDayHours } from '@/services/storage'
import { createShifts, getAllShifts, updateShiftActuals, type NewShiftInput, type ShiftRow } from '@/app/actions/shifts'
import { useJobsStore } from './useJobsStore'

interface ShiftsState {
  shifts: ShiftsStore
  /** Create a shift locally for instant UI, then optimistically flush to DB.
   *  Resolves once the row is persisted (callers don't need to await — the
   *  local state is updated first). */
  addShift: (dateKey: string, shift: Shift) => Promise<void>
  updateShift: (dateKey: string, index: number, shift: Shift) => void
  deleteShift: (dateKey: string, index: number) => void
  /** Patch actual-times on an existing shift. Updates the local store
   *  optimistically; if the shift was loaded from the DB (`_id` present) the
   *  update is also sent to the server via `updateShiftActuals`. */
  updateActualTimes: (
    dateKey: string,
    index: number,
    login: string,
    logout: string,
    breaks?: Break[]
  ) => Promise<void>
  recalculateDayHours: (dateKey: string) => void
  setShifts: (shifts: ShiftsStore) => void
  addShiftsToDB: (inputs: NewShiftInput[]) => Promise<ShiftRow[]>
  syncShiftsFromDB: () => Promise<void>
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

      addShift: async (dk, shift) => {
        // 1) Optimistic local state
        set((s) => {
          const day = [...(s.shifts[dk] || []), { ...shift }]
          const next = { ...s.shifts, [dk]: day }
          writeHoursCache(dk, day)
          return { shifts: next }
        })

        // 2) Persist to DB (fire-and-forget; UI already updated)
        try {
          const rows = await createShifts({
            shifts: [{
              date: dk,
              jobId: shift.jobId,
              start: shift.start,
              end: shift.end,
              actualLogin: shift.actualLogin ?? null,
              actualLogout: shift.actualLogout ?? null,
              actualBreaks: shift.actualBreaks ?? null,
            }],
          })
          const id = rows[0]?.id
          if (!id) return
          // Patch the matching local entry with the DB id so future updates go upstream.
          set((s) => {
            const day = [...(s.shifts[dk] || [])]
            // Find the most recently added entry that matches this shape but has no _id yet.
            const idx = day.findIndex(
              (x) => !x._id &&
                x.jobId === shift.jobId &&
                x.start === shift.start &&
                x.end === shift.end
            )
            if (idx < 0) return {}
            day[idx] = { ...day[idx], _id: id }
            return { shifts: { ...s.shifts, [dk]: day } }
          })
        } catch (err) {
          console.error('[useShiftsStore.addShift] DB write failed', err)
        }
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

      updateActualTimes: async (dk, index, login, logout, breaks) => {
        // 1) Optimistic local update
        let rowId: string | undefined
        let target: Shift | undefined
        set((s) => {
          const day = [...(s.shifts[dk] || [])]
          if (!day[index]) return {}
          day[index] = {
            ...day[index],
            actualLogin: login,
            actualLogout: logout,
            ...(breaks ? { actualBreaks: breaks } : {}),
          }
          rowId = day[index]._id
          target = day[index]
          const next = { ...s.shifts, [dk]: day }
          writeHoursCache(dk, day)
          return { shifts: next }
        })

        // Snapshot for async use (state setter closure can be GC'd between awaits).
        const snapshot = target

        // 2a) Hot path — shift already has a server id, patch in place.
        if (rowId) {
          try {
            await updateShiftActuals({
              shiftId: rowId,
              actualLogin: login,
              actualLogout: logout,
              actualBreaks: breaks ?? null,
            })
          } catch (err) {
            console.error('[useShiftsStore.updateActualTimes] DB update failed', err)
          }
          return
        }

        // 2b) Cold path — shift was created locally but never flushed (no _id).
        // Create the DB row now, with actuals included, then patch the returned
        // id back onto the local entry. Without this, a refresh wipes actuals.
        if (!snapshot) return
        try {
          const rows = await createShifts({
            shifts: [{
              date: dk,
              jobId: snapshot.jobId,
              start: snapshot.start,
              end:   snapshot.end,
              actualLogin:  login,
              actualLogout: logout,
              actualBreaks: breaks ?? null,
            }],
          })
          const id = rows[0]?.id
          if (!id) return
          set((s) => {
            const day = [...(s.shifts[dk] || [])]
            if (!day[index]) return {}
            day[index] = { ...day[index], _id: id }
            return { shifts: { ...s.shifts, [dk]: day } }
          })
        } catch (err) {
          console.error('[useShiftsStore.updateActualTimes] DB createShifts failed', err)
        }
      },

      recalculateDayHours: (dk) => {
        const day = get().shifts[dk] || []
        writeHoursCache(dk, day)
      },

      addShiftsToDB: async (inputs) => {
        const rows = await createShifts({ shifts: inputs })
        return rows
      },

      syncShiftsFromDB: async () => {
        try {
          const dbShifts = await getAllShifts()
          const nextShifts: ShiftsStore = {}

          for (const dbs of dbShifts) {
            const dk = dbs.date
            if (!nextShifts[dk]) {
              nextShifts[dk] = []
            }
            // Preserve actual-times — these were lost before, defeating per-minute pay.
            nextShifts[dk].push({
              _id: dbs.id,
              jobId: dbs.jobId,
              start: dbs.start,
              end: dbs.end,
              breaks: [],
              actualLogin: dbs.actualLogin ?? undefined,
              actualLogout: dbs.actualLogout ?? undefined,
              actualBreaks: dbs.actualBreaks ?? undefined,
            })
          }

          const jobs = useJobsStore.getState().jobs
          const allJobIds = jobs.map(j => j.id)
          const oldKeys = Object.keys(get().shifts)
          for (const ok of oldKeys) {
            if (!nextShifts[ok]) {
              clearDayHours(ok, allJobIds)
            }
          }

          for (const [dk, dayShifts] of Object.entries(nextShifts)) {
            writeHoursCache(dk, dayShifts)
          }

          set({ shifts: nextShifts })
        } catch (err) {
          console.error('[useShiftsStore] syncShiftsFromDB failed', err)
        }
      },

      setShifts: (shifts) => set({ shifts }),
    }),
    { name: 'wh_shifts' }
  )
)
