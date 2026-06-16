'use client'

import { useState } from 'react'
import { ChevronDown, Pencil, X, Check } from 'lucide-react'
import CategoryPicker from './CategoryPicker'
import type { CategoryData, ExpenseData } from '@/app/actions/expenses'
import { createExpense, updateExpense } from '@/app/actions/expenses'
import { useExpensesStore } from '@/store/useExpensesStore'

interface Props {
  categories: CategoryData[]
  monthKey: string
  onSaved: () => void
  refreshCategories: () => void
  editExpense?: ExpenseData | null
  onCancelEdit?: () => void
}

function getFlatCats(categories: CategoryData[]): { id: string; name: string; icon: string; parentId?: string }[] {
  const result: { id: string; name: string; icon: string; parentId?: string }[] = []
  for (const cat of categories) {
    result.push({ id: cat.id, name: cat.name, icon: cat.icon })
    for (const sub of cat.children || []) {
      result.push({ id: sub.id, name: sub.name, icon: sub.icon, parentId: cat.id })
    }
  }
  return result
}

export default function ExpenseForm({ categories: categoriesProp, monthKey, onSaved, refreshCategories, editExpense, onCancelEdit }: Props) {
  // Read cached categories from the store; fall back to the prop if a parent
  // passed explicit ones (e.g., when opened inside an isolated modal).
  const cachedCategories = useExpensesStore(s => s.categories)
  const categories = (cachedCategories.length > 0 ? cachedCategories : categoriesProp) as CategoryData[]
  const [date, setDate] = useState(editExpense?.date || todayISO())
  const [categoryId, setCategoryId] = useState(editExpense?.categoryId || '')
  const [subcategoryId, setSubcategoryId] = useState<string | null>(editExpense?.subcategoryId || null)
  const [amount, setAmount] = useState(editExpense ? String(editExpense.amount) : '')
  const [note, setNote] = useState(editExpense?.note || '')
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)

  const isEditing = !!editExpense

  const selectedLabel = (() => {
    if (!categoryId) return null
    const flat = getFlatCats(categories)
    const cat = flat.find(c => c.id === categoryId)
    if (!cat) return null
    if (subcategoryId) {
      const sub = flat.find(c => c.id === subcategoryId)
      return sub ? `${cat.icon} ${cat.name} › ${sub.icon} ${sub.name}` : `${cat.icon} ${cat.name}`
    }
    return `${cat.icon} ${cat.name}`
  })()

  const handleSave = async (stayOpen = false) => {
    const num = parseFloat(amount)
    if (!num || num <= 0) return alert('Enter a valid amount')
    if (!categoryId) return alert('Select a category')

    setSaving(true)
    try {
      const data = { categoryId, subcategoryId, amount: num, date, note }
      if (isEditing) {
        await updateExpense(editExpense!.id, data)
      } else {
        await createExpense(data)
      }
      if (!stayOpen) {
        setAmount(''); setNote(''); setCategoryId(''); setSubcategoryId(null)
      }
      onSaved()
      if (isEditing && onCancelEdit) onCancelEdit()
      window.dispatchEvent(new Event('bow:expense-changed'))
    } catch (err) {
      console.error('Save expense failed:', err)
      alert('Failed to save expense')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div style={{
        background: 'var(--card)', borderRadius: 10, padding: 14,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 10 }}>
          {isEditing ? 'Edit Expense' : 'Add Expense'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Date */}
          <div>
            <div style={L}>Date</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ width: '100%' }} />
          </div>

          {/* Category picker trigger */}
          <div>
            <div style={L}>Category</div>
            <button
              onClick={() => setShowPicker(true)}
              style={{
                width: '100%', padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                borderRadius: 8, color: selectedLabel ? 'var(--text)' : 'var(--muted2)',
                cursor: 'pointer', textAlign: 'left' as const, fontSize: 13,
              }}
            >
              {selectedLabel ? (
                <>{selectedLabel}</>
              ) : (
                'Select category…'
              )}
              <ChevronDown size={14} style={{ marginLeft: 'auto', color: 'var(--muted)' }} />
            </button>
          </div>

          {/* Amount + Note */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            <div>
              <div style={L}>Amount (¥)</div>
              <input
                type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0" inputMode="decimal" style={{ width: '100%' }}
              />
            </div>
            <div>
              <div style={L}>Note</div>
              <input
                value={note} onChange={e => setNote(e.target.value)}
                placeholder="e.g. Cream Bun" style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handleSave(false)} disabled={saving} style={btnPrimary}>
              <Check size={14} /> {saving ? 'Saving…' : isEditing ? 'Update' : 'Save'}
            </button>
            {!isEditing && (
              <button onClick={() => handleSave(true)} disabled={saving} style={btnContinue}>
                Save + Continue
              </button>
            )}
            {isEditing && onCancelEdit && (
              <button onClick={onCancelEdit} style={btnGhost}>
                <X size={14} /> Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {showPicker && (
        <CategoryPicker
          categories={categories}
          selectedCategoryId={categoryId}
          selectedSubcategoryId={subcategoryId}
          onSelect={(catId, subId) => {
            setCategoryId(catId)
            setSubcategoryId(subId || null)
          }}
          onEdit={refreshCategories}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}

// ── Helpers ────────────────────────────────────────
function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const L: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4,
}

const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '10px 14px', background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
}

const btnContinue: React.CSSProperties = {
  flex: 1, padding: '10px 14px',
  background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
  color: 'var(--success)', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer',
}

const btnGhost: React.CSSProperties = {
  padding: '10px 14px', background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--border)', borderRadius: 8,
  color: 'var(--text)', fontSize: 13, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 4,
}