import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
}

export default function Button({ variant = 'primary', style, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      style={{
        width: '100%',
        minHeight: 44,
        borderRadius: 8,
        border: variant === 'secondary' ? '1px solid var(--border)' : 'none',
        background:
          variant === 'danger'
            ? 'var(--accent2)'
            : variant === 'secondary'
              ? 'rgba(255,255,255,0.08)'
              : 'var(--accent)',
        color: 'var(--text)',
        fontSize: 14,
        fontWeight: 700,
        ...style,
      }}
    />
  )
}
