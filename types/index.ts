// ═══════════════════════════════════════════════
// BOW v6.3 — Complete Type Definitions
// ═══════════════════════════════════════════════

// ── Job ─────────────────────────────────────────
export interface Job {
  id: string         // 'j1', 'j2', 'j' + Date.now()
  name: string       // "McDonald's"
  color: string      // hex e.g. "#f59e0b"
  rate: number       // JPY/hour day rate
  nightRate: number  // JPY/hour 22:00–05:00
}

// ── Break ───────────────────────────────────────
export interface Break {
  start: string  // "HH:MM"
  end: string    // "HH:MM"
}

// ── Shift ───────────────────────────────────────
export interface Shift {
  /** Stable server-side row id (UUID). Used by `updateShiftActuals` to patch the
   *  matching row when actual-times change. Absent while the row is still being
   *  flushed on the client (we optimistically persist, then patch the id in). */
  _id?: string
  jobId: string
  start: string           // scheduled start "HH:MM"
  end: string             // scheduled end "HH:MM"
  breaks: Break[]
  actualLogin?: string    // actual clock-in (per-minute mode)
  actualLogout?: string   // actual clock-out
  actualBreaks?: Break[]  // actual breaks (only if actualLogin present)
}

export type ShiftsStore = Record<string, Shift[]>  // key = "YYYY-MM-DD"

// ── Template ────────────────────────────────────
export interface Template {
  id: string      // 't' + Date.now()
  name: string
  days: number[]  // 0=Mon, 1=Tue ... 6=Sun
  jobId: string
  start: string   // "HH:MM"
  end: string     // "HH:MM"
  workDetails?: string | null  // optional free-text note (branches, breaks, etc.)
}

// ── Budget ──────────────────────────────────────
export interface BudgetCategory {
  id: number
  name: string
  icon: string    // emoji
  budget: number  // monthly budget ¥
  priority: number
  allocated?: number  // computed at render time
}

export interface Expense {
  categoryId: number
  amount: number
  date: string    // "YYYY-MM-DD"
  note: string
}

export type GoalStatus = 'active' | 'urgent' | 'completed' | 'archived'

export interface BudgetGoal {
  id: string
  name: string
  deadline: string                       // "YYYY-MM-DD"
  target: number                         // ¥ target
  percentage: number                     // % of monthly savings
  priority: number
  createdMonth: string                   // "YYYY-MM"
  monthlyProgress: Record<string, number> // {YYYY-MM: ¥}
  cumulativeAmount: number               // sum of all monthlyProgress
  status: GoalStatus
}

export interface MonthBudget {
  categories: BudgetCategory[]
  expenses: Expense[]
  monthlyExpenses: number
  savings: { goal: number; amount: number }
  notes: string
  goals: BudgetGoal[]
  goalAllocations: Record<string, number>  // {goalId: ¥allocated this month}
}

export type BudgetsStore = Record<string, MonthBudget>  // key = "YYYY-MM"

// ── Hours Cache ─────────────────────────────────
export interface DayHours {
  total: number
  night: number
}
export type HoursCache = Record<string, DayHours>  // key = "YYYY-MM-DD_jobId"

// ── App Settings ────────────────────────────────
export interface AppSettings {
  perMinutePay: boolean
}

// ── UI State ────────────────────────────────────
export type TopTab = 'calendar' | 'templates' | 'budget' | 'summary' | 'expenses' | 'account'

export type ModalType =
  | 'day'
  | 'jobManager'
  | 'templateForm'
  | 'applyTemplate'
  | 'visaWarning'
  | 'fabExpense'
  | 'fabShift'
  | 'fabActualTime'
  | 'fabTemplate'
  | null

// ── Export Backup ────────────────────────────────
export interface BackupEntry {
  date: string
  jobs: { jobId: string; dayHours: number; nightHours: number }[]
  totalEarned: number
}

export interface BackupData {
  schemaVersion?: '6.3.0' | '6.4.0'            // absence ⇒ treated as 6.3.0
  exportedAt: string
  profile: {
    country: string
    weeklyLimit: number
    currency: string
    /** Optional school-fee target (added in v6.4 to make the import flow
     *  honest about restoring user prefs). Older backups omit it; the
     *  importer falls back to the default ¥840,000 when missing. */
    schoolFee?: number
  }
  jobs: Job[]
  /** v6.3 legacy: per-(day, job) hours cache. Hours are derived from
   *  `UserShift` rows in v6.4, so `entries` is an empty array on export
   *  and ignored on import. Kept for backward-compatibility reads. */
  entries?: BackupEntry[]
  shifts: ShiftsStore
  templates: Template[]
  /** v6.4 additions — all optional so a v6.3 file still validates. */
  categories?: BudgetCategory[]
  /** Grouped by monthKey ("YYYY-MM"). Empty when the user has no expenses yet. */
  expenses?: Record<string, Expense[]>
  goals?: BudgetGoal[]
  /** monthKey → free-form notes. */
  monthNotes?: Record<string, string>
}
