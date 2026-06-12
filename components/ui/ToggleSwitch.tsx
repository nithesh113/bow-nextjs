'use client'

interface Props {
  checked: boolean
  onChange: (val: boolean) => void
  label?: string
}

export default function ToggleSwitch({ checked, onChange, label }: Props) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      {label && <span style={{ fontSize: 14, color: 'var(--text)' }}>{label}</span>}
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 24,
          background: checked ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
          borderRadius: 12,
          position: 'relative',
          transition: 'background 200ms ease',
          flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute',
          top: 2, left: checked ? 22 : 2,
          width: 20, height: 20,
          background: '#fff',
          borderRadius: '50%',
          transition: 'left 200ms ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </div>
    </label>
  )
}
