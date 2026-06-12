'use client'

import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'

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
          style={{ paddingRight: 46, ...style }}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute',
            right: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 32,
            height: 32,
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.08)',
            color: 'var(--text-secondary)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
    </label>
  )
}
