'use client'

import Modal from '@/components/ui/Modal'
import ExpenseForm from './ExpenseForm'
import type { CategoryData, ExpenseData } from '@/app/actions/expenses'

interface Props {
  expense: ExpenseData | null
  categories: CategoryData[]
  monthKey: string
  onSaved: () => void
  onClose: () => void
  refreshCategories: () => void
}

export default function EditExpenseModal({
  expense,
  categories,
  monthKey,
  onSaved,
  onClose,
  refreshCategories,
}: Props) {
  if (!expense) return null

  const handleSaved = () => {
    onSaved()
    onClose()
  }

  return (
    <Modal title="✏️ Edit Expense" onClose={onClose}>
      <ExpenseForm
        categories={categories}
        monthKey={monthKey}
        onSaved={handleSaved}
        refreshCategories={refreshCategories}
        editExpense={expense}
        onCancelEdit={onClose}
      />
    </Modal>
  )
}