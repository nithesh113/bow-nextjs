'use client'

import { useAppStore } from '@/store/useAppStore'

export default function FABButton() {
  const { fabExpanded, toggleFAB } = useAppStore()

  return (
    <button
      onClick={toggleFAB}
      aria-label={fabExpanded ? 'Close quick actions' : 'Open quick actions'}
      style={{
        position: 'fixed',
        bottom: 'var(--fab-bottom)',
        right: 18,
        width: 46, height: 46,
        borderRadius: '50%',
        background: '#2563eb',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.28)',
        transition: 'transform 220ms ease',
        zIndex: 1000,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{
        display: 'block',
        fontSize: 26, lineHeight: 1,
        transition: 'transform 240ms cubic-bezier(0.4,0,0.2,1)',
        transform: fabExpanded ? 'rotate(45deg)' : 'rotate(0deg)',
        userSelect: 'none',
      }}>
        +
      </span>
    </button>
  )
}
