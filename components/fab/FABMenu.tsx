'use client'

import { useAppStore } from '@/store/useAppStore'

const ACTIONS = [
  { id: 'fabExpense',    icon: '💴', label: 'Add Expense',  bg: 'linear-gradient(120deg,#059669,#047857)' },
  { id: 'fabShift',      icon: '📅', label: 'Add Shift',    bg: 'linear-gradient(120deg,#2563eb,#1d4ed8)' },
  { id: 'fabActualTime', icon: '⏱',  label: 'Actual Time',  bg: 'linear-gradient(120deg,#d97706,#b45309)' },
  { id: 'fabTemplate',   icon: '📋', label: 'Template',     bg: 'linear-gradient(120deg,#7c3aed,#6d28d9)' },
] as const

export default function FABMenu() {
  const { setModal, collapseFAB } = useAppStore()

  const handleAction = (id: typeof ACTIONS[number]['id']) => {
    collapseFAB()
    setModal(id as Parameters<typeof setModal>[0])
  }

  return (
    <>
      {/* Overlay */}
      <div
        onClick={collapseFAB}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 900,
          animation: 'fadeIn 200ms ease',
        }}
      />

      {/* Action pills */}
      <div style={{
        position: 'fixed',
        bottom: 'calc(var(--fab-bottom) + 46px + 10px)',
        right: 18,
        display: 'flex', flexDirection: 'column',
        alignItems: 'flex-end', gap: 9,
        zIndex: 999,
      }}>
        {ACTIONS.map((a, i) => (
          <button
            key={a.id}
            onClick={() => handleAction(a.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              width: 164, height: 40,
              padding: '0 16px 0 11px',
              borderRadius: 20,
              background: a.bg,
              border: 'none', color: '#fff',
              cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
              animation: `slideUp 180ms ease ${i * 40}ms both`,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ fontSize: 16 }}>{a.icon}</span>
            <span style={{ whiteSpace: 'nowrap' }}>{a.label}</span>
          </button>
        ))}
      </div>
    </>
  )
}
