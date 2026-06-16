'use client'

import { useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import type { ExpenseData } from '@/app/actions/expenses'
import { formatYen } from '@/lib/timeUtils'

interface Props {
  expenses: ExpenseData[]
  onDeleted: () => void
  onEdit: (expense: ExpenseData) => void
  onDeleteClick: (expenseId: string) => void
  loading: boolean
}

export default function ExpenseList({ expenses, onDeleted, onEdit, onDeleteClick, loading }: Props) {
  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, ExpenseData[]>()
    for (const e of expenses) {
      const group = map.get(e.date) || []
      group.push(e)
      map.set(e.date, group)
    }
    return Array.from(map.entries())
  }, [expenses])

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 13 }}>
        Loading expenses…
      </div>
    )
  }

  if (expenses.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>No expenses this month</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>Add your first expense via the + button!</div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Recent Expenses ({expenses.length})
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent2)' }}>
          Total: {formatYen(Math.round(totalSpent))}
        </div>
      </div>

      {/* Grouped by date */}
      {grouped.map(([date, items]) => (
        <div key={date} style={{ marginBottom: 10 }}>
          {/* Date header */}
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--muted)',
            padding: '3px 0', marginBottom: 2,
            borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>{date}</span>
            <span>{formatYen(Math.round(items.reduce((s, e) => s + e.amount, 0)))}</span>
          </div>

          {/* Expense items */}
          {items.map((expense) => (
            <div key={expense.id} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 0',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}>
              {/* Icon */}
              <span style={{ fontSize: 20 }}>
                {expense.subcategoryIcon || expense.categoryIcon || '📌'}
              </span>

              {/* Name + Note */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  {expense.subcategoryName || expense.categoryName}
                </div>
                {expense.note && (
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {expense.note}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent2)' }}>
                {formatYen(expense.amount)}
              </div>

              {/* Edit */}
              <button
                onClick={() => onEdit(expense)}
                style={iconBtn}
                title="Edit"
              >
                <Pencil size={13} />
              </button>

              {/* Delete */}
              <button
                onClick={() => onDeleteClick(expense.id)}
                style={iconBtnDanger}
                title="Delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
  borderRadius: 5, padding: 4, cursor: 'pointer', color: 'var(--muted)',
  display: 'flex', alignItems: 'center',
}

const iconBtnDanger: React.CSSProperties = {
  ...iconBtn, color: 'var(--accent2)',
}