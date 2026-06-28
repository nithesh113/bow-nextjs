/**
 * Day-hours bridge: shim layer used during the localStorage → Neon DB
 * migration. As of Phase 1+2 the per-day, per-job hour cache lives in
 * the Zustand `useShiftsStore.dayTotals` map (computed on demand from
 * the canonical `shifts` map, which itself is hydrated from the DB).
 *
 * The legacy `wh2_${dk}_${jid}` / `wh2n_${dk}_${jid}` localStorage keys
 * are no longer read or written anywhere. Kept here as a one-import
 * bridge so `getDayHours(dk, jid)` and `getNightHours(dk, jid)` can
 * still be called from 12+ consumers without a per-file migration.
 *
 * This module will be deleted in a follow-up PR once every consumer is
 * confirmed reading from the store directly.
 */

import { useShiftsStore } from '@/store/useShiftsStore'

/** Total hours for (dateKey, jobId) — DB-driven via the in-memory cache. */
export function getDayHours(dk: string, jid: string): number {
  return useShiftsStore.getState().dayTotals[dk]?.[jid]?.total ?? 0
}

/** Night hours for (dateKey, jobId) — DB-driven via the in-memory cache. */
export function getNightHours(dk: string, jid: string): number {
  return useShiftsStore.getState().dayTotals[dk]?.[jid]?.night ?? 0
}
