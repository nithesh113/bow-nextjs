'use client'

import { useState } from 'react'
import type { BudgetCategory } from '@/types'
import { useBudgetStore } from '@/store/useBudgetStore'
import { todayISO } from '@/lib/timeUtils'
import { formatYen } from '@/lib/timeUtils'

interface Props { monthKey: string; categories: BudgetCategory[] }

export default function ExpenseEntryForm({ monthKey, categories }: Props) {
  const { addExpense, budgets } = useBudgetStore()
  const [catId, setCatId]   = useState(categories[0]?.id || 0)
  const [amount, setAmount] = useState('')
  const [date, setDate]     = useState(todayISO())

  const handleSave = () => {
    const num = parseFloat(amount)
    if (!num || num <= 0) return alert('Enter a valid amount')
    if (!catId)           return alert('Select a category')
    addExpense(monthKey, { categoryId: catId, amount: num, date, note: '' })
    setAmount('')
  }

  const expenses = budgets[monthKey]?.expenses || []

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
        Add Expense
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--card)', borderRadius: 10, padding: 12 }}>
        <select value={catId} onChange={e => setCatId(Number(e.target.value))}>
          {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="¥ Amount" inputMode="decimal" />
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <button onClick={handleSave} style={{
          background: 'var(--accent)', color: '#fff',
          border: 'none', borderRadius: 8, padding: '10px 16px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          + Add Expense
        </button>
      </div>

      {/* Expense list */}
      {expenses.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 6 }}>
            This Month ({expenses.length})
          </div>
          {[...expenses].reverse().slice(0, 10).map((e, i) => {
            const cat = categories.find(c => c.id === e.categoryId)
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
                <span>{cat?.icon} {cat?.name}</span>
                <span style={{ color: 'var(--muted)', fontSize: 10 }}>{e.date}</span>
                <span style={{ fontWeight: 700, color: 'var(--accent2)' }}>{formatYen(e.amount)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
