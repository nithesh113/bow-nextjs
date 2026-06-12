'use client'

import { useEffect, useMemo } from 'react'
import { getDayHours, getNightHours } from '@/services/storage'
import { dateKey } from '@/lib/dateUtils'
import { useBudgetStore } from '@/store/useBudgetStore'
import { useJobsStore } from '@/store/useJobsStore'
import { MONTH_NAMES } from '@/lib/constants'
import { parseMonthKey } from '@/lib/dateUtils'
import { formatYen } from '@/lib/timeUtils'
import BudgetCategoryCard from './BudgetCategoryCard'
import BudgetGoalCard from './BudgetGoalCard'
import ExpenseEntryForm from './ExpenseEntryForm'
import ProgressBar from '@/components/ui/ProgressBar'

export default function BudgetView() {
  const { currentMonth, budgets, ensureMonth, prevMonth, nextMonth, recalculate,
          addCategory, addGoal } = useBudgetStore()
  const { jobs } = useJobsStore()

  useEffect(() => { ensureMonth(currentMonth) }, [currentMonth])

  const month = budgets[currentMonth]
  if (!month) return <div style={{ padding: 16, color: 'var(--muted)' }}>Loading…</div>

  const { year, month: m } = parseMonthKey(currentMonth)
  const earned = (() => {
    // Sum from hours cache
    // (imports at top)
    // (imports at top)
    const daysInMonth = new Date(year, m + 1, 0).getDate()
    let total = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const dk = dateKey(year, m, d)
      for (const j of jobs) {
        const night = getNightHours(dk, j.id)
        const day   = getDayHours(dk, j.id) - night
        const nr    = j.nightRate || Math.round(j.rate * 1.25)
        total += day * j.rate + night * nr
      }
    }
    return Math.round(total)
  })()
  const totalSpent    = (month.expenses || []).reduce((s, e) => s + e.amount, 0)
  const remaining     = Math.max(0, earned - totalSpent)
  const savings       = Math.max(0, earned - totalSpent)

  const handleAddCategory = () => {
    const name = window.prompt('Category name (include emoji, e.g. 🛒 Groceries):')
    if (!name?.trim()) return
    const budgetStr = window.prompt('Monthly budget (¥):')
    if (!budgetStr) return
    const budget = parseInt(budgetStr)
    if (isNaN(budget) || budget <= 0) return alert('Invalid amount')
    const [icon, ...rest] = name.trim().split(' ')
    const catName = rest.join(' ') || icon
    const cats = month.categories || []
    addCategory(currentMonth, {
      id: Date.now(), name: catName, icon,
      budget, priority: cats.length + 1,
    })
  }

  const handleAddGoal = () => {
    const name = window.prompt('Goal name:')
    if (!name?.trim()) return
    const targetStr = window.prompt('Target amount (¥):')
    if (!targetStr) return
    const target = parseInt(targetStr)
    if (isNaN(target) || target <= 0) return alert('Invalid amount')
    const deadline = window.prompt('Deadline (YYYY-MM-DD):')
    if (!deadline) return
    addGoal(currentMonth, {
      id: Date.now(), name: name.trim(), deadline, target,
      percentage: 0, priority: (month.goals || []).length + 1,
      createdMonth: currentMonth, monthlyProgress: {},
      cumulativeAmount: 0, status: 'active',
    })
  }

  return (
    <div style={{ padding: '12px 12px 0' }}>
      {/* Month nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={prevMonth} style={navBtn}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{MONTH_NAMES[m]} {year}</span>
        <button onClick={nextMonth} style={navBtn}>›</button>
      </div>

      {/* Summary card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginBottom: 12 }}>
        {[
          { label: 'Earned',    value: formatYen(earned),    color: 'var(--green2)' },
          { label: 'Expenses',  value: formatYen(Math.round(totalSpent)), color: 'var(--accent2)' },
          { label: 'Remaining', value: formatYen(remaining), color: 'var(--accent)' },
        ].map(c => (
          <div key={c.label} style={{ background: 'var(--card)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Categories */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Budget Categories
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => recalculate(currentMonth, jobs)} style={smallBtn}>🔄 Recalc</button>
            <button onClick={handleAddCategory} style={smallBtn}>+ Add</button>
          </div>
        </div>
        {(month.categories || []).map((cat, idx) => (
          <BudgetCategoryCard
            key={cat.id}
            category={cat}
            expenses={month.expenses || []}
            index={idx}
            total={(month.categories || []).length}
            monthKey={currentMonth}
          />
        ))}
      </div>

      {/* Goals */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Savings Goals
          </div>
          <button onClick={handleAddGoal} style={smallBtn}>+ Goal</button>
        </div>
        {(month.goals || []).length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 12, padding: '8px 0' }}>No goals yet. Add one to start saving!</div>
        )}
        {(month.goals || []).map(goal => (
          <BudgetGoalCard
            key={goal.id}
            goal={goal}
            monthKey={currentMonth}
            monthlyAllocated={(month.goalAllocations || {})[goal.id] || 0}
            savings={savings}
          />
        ))}
      </div>

      {/* Expense entry */}
      <ExpenseEntryForm monthKey={currentMonth} categories={month.categories || []} />
    </div>
  )
}

const navBtn: React.CSSProperties = { background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', color: 'var(--text)', width: 32, height: 32, borderRadius: 6, fontSize: 16, cursor: 'pointer' }
const smallBtn: React.CSSProperties = { background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--accent)', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }
