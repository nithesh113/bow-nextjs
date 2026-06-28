// ═══════════════════════════════════════════
// Budget Engine — BOW v6.3
// Waterfall allocation, goal carry-forward,
// goal status calculation
// ═══════════════════════════════════════════

import type { MonthBudget, BudgetCategory, BudgetGoal, GoalStatus } from '@/types'
import { CONFIG } from '@/lib/constants'

/** Waterfall budget allocation (priority order) */
export function waterfallAllocate(
  categories: BudgetCategory[],
  totalEarned: number
): BudgetCategory[] {
  const sorted = [...categories].sort((a, b) => a.priority - b.priority)
  let remaining = totalEarned

  return sorted.map(cat => {
    const allocated = Math.min(cat.budget, Math.max(0, remaining))
    remaining = Math.max(0, remaining - cat.budget)
    return { ...cat, allocated }
  })
}

/** Calculate goal status based on deadline and progress */
export function calcGoalStatus(goal: BudgetGoal): GoalStatus {
  const daysLeft = Math.ceil(
    (new Date(goal.deadline).getTime() - Date.now()) / 86400000
  )
  if (daysLeft < 0) return 'archived'
  if (goal.cumulativeAmount >= goal.target) return 'completed'
  if (daysLeft <= 30) return 'urgent'
  return 'active'
}

/** Recalculate all goal allocations for a month */
export function recalcGoalAllocations(
  month: MonthBudget,
  earnings: number
): MonthBudget {
  const totalSpent = (month.expenses || []).reduce((s, e) => s + e.amount, 0)
  const savings    = Math.max(0, earnings - totalSpent)

  const goalAllocations: Record<string, number> = {}
  const goals = (month.goals || []).map(goal => {
    const allocated = Math.round(savings * (goal.percentage / 100))
    goalAllocations[String(goal.id)] = allocated
    return goal
  })

  return { ...month, goals, goalAllocations }
}

/** Carry forward goals from previous month if not already present */
export function carryForwardGoals(
  currentMonth: MonthBudget,
  previousMonth: MonthBudget | undefined,
  monthKey: string
): MonthBudget {
  if (!previousMonth?.goals?.length) return currentMonth

  const existing = new Set((currentMonth.goals || []).map(g => g.id))
  const carried  = previousMonth.goals.filter(g => !existing.has(g.id))

  if (!carried.length) return currentMonth

  return {
    ...currentMonth,
    goals: [...(currentMonth.goals || []), ...carried.map(g => ({ ...g }))],
  }
}

/** Update cumulative amount for a goal across all months */
export function updateGoalCumulative(
  goal: BudgetGoal
): BudgetGoal {
  const cumulative = Object.values(goal.monthlyProgress)
    .reduce((s, v) => s + v, 0)
  return {
    ...goal,
    cumulativeAmount: cumulative,
    status: calcGoalStatus({ ...goal, cumulativeAmount: cumulative }),
  }
}

/** Check if total goal allocation exceeds 100% */
export function validateGoalPercentages(
  goals: BudgetGoal[],
  exceptId: string,
  newPct: number
): boolean {
  const others = goals
    .filter(g => g.id !== exceptId)
    .reduce((s, g) => s + g.percentage, 0)
  return others + newPct <= 100
}
