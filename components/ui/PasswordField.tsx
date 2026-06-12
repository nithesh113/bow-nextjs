'use client'

import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
}

export default function PasswordField({ label, id, style, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)
  const inputId = id || props.name

  return (
    <label htmlFor={inputId} style={{ display: 'grid', gap: 6 }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }}>{label}</span>
      <div style={{ position: 'relative' }}>
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          {...props}
          style={{ paddingRight: 76, ...style }}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute',
            right: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            minWidth: 58,
            height: 30,
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.08)',
            color: 'var(--text-secondary)',
            fontSize: 11,
            fontWeight: 800,
          }}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </label>
  )
}
