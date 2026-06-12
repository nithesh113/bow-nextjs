import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BudgetsStore, MonthBudget, BudgetCategory, Expense, BudgetGoal } from '@/types'
import { DEFAULT_CATEGORIES, CONFIG } from '@/lib/constants'
import { monthKey as mkFn, navigateMonth, parseMonthKey } from '@/lib/dateUtils'
import { getDayHours, getNightHours } from '@/services/storage'
import { dateKey } from '@/lib/dateUtils'

interface BudgetState {
  budgets: BudgetsStore
  currentMonth: string   // "YYYY-MM"
  ensureMonth: (mk: string) => void
  prevMonth: () => void
  nextMonth: () => void
  setCurrentMonth: (mk: string) => void
  // Expenses
  addExpense: (mk: string, expense: Expense) => void
  deleteExpense: (mk: string, index: number) => void
  // Categories
  addCategory: (mk: string, cat: BudgetCategory) => void
  updateCategory: (mk: string, catId: number, updates: Partial<BudgetCategory>) => void
  deleteCategory: (mk: string, catId: number) => void
  moveCategoryUp: (mk: string, catId: number) => void
  moveCategoryDown: (mk: string, catId: number) => void
  // Goals
  addGoal: (mk: string, goal: BudgetGoal) => void
  updateGoalPercentage: (mk: string, goalId: number, pct: number) => void
  deleteGoal: (mk: string, goalId: number) => void
  recalculate: (mk: string, jobs: import('@/types').Job[]) => void
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

export const useBudgetStore = create<BudgetState>()(
  persist(
    (set, get) => ({
      budgets: {},
      currentMonth: mkFn(new Date().getFullYear(), new Date().getMonth()),

      ensureMonth: (mk) => {
        set((s) => {
          if (s.budgets[mk]) return {}
          const next = { ...s.budgets, [mk]: createDefaultMonth() }
          ensureBudgetGoals(next, mk)
          return { budgets: next }
        })
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

      addCategory: (mk, cat) =>
        set((s) => ({
          budgets: {
            ...s.budgets,
            [mk]: { ...s.budgets[mk], categories: [...(s.budgets[mk]?.categories || []), cat] },
          },
        })),

      updateCategory: (mk, catId, updates) =>
        set((s) => ({
          budgets: {
            ...s.budgets,
            [mk]: {
              ...s.budgets[mk],
              categories: (s.budgets[mk]?.categories || []).map((c) =>
                c.id === catId ? { ...c, ...updates } : c
              ),
            },
          },
        })),

      deleteCategory: (mk, catId) =>
        set((s) => ({
          budgets: {
            ...s.budgets,
            [mk]: {
              ...s.budgets[mk],
              categories: (s.budgets[mk]?.categories || []).filter((c) => c.id !== catId),
            },
          },
        })),

      moveCategoryUp: (mk, catId) =>
        set((s) => {
          const cats = [...(s.budgets[mk]?.categories || [])]
          const idx = cats.findIndex((c) => c.id === catId)
          if (idx <= 0) return {}
          ;[cats[idx - 1], cats[idx]] = [cats[idx], cats[idx - 1]]
          cats.forEach((c, i) => (c.priority = i + 1))
          return { budgets: { ...s.budgets, [mk]: { ...s.budgets[mk], categories: cats } } }
        }),

      moveCategoryDown: (mk, catId) =>
        set((s) => {
          const cats = [...(s.budgets[mk]?.categories || [])]
          const idx = cats.findIndex((c) => c.id === catId)
          if (idx < 0 || idx >= cats.length - 1) return {}
          ;[cats[idx], cats[idx + 1]] = [cats[idx + 1], cats[idx]]
          cats.forEach((c, i) => (c.priority = i + 1))
          return { budgets: { ...s.budgets, [mk]: { ...s.budgets[mk], categories: cats } } }
        }),

      addGoal: (mk, goal) =>
        set((s) => ({
          budgets: {
            ...s.budgets,
            [mk]: { ...s.budgets[mk], goals: [...(s.budgets[mk]?.goals || []), goal] },
          },
        })),

      updateGoalPercentage: (mk, goalId, pct) =>
        set((s) => {
          const goals = s.budgets[mk]?.goals || []
          const others = goals.filter((g) => g.id !== goalId).reduce((sum, g) => sum + g.percentage, 0)
          if (others + pct > 100) return {}
          return {
            budgets: {
              ...s.budgets,
              [mk]: {
                ...s.budgets[mk],
                goals: goals.map((g) => g.id === goalId ? { ...g, percentage: pct } : g),
              },
            },
          }
        }),

      deleteGoal: (mk, goalId) =>
        set((s) => ({
          budgets: {
            ...s.budgets,
            [mk]: {
              ...s.budgets[mk],
              goals: (s.budgets[mk]?.goals || []).filter((g) => g.id !== goalId),
            },
          },
        })),

      recalculate: (mk, jobs) => {
        set((s) => {
          const month = s.budgets[mk]
          if (!month) return {}

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

          return {
            budgets: {
              ...s.budgets,
              [mk]: { ...month, goals, goalAllocations },
            },
          }
        })
      },

      setBudgets: (b) => set({ budgets: b }),
    }),
    { name: 'wh_budgets' }
  )
)
