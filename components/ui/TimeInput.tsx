'use client'

interface Props {
  label?: string
  value: string
  onChange: (val: string) => void
  disabled?: boolean
  placeholder?: string
}

export default function TimeInput({ label, value, onChange, disabled = false, placeholder }: Props) {
  return (
    <div>
      {label && (
        <label style={{
          display: 'block', fontSize: 10, fontWeight: 700,
          color: 'var(--muted)', textTransform: 'uppercase',
          letterSpacing: '0.5px', marginBottom: 4,
        }}>
          {label}
        </label>
      )}
      <input
        type="time"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: disabled ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${disabled ? 'rgba(255,255,255,0.06)' : 'var(--border)'}`,
          color: disabled ? 'var(--muted)' : 'var(--text)',
          padding: '10px 12px',
          borderRadius: 8,
          fontSize: 14,
          fontFamily: 'var(--font-mono, monospace)',
          cursor: disabled ? 'default' : 'pointer',
          transition: 'border-color 150ms ease',
        }}
      />
    </div>
  )
}
