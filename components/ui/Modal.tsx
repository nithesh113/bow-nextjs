'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'

interface Props {
  title: string
  onClose?: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: number
}

export default function Modal({ title, onClose, children, footer, maxWidth = 600 }: Props) {
  const { closeModal } = useAppStore()
  const handleClose = onClose || closeModal

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleClose])

  // Prevent body scroll while modal open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: 950,
        display: 'flex', alignItems: 'flex-end',
        animation: 'fadeIn 200ms ease',
      }}
    >
      <div style={{
        width: '100%',
        maxWidth,
        margin: '0 auto',
        background: 'var(--surface)',
        borderRadius: '20px 20px 0 0',
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        transform: 'translateY(0)',
        animation: 'slideUp 250ms cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h2>
          <button
            onClick={handleClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 26, lineHeight: 1, cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex', gap: 10,
            flexShrink: 0,
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// Reusable button styles
export const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '12px 16px',
  background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 8,
  fontSize: 14, fontWeight: 600, cursor: 'pointer',
}
export const btnSuccess: React.CSSProperties = {
  ...btnPrimary, background: 'var(--success)',
}
export const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid var(--border)',
}
export const btnDanger: React.CSSProperties = {
  ...btnPrimary, background: 'var(--accent2)',
}
