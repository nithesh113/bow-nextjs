'use client'

import { useState, useEffect, useCallback } from 'react'
import { Settings } from 'lucide-react'
import ExpenseList from './ExpenseList'
import EditExpenseModal from './EditExpenseModal'
import DeleteConfirmModal from './DeleteConfirmModal'
import CategoryPicker from './CategoryPicker'
import type { ExpenseData } from '@/app/actions/expenses'
import { MONTH_NAMES } from '@/lib/constants'
import { formatYen } from '@/lib/timeUtils'
import { useExpensesStore } from '@/store/useExpensesStore'

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export default function ExpenseView() {
  const now = new Date()
  const [curY, setCurY] = useState(now.getFullYear())
  const [curM, setCurM] = useState(now.getMonth())

  const mk = monthKey(curY, curM)

  // Pull from cache. Cache is invalidated by AppShell listeners; loadMonth
  // does the actual fetch (and is a no-op when the month is already cached).
  const expensesRaw = useExpensesStore(s => s.expensesByMonth[mk])
  const loaded = useExpensesStore(s => s.loadedMonths.has(mk))
  const categories = useExpensesStore(s => s.categories)
  const loadMonth = useExpensesStore(s => s.loadMonth)
  const loadCategories = useExpensesStore(s => s.loadCategories)

  useEffect(() => {
    void loadMonth(mk)
  }, [mk, loadMonth])

  const [editExpense, setEditExpense] = useState<ExpenseData | null>(null)
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null)
  const [showCatManager, setShowCatManager] = useState(false)

  // Pre-populate categories on first mount so CategoryPicker has data even if
  // user hasn't visited BudgetView yet.
  useEffect(() => { void loadCategories() }, [loadCategories])

  // The cache returns CachedExpense[] (compatible shape with ExpenseData);
  // cast so child components stay typed against the server action shape.
  const expenses = (expensesRaw ?? []) as unknown as ExpenseData[]
  const loadingExps = !loaded
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)

  const handleSaved = useCallback(() => {
    // Bust the visible month so the next render pulls from DB.
    useExpensesStore.getState().invalidateMonth(mk)
    void loadMonth(mk)
    void loadCategories()
  }, [mk, loadMonth, loadCategories])

  const handleEdit = (exp: ExpenseData) => {
    setEditExpense(exp)
  }

  const handleDeleteClick = (expenseId: string) => {
    setDeleteExpenseId(expenseId)
  }

  const prevMonth = () => {
    if (curM === 0) { setCurY(curY - 1); setCurM(11) }
    else { setCurM(curM - 1) }
  }
  const nextMonth = () => {
    if (curM === 11) { setCurY(curY + 1); setCurM(0) }
    else { setCurM(curM + 1) }
  }

  return (
    <div style={{ padding: '12px 12px 0' }}>
      {/* Month navigation */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <button onClick={prevMonth} style={navBtn}>‹</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>
            {MONTH_NAMES[curM]} {curY}
          </span>
          <button onClick={() => setShowCatManager(true)} style={iconBtn} title="Manage categories">
            <Settings size={14} />
          </button>
        </div>
        <button onClick={nextMonth} style={navBtn}>›</button>
      </div>

      {/* Summary card */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
        marginBottom: 14,
      }}>
        <div style={statCard}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent2)' }}>
            {formatYen(Math.round(totalSpent))}
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', marginTop: 2 }}>
            Spent
          </div>
        </div>
        <div style={statCard}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>
            {expenses.length}
          </div>
          <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', marginTop: 2 }}>
            Transactions
          </div>
        </div>
      </div>

      {/* Expense list */}
      <ExpenseList
        expenses={expenses}
        onDeleted={handleSaved}
        onEdit={handleEdit}
        onDeleteClick={handleDeleteClick}
        loading={loadingExps}
      />

      {/* Edit modal */}
      {editExpense && (
        <EditExpenseModal
          expense={editExpense}
          categories={categories}
          monthKey={mk}
          onSaved={handleSaved}
          onClose={() => setEditExpense(null)}
          refreshCategories={loadCategories}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteExpenseId && (
        <DeleteConfirmModal
          expenseId={deleteExpenseId}
          onDeleted={handleSaved}
          onClose={() => setDeleteExpenseId(null)}
        />
      )}

      {/* Category manager modal */}
      {showCatManager && (
        <CategoryPicker
          categories={categories}
          selectedCategoryId={null}
          selectedSubcategoryId={null}
          onSelect={() => {}}
          onEdit={() => { void loadCategories() }}
          onClose={() => setShowCatManager(false)}
        />
      )}
    </div>
  )
}

const navBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)', border: '1px solid var(--border)',
  color: 'var(--text)', width: 32, height: 32, borderRadius: 6, fontSize: 16, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const statCard: React.CSSProperties = {
  background: 'var(--card)', borderRadius: 8, padding: '10px 12px', textAlign: 'center',
}

const iconBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
  borderRadius: 6, padding: 5, cursor: 'pointer', color: 'var(--muted)',
  display: 'flex', alignItems: 'center',
}
