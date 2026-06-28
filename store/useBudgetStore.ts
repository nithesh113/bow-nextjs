import { create } from 'zustand'
import type { BudgetsStore, MonthBudget, BudgetCategory, Expense, BudgetGoal } from '@/types'
import { DEFAULT_CATEGORIES, CONFIG } from '@/lib/constants'
import { monthKey as mkFn, navigateMonth, parseMonthKey } from '@/lib/dateUtils'
import { getDayHours, getNightHours } from '@/lib/dayHours'
import { dateKey } from '@/lib/dateUtils'
import {
  getBudgetState,
  createBudgetGoal,
  updateBudgetGoal,
  deleteBudgetGoal,
  setGoalMonthAllocation,
} from '@/app/actions/budget'

interface BudgetState {
  budgets: BudgetsStore
  currentMonth: string   // "YYYY-MM"
  ensureMonth: (mk: string) => Promise<void>
  prevMonth: () => void
  nextMonth: () => void
  setCurrentMonth: (mk: string) => void
  // Expenses (delegated to ExpensesStore; kept in type so BudgetView works)
  addExpense: (mk: string, expense: Expense) => void
  deleteExpense: (mk: string, index: number) => void
  // Categories (delegated to ExpensesStore; no-ops here)
  addCategory: (mk: string, cat: BudgetCategory) => void
  updateCategory: (mk: string, catId: number, updates: Partial<BudgetCategory>) => void
  deleteCategory: (mk: string, catId: number) => void
  moveCategoryUp: (mk: string, catId: number) => void
  moveCategoryDown: (mk: string, catId: number) => void
  // Goals (server-backed)
  addGoal: (mk: string, goal: BudgetGoal) => Promise<void>
  updateGoalPercentage: (mk: string, goalId: string, pct: number) => Promise<void>
  deleteGoal: (mk: string, goalId: string) => Promise<void>
  recalculate: (mk: string, jobs: import('@/types').Job[]) => Promise<void>
  setBudgets: (b: BudgetsStore) => void
}

function getMonthEarnings(mk: string, jobs: import('@/types').Job[]): number {
  const { year, month } = parseMonthKey(mk)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  let total = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const dk = dateKey(year, month, d)
    for (const job of jobs) {
      const day   = getDayHours(dk, job.id) - getNightHours(dk, job.id)
      const night = getNightHours(dk, job.id)
      const nightRate = job.nightRate || Math.round(job.rate * 1.25)
      total += day * job.rate + night * nightRate
    }
  }
  return total
}

function createDefaultMonth(): MonthBudget {
  return {
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    expenses: [],
    monthlyExpenses: 0,
    savings: { goal: 0, amount: 0 },
    notes: '',
    goals: [],
    goalAllocations: {},
  }
}

function ensureBudgetGoals(budgets: BudgetsStore, mk: string): void {
  const { year, month } = parseMonthKey(mk)
  const prevMk = mkFn(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1)
  const prev = budgets[prevMk]
  if (!prev?.goals?.length) return

  const current = budgets[mk]
  if (!current) return

  for (const pg of prev.goals) {
    const exists = current.goals.some((g) => g.id === pg.id)
    if (!exists) {
      current.goals.push({ ...pg })
    }
  }
  if (!current.goalAllocations) current.goalAllocations = {}
}

function derive(month: MonthBudget, mk: string, jobs: import('@/types').Job[]) {
  const earned = getMonthEarnings(mk, jobs)
  const totalSpent = (month.expenses || []).reduce((sum, e) => sum + e.amount, 0)
  const savings = Math.max(0, earned - totalSpent)

  const goalAllocations: Record<string, number> = {}
  const goals = (month.goals || []).map((goal) => {
    const allocated = Math.round(savings * (goal.percentage / 100))
    goalAllocations[goal.id] = allocated

    const prog = { ...goal.monthlyProgress, [mk]: allocated }
    const cumulative = Object.values(prog).reduce((a, b) => a + b, 0)

    const now = new Date()
    const deadline = new Date(goal.deadline)
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / 86400000)
    let status: import('@/types').GoalStatus = 'active'
    if (daysLeft < 0) status = 'archived'
    else if (cumulative >= goal.target) status = 'completed'
    else if (daysLeft <= 30) status = 'urgent'

    return { ...goal, monthlyProgress: prog, cumulativeAmount: cumulative, status }
  })

  return { ...month, goalAllocations, goals, monthlyExpenses: totalSpent, savings: { goal: savings, amount: savings } as any }
}

function serverRowToGoal(row: {
  id: string
  name: string
  deadline: string
  target: number
  percentage: number
  priority: number
  createdMonth: string
  monthlyProgress: Record<string, number>
}): BudgetGoal {
  const cumulative = Object.values(row.monthlyProgress ?? {}).reduce<number>((a, b) => a + b, 0)
  const now = new Date()
  const deadline = new Date(row.deadline)
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / 86400000)
  let status: BudgetGoal['status'] = 'active'
  if (daysLeft < 0) status = 'archived'
  else if (cumulative >= row.target) status = 'completed'
  else if (daysLeft <= 30) status = 'urgent'

  return {
    id: row.id,
    name: row.name,
    deadline: row.deadline,
    target: row.target,
    percentage: row.percentage,
    priority: row.priority,
    createdMonth: row.createdMonth,
    monthlyProgress: row.monthlyProgress ?? {},
    cumulativeAmount: cumulative,
    status,
  }
}

export const useBudgetStore = create<BudgetState>()(
  (set, get) => ({
    budgets: {},
    currentMonth: mkFn(new Date().getFullYear(), new Date().getMonth()),

    ensureMonth: async (mk) => {
      const s = get()
      if (s.budgets[mk]) return

      const budgetState = await getBudgetState(mk)
      const budgets: BudgetsStore = (s as any).budgets ?? {}
      const base: MonthBudget = (budgets[mk] as MonthBudget | undefined) ?? createDefaultMonth()
      const month: MonthBudget = {
        categories: base.categories,
        expenses:   base.expenses,
        monthlyExpenses: base.monthlyExpenses,
        savings:    base.savings,
        notes:      budgetState.monthMeta.notes ?? '',
        goals:      budgetState.goals.map(serverRowToGoal),
        goalAllocations: {},
      }

      const next = { ...s.budgets, [mk]: month }
      ensureBudgetGoals(next, mk)
      set({ budgets: next })
    },

    prevMonth: () => {
      const { currentMonth } = get()
      const { year, month } = parseMonthKey(currentMonth)
      const { year: ny, month: nm } = navigateMonth(year, month, -1,
        new Date(CONFIG.START_YEAR, CONFIG.START_MONTH, 1),
        new Date(CONFIG.START_YEAR, CONFIG.START_MONTH + CONFIG.TOTAL_MONTHS - 1, 1))
      set({ currentMonth: mkFn(ny, nm) })
    },

    nextMonth: () => {
      const { currentMonth } = get()
      const { year, month } = parseMonthKey(currentMonth)
      const { year: ny, month: nm } = navigateMonth(year, month, 1,
        new Date(CONFIG.START_YEAR, CONFIG.START_MONTH, 1),
        new Date(CONFIG.START_YEAR, CONFIG.START_MONTH + CONFIG.TOTAL_MONTHS - 1, 1))
      set({ currentMonth: mkFn(ny, nm) })
    },

    setCurrentMonth: (mk) => set({ currentMonth: mk }),

    addExpense: (mk, expense) =>
      set((s) => ({
        budgets: {
          ...s.budgets,
          [mk]: { ...s.budgets[mk], expenses: [...(s.budgets[mk]?.expenses || []), expense] },
        },
      })),

    deleteExpense: (mk, index) =>
      set((s) => ({
        budgets: {
          ...s.budgets,
          [mk]: {
            ...s.budgets[mk],
            expenses: (s.budgets[mk]?.expenses || []).filter((_, i) => i !== index),
          },
        },
      })),

    addCategory: () => set((s) => ({ budgets: { ...s.budgets } })),
    updateCategory: () => set((s) => ({ budgets: { ...s.budgets } })),
    deleteCategory: () => set((s) => ({ budgets: { ...s.budgets } })),
    moveCategoryUp: () => set((s) => ({ budgets: { ...s.budgets } })),
    moveCategoryDown: () => set((s) => ({ budgets: { ...s.budgets } })),

    addGoal: async (mk, goal) => {
      const input = {
        name: goal.name,
        deadline: goal.deadline,
        target: goal.target,
        percentage: goal.percentage,
        priority: goal.priority,
        createdMonth: goal.createdMonth,
        monthlyProgress: goal.monthlyProgress,
      }
      const row = await createBudgetGoal(input)
      set((s) => ({
        budgets: {
          ...s.budgets,
          [mk]: {
            ...s.budgets[mk],
            goals: [...(s.budgets[mk]?.goals || []), serverRowToGoal(row as any)],
          },
        },
      }))
    },

    updateGoalPercentage: async (mk, goalId, pct) => {
      try {
        const row = await updateBudgetGoal(goalId, { percentage: pct })
        if (!row) return
        set((s) => {
          const month = s.budgets[mk]
          if (!month) return {}
          const jobs = (s as any).__jobs ?? []
          const updated = {
            ...month,
            goals: month.goals.map((g) => g.id === goalId ? { ...g, percentage: pct } : g),
          }
          const derived = derive(updated, mk, jobs)
          return { budgets: { ...s.budgets, [mk]: derived } }
        })
      } catch {
        // silent — local store stays stable
      }
    },

    deleteGoal: async (mk, goalId) => {
      const s = get()
      const prevGoals = s.budgets[mk]?.goals || []
      const remaining = prevGoals.filter((g) => g.id !== goalId)

      set((s2) => ({
        budgets: {
          ...s2.budgets,
          [mk]: { ...s2.budgets[mk], goals: remaining },
        },
      }))

      let pctSum = remaining.reduce((sum, g) => sum + g.percentage, 0)
      if (pctSum > 100 && remaining[0]) remaining[0].percentage -= pctSum - 100
      if (pctSum < 100 && remaining[0]) remaining[0].percentage += 100 - pctSum

      try {
        await deleteBudgetGoal(goalId)
      } catch {
        // silent — local store stays stable
      }
    },

    recalculate: async (mk, jobs) => {
      const month = get().budgets[mk]
      if (!month) return
      const derived = derive(month, mk, jobs)
      // Persist each goal's allocated slice for this month
      await Promise.allSettled(
        derived.goals.map((g) => {
          const amount = derived.goalAllocations[g.id] ?? 0
          if (amount === 0) return Promise.resolve()
          return setGoalMonthAllocation({ goalId: String(g.id), monthKey: mk, amount })
        })
      )
      set((s) => ({ budgets: { ...s.budgets, [mk]: derived } }))
    },

    setBudgets: (b) => set({ budgets: b }),
  })
)
