'use client'

import { useState } from 'react'
import { Pencil, Trash2, Plus, ChevronRight, ArrowLeft, X, Check } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import type { CategoryData } from '@/app/actions/expenses'
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/app/actions/expenses'

// ── Emoji Grid ────────────────────────────────────
const EMOJI_GRID = [
  '🍜', '🍛', '🍕', '🍿', '🥤', '🍌', '🍎', '🥗', '🍩',
  '🚕', '🚆', '🚌', '🚖', '🚲', '✈️',
  '🛍️', '👕', '📱', '🏠', '🛒', '💄', '📦',
  '🎮', '🎬', '🎵', '📺', '🎤', '🎯',
  '💡', '⚡', '💧', '📱', '🌐', '🔥',
  '⚕️', '💊', '🏥', '🦷', '💉',
  '📚', '📖', '✏️', '🎓', '📝',
  '💰', '💳', '🏦', '📊',
  '📌', '🔧', '🎁', '⭐', '❤️',
]

// ── Category Editor Modal ──────────────────────────
function CategoryEditor({
  onClose,
  onSaved,
  parentId,
  editCategory,
}: {
  onClose: () => void
  onSaved: () => void
  parentId?: string | null
  editCategory?: CategoryData | null
}) {
  const [name, setName] = useState(editCategory?.name || '')
  const [icon, setIcon] = useState(editCategory?.icon || '📌')
  const [saving, setSaving] = useState(false)

  const isEditing = !!editCategory

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (isEditing) {
        await updateCategory(editCategory!.id, name.trim(), icon)
      } else {
        await createCategory(name.trim(), icon, parentId || undefined)
      }
      onSaved()
      onClose()
    } catch (err) {
      console.error('Save category failed:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={isEditing ? 'Edit Category' : 'New Category'} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Emoji picker */}
        <div>
          <div style={L}>Icon</div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4,
            maxHeight: 160, overflowY: 'auto', background: 'var(--card)',
            borderRadius: 8, padding: 8,
          }}>
            {EMOJI_GRID.map(em => (
              <button
                key={em}
                onClick={() => setIcon(em)}
                style={{
                  fontSize: 20, padding: 4,
                  background: icon === em ? 'rgba(59,130,246,0.25)' : 'transparent',
                  border: icon === em ? '2px solid var(--accent)' : '2px solid transparent',
                  borderRadius: 6, cursor: 'pointer',
                }}
              >{em}</button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <div style={L}>Name</div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Food, Transport..."
            autoFocus
            style={{ width: '100%' }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btnGhost}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} style={btnSave}>
            <Check size={14} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Category Picker ────────────────────────────────
interface CategoryPickerProps {
  categories: CategoryData[]
  selectedCategoryId: string | null
  selectedSubcategoryId: string | null
  onSelect: (categoryId: string, subcategoryId?: string | null) => void
  onEdit: () => void   // triggers refresh from parent
  onClose: () => void
}

export default function CategoryPicker({
  categories,
  selectedCategoryId,
  selectedSubcategoryId,
  onSelect,
  onEdit,
  onClose,
}: CategoryPickerProps) {
  const [viewingParent, setViewingParent] = useState<CategoryData | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [editorParentId, setEditorParentId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<CategoryData | null>(null)

  const handleEdit = (cat: CategoryData) => {
    setEditTarget(cat)
    setShowEditor(true)
  }

  const handleAdd = (parentId?: string) => {
    setEditTarget(null)
    setEditorParentId(parentId || null)
    setShowEditor(true)
  }

  const handleDelete = async (cat: CategoryData) => {
    if (!window.confirm(`Delete "${cat.name}" and all its subcategories?`)) return
    try {
      await deleteCategory(cat.id)
      onEdit()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const handleSaved = () => {
    onEdit()
  }

  // ── Showing subcategories view ──────────────────
  if (viewingParent) {
    const subs = viewingParent.children || []
    return (
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setViewingParent(null)} style={iconBtn}>
              <ArrowLeft size={16} />
            </button>
            <span>{viewingParent.icon} {viewingParent.name}</span>
          </div>
        }
        onClose={onClose}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {subs.map(sub => (
            <div key={sub.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <button
                onClick={() => { onSelect(viewingParent.id, sub.id); onClose() }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                  background: selectedSubcategoryId === sub.id ? 'rgba(59,130,246,0.15)' : 'transparent',
                  border: 'none', borderRadius: 8, padding: '6px 8px',
                  color: 'var(--text)', cursor: 'pointer', textAlign: 'left' as const,
                }}
              >
                <span style={{ fontSize: 22 }}>{sub.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{sub.name}</span>
              </button>
              <button onClick={() => handleEdit(sub)} style={iconBtnSm}>
                <Pencil size={13} />
              </button>
              <button onClick={() => handleDelete(sub)} style={iconBtnSmDanger}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {subs.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 20, fontSize: 13 }}>
              No subcategories yet.
            </div>
          )}
          <button onClick={() => handleAdd(viewingParent.id)} style={addBtn}>
            <Plus size={14} /> Add Subcategory
          </button>
        </div>

        {showEditor && (
          <CategoryEditor
            onClose={() => setShowEditor(false)}
            onSaved={handleSaved}
            parentId={editorParentId}
            editCategory={editTarget}
          />
        )}
      </Modal>
    )
  }

  // ── Top-level categories ─────────────────────────
  return (
    <Modal title="Select Category" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {categories.map(cat => {
          const hasSubs = (cat.children || []).length > 0
          return (
            <div key={cat.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <button
                onClick={() => {
                  if (hasSubs) {
                    setViewingParent(cat)
                  } else {
                    onSelect(cat.id, null)
                    onClose()
                  }
                }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 10,
                  background: selectedCategoryId === cat.id && !selectedSubcategoryId
                    ? 'rgba(59,130,246,0.15)' : 'transparent',
                  border: 'none', borderRadius: 8, padding: '6px 8px',
                  color: 'var(--text)', cursor: 'pointer', textAlign: 'left' as const,
                }}
              >
                <span style={{ fontSize: 22 }}>{cat.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{cat.name}</span>
                {hasSubs && <ChevronRight size={14} style={{ marginLeft: 'auto', color: 'var(--muted)' }} />}
              </button>
              <button onClick={() => handleEdit(cat)} style={iconBtnSm}>
                <Pencil size={13} />
              </button>
              <button onClick={() => handleDelete(cat)} style={iconBtnSmDanger}>
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}

        <button onClick={() => handleAdd()} style={addBtn}>
          <Plus size={14} /> New Category
        </button>
      </div>

      {showEditor && (
        <CategoryEditor
          onClose={() => setShowEditor(false)}
          onSaved={handleSaved}
          parentId={editorParentId}
          editCategory={editTarget}
        />
      )}
    </Modal>
  )
}

// ── Shared styles ──────────────────────────────────
const L: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4,
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--muted)',
  cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center',
}

const iconBtnSm: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
  borderRadius: 6, padding: 5, cursor: 'pointer', color: 'var(--muted)',
  display: 'flex', alignItems: 'center',
}

const iconBtnSmDanger: React.CSSProperties = {
  ...iconBtnSm, color: 'var(--accent2)',
}

const addBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  width: '100%', padding: '10px',
  background: 'rgba(59,130,246,0.08)', border: '1px dashed rgba(59,130,246,0.3)',
  borderRadius: 8, color: 'var(--accent)', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', marginTop: 8,
}

const btnGhost: React.CSSProperties = {
  padding: '8px 16px', background: 'rgba(255,255,255,0.05)',
  border: '1px solid var(--border)', borderRadius: 8,
  color: 'var(--text)', fontSize: 13, cursor: 'pointer',
}

const btnSave: React.CSSProperties = {
  padding: '8px 16px', background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
}