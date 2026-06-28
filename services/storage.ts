import { useShiftsStore } from '@/store/useShiftsStore'

/**
 * Bridge between components / hooks that used to read per-day, per-job
 * hours from localStorage (`wh2_${dk}_${jid}`) and the new in-memory
 * `useShiftsStore.dayTotals` map.
 *
 * All sites previously calling `getDayHours(dk, jid)` /
 * `getNightHours(dk, jid)` still work; they now read from the Zustand
 * store instead of localStorage. The store keeps `dayTotals` in sync on
 * every shift mutation, and is rebuilt from `syncShiftsFromDB` on session
 * load.
 *
 * Phase 1C / 2 / 3 of the migration plan removes the remaining
 * localStorage brokers (`loadJobs/saveJobs`, `loadShifts/saveShifts`,
 * `loadTemplates/saveTemplates`, `loadBudgets/saveBudgets`,
 * `loadPerMinutePay/savePerMinutePay`) — until then they're stubbed
 * here so dismissed callers don't crash mid-edit.
 */

// ── Day-hours bridge (Phase 1 — actually wired to the store) ──

function readTotals(dk: string, jid: string): { total: number; night: number } {
  const totals = useShiftsStore.getState().dayTotals
  const cell = totals[dk]?.[jid]
  return cell ? { total: cell.total, night: cell.night } : { total: 0, night: 0 }
}

/** Total hours for (dateKey, jobId) — DB-driven via the in-memory cache. */
export function getDayHours(dk: string, jid: string): number {
  return readTotals(dk, jid).total
}

/** Night hours for (dateKey, jobId) — DB-driven via the in-memory cache. */
export function getNightHours(dk: string, jid: string): number {
  return readTotals(dk, jid).night
}

/**
 * Legacy no-op stubs — preserved during the migration window so removed
 * callers (`useShiftsStore.writeHoursCache`, template-apply paths)
 * didn't crash mid-edit. Phase 1C deletes these.
 */
export function setDayHours(_dk: string, _jid: string, _total: number, _night: number): void {
  /* no-op — useShiftsStore owns the cache */
}
export function clearDayHours(_dk: string, _jobIds: string[]): void {
  /* no-op — useShiftsStore owns the cache */
}

// ── Phase-2/P-3 stubs (will be removed when their target stores move to DB) ──
// Kept here only so `exportService` / `importService` / `useBudgetStore` /
// `useTemplatesStore` etc. don't break with a missing-symbol error while
// the migration is in progress. Each is replaced by a real DB-backed
// implementation in the phase that targets it.

import type { Job, ShiftsStore, Template, BudgetsStore } from '@/types'
import { DEFAULT_JOBS } from '@/lib/constants'

export const KEYS = {
  JOBS:        'wh_jobs3',
  SHIFTS:      'wh_shifts',
  TEMPLATES:   'wh_templates',
  PER_MINUTE:  'wh_perMinute',
  BUDGETS:     'wh_budgets',
}

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : fallback
  } catch {
    return fallback
  }
}
function safeSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

export const loadJobs       = (): Job[]        => safeGet<Job[]>(KEYS.JOBS, DEFAULT_JOBS)
export const saveJobs       = (j: Job[])       => safeSet(KEYS.JOBS, j)
export const loadShifts     = (): ShiftsStore  => safeGet<ShiftsStore>(KEYS.SHIFTS, {})
export const saveShifts     = (s: ShiftsStore) => safeSet(KEYS.SHIFTS, s)
export const loadTemplates  = (): Template[]   => safeGet<Template[]>(KEYS.TEMPLATES, [])
export const saveTemplates  = (t: Template[])  => safeSet(KEYS.TEMPLATES, t)
export const loadBudgets    = (): BudgetsStore => safeGet<BudgetsStore>(KEYS.BUDGETS, {})
export const saveBudgets    = (b: BudgetsStore)=> safeSet(KEYS.BUDGETS, b)

export function loadPerMinutePay(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(KEYS.PER_MINUTE) === 'true'
}
export function savePerMinutePay(val: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEYS.PER_MINUTE, val ? 'true' : 'false')
}
