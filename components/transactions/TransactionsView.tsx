'use client'

import { useMemo } from 'react'
import { useBudgetStore } from '@/store/useBudgetStore'
import { formatYen } from '@/lib/timeUtils'

export default function TransactionsView() {
  const { budgets, deleteExpense } = useBudgetStore()

  // Collect ALL expenses from ALL months, sorted by date desc
  const allExpenses = useMemo(() => {
    const all: { monthKey: string; expIdx: number; date: string; catId: number; amount: number; catName: string; catIcon: string }[] = []
    for (const [mk, month] of Object.entries(budgets)) {
      if (!month?.expenses) continue
      month.expenses.forEach((e, i) => {
        const cat = (month.categories || []).find(c => c.id === e.categoryId)
        all.push({
          monthKey: mk, expIdx: i,
          date: e.date,
          catId: e.categoryId,
          amount: e.amount,
          catName: cat?.name || 'Unknown',
          catIcon: cat?.icon || '📌',
        })
      })
    }
    return all.sort((a, b) => b.date.localeCompare(a.date))
  }, [budgets])

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, typeof allExpenses>()
    for (const e of allExpenses) {
      const group = map.get(e.date) || []
      group.push(e)
      map.set(e.date, group)
    }
    return Array.from(map.entries())
  }, [allExpenses])

  const totalSpent = allExpenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div style={{
      position: 'fixed', top: 88, bottom: 60, left: 0, right: 0,
      overflowY: 'auto', zIndex: 50,
      background: 'var(--bg)', padding: '12px 12px 0',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>All Transactions</div>
        <div style={{ fontSize: 11, color: 'var(--accent2)', fontWeight: 700 }}>
          Total: {formatYen(Math.round(totalSpent))}
        </div>
      </div>

      {allExpenses.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
          <div>No transactions yet.</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Add expenses in the Budget tab.</div>
        </div>
      )}

      {grouped.map(([date, expenses]) => (
        <div key={date} style={{ marginBottom: 12 }}>
          {/* Date header */}
          <div style={{
            fontSize: 11, fontWeight: 700, color: 'var(--muted)',
            padding: '4px 0', marginBottom: 4,
            borderBottom: '1px solid var(--border)',
          }}>
            {date} · {formatYen(Math.round(expenses.reduce((s, e) => s + e.amount, 0)))}
          </div>

          {expenses.map((e, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 0',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <span style={{ fontSize: 20 }}>{e.catIcon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{e.catName}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)' }}>{e.monthKey}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent2)' }}>
                {formatYen(e.amount)}
              </div>
              <button
                onClick={() => {
                  if (window.confirm('Delete this expense?')) {
                    deleteExpense(e.monthKey, e.expIdx)
                  }
                }}
                style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  color: 'var(--accent2)',
                  borderRadius: 6, padding: '3px 7px',
                  fontSize: 11, cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
