import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Shift, ShiftsStore, Break } from '@/types'
import { recalculateDayTotals } from '@/lib/nightPayEngine'
import { createShifts, getAllShifts, updateShiftActuals, type NewShiftInput, type ShiftRow } from '@/app/actions/shifts'

/**
 * Hour totals per (date, job) — derived from the canonical `shifts` map
 * (which itself is DB-backed via `syncShiftsFromDB`). Stored in-memory on
 * the Zustand state so the calendar / visa / budget views can read it
 * synchronously without going through `services/storage.ts` (localStorage)
 * or the network again.
 *
 * The shape mirrors `recalculateDayTotals`: `{ [jid]: { total, day, night } }`.
 */
export type DayTotals = Record<string, { total: number; day: number; night: number }>
export type DayTotalsMap = Record<string /* dateKey */, DayTotals>

interface ShiftsState {
  shifts: ShiftsStore
  /** Derived from `shifts` — see `refreshDayTotals`. Read-only externally. */
  dayTotals: DayTotalsMap
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
  /** Recompute `dayTotals` for one date from the current `shifts[dk]`. */
  recalculateDayHours: (dateKey: string) => void
  setShifts: (shifts: ShiftsStore) => void
  addShiftsToDB: (inputs: NewShiftInput[]) => Promise<ShiftRow[]>
  syncShiftsFromDB: () => Promise<void>
}

/**
 * Selector helper — read total hours for (dk, jid) from the in-memory map.
 * Returns 0 when the day or job isn't tracked yet. Synchronous, no IO.
 */
export function getDayTotalHours(state: ShiftsState, dk: string, jid: string): number {
  return state.dayTotals[dk]?.[jid]?.total ?? 0
}

/** Read night-hours for (dk, jid) from the in-memory map. Synchronous, no IO. */
export function getDayNightHours(state: ShiftsState, dk: string, jid: string): number {
  return state.dayTotals[dk]?.[jid]?.night ?? 0
}

/** Compute and store `dayTotals[dk]` from the current `shifts[dk]`. */
function computeDayTotals(state: ShiftsState, dk: string): DayTotals {
  return recalculateDayTotals(state.shifts[dk] || [])
}

/** Set the in-memory totals for one day in a draft of the next `dayTotals` map. */
function withRefreshedDay(next: DayTotalsMap, dk: string, dayShifts: Shift[]): DayTotalsMap {
  const totals = recalculateDayTotals(dayShifts)
  if (Object.keys(totals).length === 0) {
    const { [dk]: _drop, ...rest } = next
    return rest
  }
  return { ...next, [dk]: totals }
}

export const useShiftsStore = create<ShiftsState>()(
  persist(
    (set, get) => ({
      shifts: {},
      dayTotals: {},

      addShift: async (dk, shift) => {
        // 1) Optimistic local state
        set((s) => {
          const day = [...(s.shifts[dk] || []), { ...shift }]
          const nextShifts = { ...s.shifts, [dk]: day }
          return {
            shifts: nextShifts,
            dayTotals: withRefreshedDay(s.dayTotals, dk, day),
          }
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
          const nextShifts = { ...s.shifts, [dk]: day }
          return {
            shifts: nextShifts,
            dayTotals: withRefreshedDay(s.dayTotals, dk, day),
          }
        })
      },

      deleteShift: (dk, index) => {
        set((s) => {
          const day = (s.shifts[dk] || []).filter((_, i) => i !== index)
          const nextShifts = { ...s.shifts }
          if (day.length === 0) delete nextShifts[dk]
          else nextShifts[dk] = day
          return {
            shifts: nextShifts,
            dayTotals: withRefreshedDay(s.dayTotals, dk, day),
          }
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
          const nextShifts = { ...s.shifts, [dk]: day }
          return {
            shifts: nextShifts,
            dayTotals: withRefreshedDay(s.dayTotals, dk, day),
          }
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
        set((s) => ({ dayTotals: withRefreshedDay(s.dayTotals, dk, s.shifts[dk] || []) }))
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

          // Rebuild dayTotals from the fresh canonical state. Days that
          // disappeared from the DB are dropped from the map (they no
          // longer contribute to any hours/earnings total).
          const nextDayTotals: DayTotalsMap = {}
          for (const [dk, dayShifts] of Object.entries(nextShifts)) {
            const totals = recalculateDayTotals(dayShifts)
            if (Object.keys(totals).length > 0) nextDayTotals[dk] = totals
          }

          set({ shifts: nextShifts, dayTotals: nextDayTotals })
        } catch (err) {
          console.error('[useShiftsStore] syncShiftsFromDB failed', err)
        }
      },

      setShifts: (shifts) => set({ shifts }),
    }),
    { name: 'wh_shifts' }
  )
)
