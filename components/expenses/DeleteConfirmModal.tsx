'use client'

import { useState } from 'react'
import { Trash2, X } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { deleteExpenseAction } from '@/app/actions/expenses'

interface Props {
  expenseId: string
  onDeleted: () => void
  onClose: () => void
}

export default function DeleteConfirmModal({ expenseId, onDeleted, onClose }: Props) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteExpenseAction(expenseId)
      onDeleted()
      onClose()
    } catch (err) {
      console.error('Delete failed:', err)
      setDeleting(false)
    }
  }

  return (
    <Modal title="⚠️ Delete Expense?" onClose={onClose}>
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--accent2)' }}>
          Are you sure?
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          This will permanently delete this expense. This action cannot be undone.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={onClose}
            disabled={deleting}
            style={{
              padding: '10px 20px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text)', fontSize: 13,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <X size={14} /> Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              padding: '10px 20px',
              background: 'var(--accent2)', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>
  )
}