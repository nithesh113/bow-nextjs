'use client'

import type { BudgetCategory, Expense } from '@/types'
import { useBudgetStore } from '@/store/useBudgetStore'
import { formatYen } from '@/lib/timeUtils'
import ProgressBar from '@/components/ui/ProgressBar'

interface Props {
  category: BudgetCategory
  expenses: Expense[]
  index: number
  total: number
  monthKey: string
}

export default function BudgetCategoryCard({ category: cat, expenses, index, total, monthKey }: Props) {
  const { moveCategoryUp, moveCategoryDown, updateCategory, deleteCategory } = useBudgetStore()

  const spent = expenses.filter(e => e.categoryId === cat.id).reduce((s, e) => s + e.amount, 0)
  const remaining = Math.max(0, cat.budget - spent)
  const pct = cat.budget > 0 ? Math.min(100, (spent / cat.budget) * 100) : 0

  const barColor = pct > 100 ? 'var(--red)' : pct >= 70 ? 'var(--yellow)' : 'var(--accent)'
  const status   = pct > 100 ? 'Exceeded' : pct >= 70 ? 'Caution' : 'Safe'
  const statusColor = pct > 100 ? 'var(--red)' : pct >= 70 ? 'var(--yellow)' : 'var(--success)'

  const handleEditBudget = () => {
    const val = window.prompt(`New budget for ${cat.name} (¥):`, String(cat.budget))
    if (!val) return
    const num = parseInt(val)
    if (isNaN(num) || num <= 0) return alert('Invalid amount')
    updateCategory(monthKey, cat.id, { budget: num })
  }

  return (
    <div style={{ background: 'var(--card)', borderRadius: 10, padding: 12, marginBottom: 8 }}>
      {/* Row 1: icon/name/budget + status + controls */}
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
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {index > 0 && <button onClick={() => moveCategoryUp(monthKey, cat.id)} style={ctrlBtn}>⬆</button>}
          {index < total - 1 && <button onClick={() => moveCategoryDown(monthKey, cat.id)} style={ctrlBtn}>⬇</button>}
          <button onClick={handleEditBudget} style={ctrlBtn}>✏️</button>
          <button onClick={() => { if (window.confirm(`Delete "${cat.name}"?`)) deleteCategory(monthKey, cat.id) }} style={{ ...ctrlBtn, color: 'var(--accent2)' }}>🗑️</button>
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar value={pct} color={barColor} height={10} />

      {/* Spent / Remaining */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11 }}>
        <span style={{ color: 'var(--muted)' }}>Spent: <strong style={{ color: pct > 100 ? 'var(--red)' : 'var(--text)' }}>{formatYen(spent)}</strong></span>
        <span style={{ color: 'var(--muted)' }}>Remaining: <strong style={{ color: 'var(--success)' }}>{formatYen(remaining)}</strong></span>
      </div>
    </div>
  )
}
const ctrlBtn: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--muted)', borderRadius: 4, padding: '2px 5px', fontSize: 11, cursor: 'pointer' }
