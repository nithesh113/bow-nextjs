'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import Modal, { btnPrimary, btnSuccess } from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'
import { useExpensesStore } from '@/store/useExpensesStore'
import { todayISO, formatYen } from '@/lib/timeUtils'
import CategoryPicker from '@/components/expenses/CategoryPicker'
import type { CategoryData } from '@/app/actions/expenses'
import { createExpense } from '@/app/actions/expenses'

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

export default function ExpenseEntryModal() {
  const { closeModal } = useAppStore()

  // Pull categories from cache; trigger a load if cache is empty.
  const cachedCategories = useExpensesStore(s => s.categories)
  const loadCategories = useExpensesStore(s => s.loadCategories)
  useEffect(() => { void loadCategories() }, [loadCategories])
  const categories = useMemo(() => cachedCategories, [cachedCategories])

  const [catId, setCatId] = useState('')
  const [subcatId, setSubcatId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [note, setNote] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(false)

  // Auto-select first category when categories arrive and none selected.
  useEffect(() => {
    if (!catId && categories.length > 0) setCatId(categories[0].id)
  }, [categories, catId])

  const flatCats = getFlatCats(categories)
  const selectedLabel = (() => {
    if (!catId) return 'Select category…'
    const cat = flatCats.find(c => c.id === catId)
    if (!cat) return 'Select category…'
    if (subcatId) {
      const sub = flatCats.find(c => c.id === subcatId)
      return sub ? `${cat.icon} ${cat.name} › ${sub.icon} ${sub.name}` : `${cat.icon} ${cat.name}`
    }
    return `${cat.icon} ${cat.name}`
  })()

  const save = async (): Promise<boolean> => {
    const num = parseFloat(amount)
    if (!num || num <= 0) { alert('Enter a valid amount'); return false }
    if (!catId) { alert('Select a category'); return false }
    setSaving(true)
    try {
      await createExpense({ categoryId: catId, subcategoryId: subcatId, amount: num, date, note })
      return true
    } catch (err) {
      console.error('Quick expense save failed:', err)
      alert('Failed to save')
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (await save()) {
      window.dispatchEvent(new Event('bow:expense-changed'))
      closeModal()
    }
  }
  const handleSaveContinue = async () => {
    if (await save()) {
      window.dispatchEvent(new Event('bow:expense-changed'))
      setAmount(''); setNote('')
    }
  }

  return (
    <>
      <Modal title="💴 Add Expense" footer={
        <>
          <button onClick={handleSave} disabled={saving} style={btnPrimary}>
            <Check size={14} /> {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={handleSaveContinue} disabled={saving} style={btnSuccess}>
            Save + Continue
          </button>
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
              borderRadius: 8, color: 'var(--text)', cursor: 'pointer', textAlign: 'left' as const,
            }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{selectedLabel}</span>
              <ChevronDown size={14} style={{ color: 'var(--muted)' }} />
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

      {showPicker && (
        <CategoryPicker
          categories={categories}
          selectedCategoryId={catId}
          selectedSubcategoryId={subcatId}
          onSelect={(catId, subId) => {
            setCatId(catId)
            setSubcatId(subId || null)
          }}
          onEdit={() => { void loadCategories() }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}

const L: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }