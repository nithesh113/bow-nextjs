// ═══════════════════════════════════════════
// useBudget hook — BOW v6.3
// Budget state + derived values
// ═══════════════════════════════════════════

import { useBudgetStore } from '@/store/useBudgetStore'
import { useJobsStore } from '@/store/useJobsStore'
import { getDayHours, getNightHours } from '@/lib/dayHours'
import { dateKey, parseMonthKey } from '@/lib/dateUtils'
import { useMemo } from 'react'

export function useBudget() {
  const store = useBudgetStore()
  const { jobs } = useJobsStore()
  const { currentMonth, budgets } = store

  const month = budgets[currentMonth]

  /** Earnings for current budget month from hours cache */
  const monthEarnings = useMemo(() => {
    const { year, month: m } = parseMonthKey(currentMonth)
    const days = new Date(year, m + 1, 0).getDate()
    let total = 0
    for (let d = 1; d <= days; d++) {
      const dk = dateKey(year, m, d)
      for (const j of jobs) {
        const night = getNightHours(dk, j.id)
        const day   = getDayHours(dk, j.id) - night
        const nr    = j.nightRate || Math.round(j.rate * 1.25)
        total += day * j.rate + night * nr
      }
    }
    return Math.round(total)
  }, [currentMonth, jobs])

  const totalSpent = useMemo(() =>
    (month?.expenses || []).reduce((s, e) => s + e.amount, 0),
    [month]
  )

  const savings = Math.max(0, monthEarnings - totalSpent)
  const remaining = Math.max(0, monthEarnings - totalSpent)

  /** Category spending summary */
  const categoryStats = useMemo(() => {
    return (month?.categories || []).map(cat => {
      const spent = (month?.expenses || [])
        .filter(e => e.categoryId === cat.id)
        .reduce((s, e) => s + e.amount, 0)
      const pct   = cat.budget > 0 ? Math.min(100, (spent / cat.budget) * 100) : 0
      const status = pct > 100 ? 'exceeded' : pct >= 70 ? 'caution' : 'safe'
      return { ...cat, spent, pct, status }
    })
  }, [month])

  return {
    ...store,
    month,
    monthEarnings,
    totalSpent,
    savings,
    remaining,
    categoryStats,
    jobs,
  }
}
