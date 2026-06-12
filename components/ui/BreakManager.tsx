'use client'

import type { Break } from '@/types'

interface Props {
  breaks: Break[]
  onChange: (breaks: Break[]) => void
  label?: string
}

export default function BreakManager({ breaks, onChange, label = 'Breaks' }: Props) {
  const addBreak = () =>
    onChange([...breaks, { start: '12:00', end: '13:00' }])

  const updateBreak = (i: number, key: keyof Break, val: string) => {
    const next = breaks.map((b, idx) => idx === i ? { ...b, [key]: val } : b)
    onChange(next)
  }

  const removeBreak = (i: number) =>
    onChange(breaks.filter((_, idx) => idx !== i))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label style={{
          fontSize: 10, fontWeight: 700, color: 'var(--muted)',
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          {label}
        </label>
        <button onClick={addBreak} style={{
          background: 'rgba(59,130,246,0.12)',
          border: '1px solid rgba(59,130,246,0.3)',
          color: 'var(--accent)',
          padding: '3px 9px', borderRadius: 6,
          fontSize: 11, fontWeight: 600, cursor: 'pointer',
        }}>
          + Add Break
        </button>
      </div>

      {breaks.map((br, i) => (
        <div key={i} style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 32px',
          gap: 6, marginBottom: 6,
        }}>
          <input
            type="time"
            value={br.start}
            onChange={e => updateBreak(i, 'start', e.target.value)}
            style={{ width: '100%', fontFamily: 'monospace' }}
          />
          <input
            type="time"
            value={br.end}
            onChange={e => updateBreak(i, 'end', e.target.value)}
            style={{ width: '100%', fontFamily: 'monospace' }}
          />
          <button onClick={() => removeBreak(i)} style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--accent2)',
            borderRadius: 6, cursor: 'pointer', fontSize: 16,
          }}>
            ×
          </button>
        </div>
      ))}

      {breaks.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--muted2)', padding: '4px 0' }}>
          No breaks added
        </div>
      )}
    </div>
  )
}
