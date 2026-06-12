import type { InputHTMLAttributes } from 'react'

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
}

export default function Field({ label, id, ...props }: FieldProps) {
  const inputId = id || props.name

  return (
    <label htmlFor={inputId} style={{ display: 'grid', gap: 6 }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700 }}>{label}</span>
      <input id={inputId} {...props} />
    </label>
  )
}
