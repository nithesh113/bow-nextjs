/**
 * Day-hours bridge: thin re-export of `useShiftsStore.dayTotals` accessors.
 *
 * Lives here so consumers don't have to manage the store import cycle,
 * and so the legacy `services/storage.ts` shim can be deleted entirely.
 * The `dayTotals` map is computed in-memory from the canonical `shifts`
 * map (which is hydrated from the `UserShift` table), so this is the DB
 * view, not a cache.
 */

import { useShiftsStore } from '@/store/useShiftsStore'

/** Total hours for (dateKey, jobId). */
export function getDayHours(dk: string, jid: string): number {
  return useShiftsStore.getState().dayTotals[dk]?.[jid]?.total ?? 0
}

/** Night portion of hours for (dateKey, jobId). */
export function getNightHours(dk: string, jid: string): number {
  return useShiftsStore.getState().dayTotals[dk]?.[jid]?.night ?? 0
}
