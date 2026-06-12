import type { Job, ShiftsStore, Template, BudgetsStore } from '@/types'
import { DEFAULT_JOBS } from '@/lib/constants'

export const KEYS = {
  JOBS:        'wh_jobs3',
  SHIFTS:      'wh_shifts',
  TEMPLATES:   'wh_templates',
  PER_MINUTE:  'wh_perMinute',
  BUDGETS:     'wh_budgets',
  DAY_HOURS:   (dk: string, jid: string) => `wh2_${dk}_${jid}`,
  NIGHT_HOURS: (dk: string, jid: string) => `wh2n_${dk}_${jid}`,
}

function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback } catch { return fallback }
}
function safeSet(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

export const loadJobs       = (): Job[]         => safeGet<Job[]>(KEYS.JOBS, DEFAULT_JOBS)
export const saveJobs       = (j: Job[])        => safeSet(KEYS.JOBS, j)
export const loadShifts     = (): ShiftsStore   => safeGet<ShiftsStore>(KEYS.SHIFTS, {})
export const saveShifts     = (s: ShiftsStore)  => safeSet(KEYS.SHIFTS, s)
export const loadTemplates  = (): Template[]    => safeGet<Template[]>(KEYS.TEMPLATES, [])
export const saveTemplates  = (t: Template[])   => safeSet(KEYS.TEMPLATES, t)
export const loadBudgets    = (): BudgetsStore  => safeGet<BudgetsStore>(KEYS.BUDGETS, {})
export const saveBudgets    = (b: BudgetsStore) => safeSet(KEYS.BUDGETS, b)

export function loadPerMinutePay(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(KEYS.PER_MINUTE) === 'true'
}
export function savePerMinutePay(val: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEYS.PER_MINUTE, val ? 'true' : 'false')
}
export function getDayHours(dk: string, jid: string): number {
  if (typeof window === 'undefined') return 0
  return parseFloat(localStorage.getItem(KEYS.DAY_HOURS(dk, jid)) || '0') || 0
}
export function getNightHours(dk: string, jid: string): number {
  if (typeof window === 'undefined') return 0
  return parseFloat(localStorage.getItem(KEYS.NIGHT_HOURS(dk, jid)) || '0') || 0
}
export function setDayHours(dk: string, jid: string, total: number, night: number): void {
  if (typeof window === 'undefined') return
  if (total <= 0) {
    localStorage.removeItem(KEYS.DAY_HOURS(dk, jid))
    localStorage.removeItem(KEYS.NIGHT_HOURS(dk, jid))
  } else {
    localStorage.setItem(KEYS.DAY_HOURS(dk, jid), total.toString())
    localStorage.setItem(KEYS.NIGHT_HOURS(dk, jid), night.toString())
  }
}
export function clearDayHours(dk: string, jobIds: string[]): void {
  if (typeof window === 'undefined') return
  for (const jid of jobIds) {
    localStorage.removeItem(KEYS.DAY_HOURS(dk, jid))
    localStorage.removeItem(KEYS.NIGHT_HOURS(dk, jid))
  }
}
