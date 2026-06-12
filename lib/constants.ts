import type { Job, BudgetCategory } from '@/types'

export const CONFIG = {
  START_YEAR: 2026,
  START_MONTH: 3,           // April (0-indexed)
  TOTAL_MONTHS: 18,
  SCHOOL_FEE: 840_000,      // ¥
  ORIENTATION_DATE: '2026-04-23',
  WEEKLY_HOUR_LIMIT: 28,
  NIGHT_START: 22,
  NIGHT_END: 5,
  WEEK_NEAR_THRESHOLD: 24,
  APPLY_TEMPLATE_WEEKS: 8,
  CURRENCY: 'JPY',
  CURRENCY_SYMBOL: '¥',
} as const

export const JOB_COLORS = [
  '#f59e0b', '#6366f1', '#10b981', '#ef4444',
  '#ec4899', '#3b82f6', '#a855f7', '#14b8a6',
]

export const DAY_NAMES    = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
export const DAY_NAMES_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
export const MONTH_NAMES  = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

export const DEFAULT_JOBS: Job[] = [
  { id: 'j1', name: "McDonald's", color: '#f59e0b', rate: 1250, nightRate: 1562 },
  { id: 'j2', name: 'Big Boy',    color: '#6366f1', rate: 1300, nightRate: 1700 },
]

export const DEFAULT_CATEGORIES: BudgetCategory[] = [
  { id: 1, name: 'Rent',          icon: '🏠', budget: 65000, priority: 1 },
  { id: 2, name: 'Food',          icon: '🍜', budget: 20000, priority: 2 },
  { id: 3, name: 'Transport',     icon: '🚆', budget: 8000,  priority: 3 },
  { id: 4, name: 'School',        icon: '📚', budget: 15000, priority: 4 },
  { id: 5, name: 'Entertainment', icon: '🎮', budget: 10000, priority: 5 },
]

// Derived constants
export const MIN_DATE = new Date(CONFIG.START_YEAR, CONFIG.START_MONTH, 1)
export const MAX_DATE = new Date(CONFIG.START_YEAR, CONFIG.START_MONTH + CONFIG.TOTAL_MONTHS - 1, 1)
