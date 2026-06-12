import type { HTMLAttributes } from 'react'

export default function Card({ style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: '0 16px 40px rgba(0,0,0,0.28)',
        ...style,
      }}
    />
  )
}
