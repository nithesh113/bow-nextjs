'use client'

import { useState } from 'react'
import Modal, { btnPrimary, btnSuccess } from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'
import { useBudgetStore } from '@/store/useBudgetStore'
import { todayISO, formatYen } from '@/lib/timeUtils'

const DEFAULT_CATS = [
  { id: 1, name: 'Food',        icon: '🍜' },
  { id: 2, name: 'Transport',   icon: '🚆' },
  { id: 3, name: 'Shopping',    icon: '🛍'  },
  { id: 4, name: 'Entertainment',icon: '🎮' },
  { id: 5, name: 'Utilities',   icon: '💡'  },
  { id: 6, name: 'Health',      icon: '⚕'  },
  { id: 7, name: 'Other',       icon: '📌'  },
]

export default function ExpenseEntryModal() {
  const { closeModal, setModal } = useAppStore()
  const { currentMonth, budgets, addExpense, ensureMonth } = useBudgetStore()

  const month = budgets[currentMonth]
  const cats = (month?.categories?.length ? month.categories : DEFAULT_CATS)
    .map(c => ({ id: c.id, name: c.name, icon: c.icon || '📌' }))

  const [catId, setCatId]     = useState(cats[0]?.id || 1)
  const [amount, setAmount]   = useState('')
  const [date, setDate]       = useState(todayISO())
  const [note, setNote]       = useState('')
  const [showPicker, setShowPicker] = useState(false)

  const selectedCat = cats.find(c => c.id === catId) || cats[0]

  const save = () => {
    const num = parseFloat(amount)
    if (!num || num <= 0) return alert('Enter a valid amount')
    ensureMonth(currentMonth)
    addExpense(currentMonth, { categoryId: catId, amount: num, date, note })
    return true
  }

  const handleSave = () => { if (save()) closeModal() }
  const handleSaveContinue = () => {
    if (save()) {
      setAmount(''); setNote('')
    }
  }

  if (showPicker) return (
    <Modal title="💴 Select Category" onClose={() => setShowPicker(false)}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {cats.map(c => (
          <button key={c.id} onClick={() => { setCatId(c.id); setShowPicker(false) }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              padding: 12,
              background: c.id === catId ? 'rgba(59,130,246,0.2)' : 'var(--card)',
              border: `2px solid ${c.id === catId ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 10, cursor: 'pointer', color: 'var(--text)',
            }}>
            <span style={{ fontSize: 24 }}>{c.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600 }}>{c.name}</span>
          </button>
        ))}
      </div>
    </Modal>
  )

  return (
    <Modal title="💴 Add Expense" footer={
      <>
        <button onClick={handleSave} style={btnPrimary}>Save</button>
        <button onClick={handleSaveContinue} style={btnSuccess}>Save + Continue</button>
      </>
    }>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={L}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div>
          <label style={L}>Category</label>
          <button onClick={() => setShowPicker(true)} style={{
            width: '100%', padding: '10px 12px',
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: 8, color: 'var(--text)', cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ fontSize: 20 }}>{selectedCat?.icon}</span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{selectedCat?.name}</span>
            <span style={{ color: 'var(--muted)' }}>›</span>
          </button>
        </div>
        <div>
          <label style={L}>Amount (¥)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0" inputMode="decimal" autoFocus />
        </div>
        <div>
          <label style={L}>Note (optional)</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Lunch" />
        </div>
      </div>
    </Modal>
  )
}
const L: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }
