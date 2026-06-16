'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getExpenses, getCategories, seedDefaultCategories, saveCategoryBudgetByName } from '@/app/actions/expenses'
import { getDayHours, getNightHours } from '@/services/storage'
import { dateKey } from '@/lib/dateUtils'
import { useBudgetStore } from '@/store/useBudgetStore'
import { useJobsStore } from '@/store/useJobsStore'
import { MONTH_NAMES, DEFAULT_CATEGORIES } from '@/lib/constants'
import { parseMonthKey } from '@/lib/dateUtils'
import { formatYen } from '@/lib/timeUtils'
import BudgetCategoryCard from './BudgetCategoryCard'
import BudgetGoalCard from './BudgetGoalCard'
import ProgressBar from '@/components/ui/ProgressBar'

export default function BudgetView() {
  const { currentMonth, budgets, ensureMonth, prevMonth, nextMonth, recalculate,
          addGoal, setBudgets } = useBudgetStore()
  const { jobs } = useJobsStore()
  const [refreshTick, setRefreshTick] = useState(0)

  // ═══ All hooks before any return ═══
  useEffect(() => { ensureMonth(currentMonth) }, [currentMonth, ensureMonth])

  // ── Load from DB whenever the month changes or an expense entry was made elsewhere ──
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [dbExps, dbCats] = await Promise.all([
          getExpenses(currentMonth),
          getCategories(),
        ])
        if (cancelled) return

        // Build name→DB-category lookup; track parent budgets for children
        const dbByName = new Map<string, { id: string; name: string; icon: string; budget: number }>()
        const parentBudgets = new Map<string, number>()
        const flatDbCats: { id: string; name: string; icon: string; budget: number; parentName?: string }[] = []

        ;(dbCats || []).forEach(c => {
          const catBudget = c.budget ?? 20000
          flatDbCats.push({ id: c.id, name: c.name, icon: c.icon, budget: catBudget })
          dbByName.set(c.name.toLowerCase(), { id: c.id, name: c.name, icon: c.icon, budget: catBudget })
          parentBudgets.set(c.name.toLowerCase(), catBudget)
          for (const sub of c.children || []) {
            const subBudget = sub.budget ?? parentBudgets.get(c.name.toLowerCase()) ?? 20000
            flatDbCats.push({ id: sub.id, name: sub.name, icon: sub.icon, budget: subBudget, parentName: c.name })
            dbByName.set(sub.name.toLowerCase(), { id: sub.id, name: sub.name, icon: sub.icon, budget: subBudget })
          }
        })

        const existingMonth = budgets[currentMonth] || {}
        const storeCats = existingMonth.categories || []

        const mergedCats = storeCats.map(sc => {
          const dbMatch = dbByName.get(sc.name.toLowerCase())
          if (dbMatch && dbMatch.budget > 0 && sc.budget === 0) {
            return { ...sc, budget: dbMatch.budget }
          }
          return sc
        })

        const storeCatNames = new Set(mergedCats.map(c => c.name.toLowerCase()))
        let nextId = Math.max(100, ...mergedCats.map(c => c.id), ...DEFAULT_CATEGORIES.map(c => c.id)) + 1

        for (const dbCat of flatDbCats) {
          if (!storeCatNames.has(dbCat.name.toLowerCase())) {
            mergedCats.push({
              id: nextId++,
              name: dbCat.name,
              icon: dbCat.icon,
              budget: dbCat.budget,
              priority: mergedCats.length + 1,
            })
          }
        }

        const catNameToStoreId = new Map(mergedCats.map(c => [c.name.toLowerCase(), c.id]))

        const mappedExps = dbExps
          .filter(e => e.categoryName && e.amount > 0)
          .map(e => ({
            categoryId: catNameToStoreId.get(e.categoryName.toLowerCase()) ?? 0,
            amount: e.amount,
            date: e.date,
            note: e.note,
          }))
          .filter(e => e.categoryId !== 0)

        const existingExps = existingMonth.expenses || []
        const mergedExps = [...existingExps]
        for (const e of mappedExps) {
          if (!mergedExps.some(m => m.date === e.date && m.categoryId === e.categoryId && m.amount === e.amount)) {
            mergedExps.push(e)
          }
        }

        const updated = { ...existingMonth, categories: mergedCats, expenses: mergedExps }

        if (!cancelled) {
          setBudgets({ ...budgets, [currentMonth]: updated })
        }
      } catch (err) {
        console.warn('[BudgetView] DB load failed, using defaults', err)
      }
    })()

    return () => { cancelled = true }
  }, [currentMonth, refreshTick]) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for cross-component expense changes (FAB modal, ExpenseView)
  useEffect(() => {
    const handler = () => setRefreshTick(t => t + 1)
    window.addEventListener('bow:expense-changed', handler)
    return () => window.removeEventListener('bow:expense-changed', handler)
  }, [])

  const month = budgets[currentMonth]

  // Derived hooks (always in same order)
  const expenses = useMemo(() => month?.expenses || [], [month])
  const categories = month?.categories || []

  const spentByCategory: Record<number, number> = useMemo(() => {
    const map: Record<number, number> = {}
    expenses.forEach(e => { map[e.categoryId] = (map[e.categoryId] || 0) + e.amount })
    return map
  }, [expenses])

  const sortedCategories = useMemo(() =>
    [...categories].sort((a, b) => (spentByCategory[b.id] || 0) - (spentByCategory[a.id] || 0)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, expenses])

  // Render guard (after all hooks)
  if (!month) {
    return <div style={{ padding: 16, color: 'var(--muted)' }}>Loading…</div>
  }

  const { year, month: m } = parseMonthKey(currentMonth)
  const earned = (() => {
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
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)
  const remaining  = Math.max(0, earned - totalSpent)
  const savings    = Math.max(0, earned - totalSpent)

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
      id: Date.now(),
      name: name.trim(), deadline, target,
      percentage: 0,
      priority: (month.goals || []).length + 1,
      createdMonth: currentMonth,
      monthlyProgress: {},
      cumulativeAmount: 0,
      status: 'active',
    })
  }

  const handleSaveBudget = async (catName: string, budget: number) => {
    try {
      await saveCategoryBudgetByName(catName, budget)
    } catch {
      // Silent — store is already updated
    }
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

      {/* Budget Categories */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Budget Categories
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => recalculate(currentMonth, jobs)} style={smallBtn}>🔄 Recalc</button>
          </div>
        </div>
        {sortedCategories.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 12, padding: '8px 0' }}>
            No categories yet. Add an expense to get started.
          </div>
        )}
        {sortedCategories.map((cat) => {
          const spent = spentByCategory[cat.id] || 0
          const pct = cat.budget > 0 ? Math.min(100, (spent / cat.budget) * 100) : 0
          const barColor = pct > 100 ? 'var(--red)' : pct >= 70 ? 'var(--yellow)' : 'var(--accent)'
          const status   = pct > 100 ? 'Exceeded' : pct >= 70 ? 'Caution' : 'Safe'
          const statusColor = pct > 100 ? 'var(--red)' : pct >= 70 ? 'var(--yellow)' : 'var(--success)'
          const remaining = Math.max(0, cat.budget - spent)

          return (
            <div key={cat.id} style={{ background: 'var(--card)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>{cat.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{cat.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: statusColor }}>{status}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Budget: {formatYen(cat.budget)} · {Math.round(pct)}%
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent2)', marginTop: 2 }}>
                    Spent: {formatYen(spent)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    const val = window.prompt(`Set budget for ${cat.name} (¥):`, String(cat.budget))
                    if (!val) return
                    const num = parseInt(val)
                    if (isNaN(num) || num < 0) return alert('Invalid amount')
                    useBudgetStore.getState().updateCategory(currentMonth, cat.id, { budget: num })
                    handleSaveBudget(cat.name, num)
                  }}
                  style={ctrlBtn}
                >✏️</button>
              </div>
              <ProgressBar value={pct} color={barColor} height={10} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11 }}>
                <span style={{ color: 'var(--muted)' }}>
                  Remaining: <strong style={{ color: 'var(--success)' }}>{formatYen(remaining)}</strong>
                </span>
              </div>
            </div>
          )
        })}
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
    </div>
  )
}

const navBtn: React.CSSProperties = { background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)', color: 'var(--text)', width: 32, height: 32, borderRadius: 6, fontSize: 16, cursor: 'pointer' }
const ctrlBtn: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 4, padding: '2px 5px', fontSize: 11, cursor: 'pointer' }
const smallBtn: React.CSSProperties = { background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--accent)', padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }
