'use client'

interface Props {
  value: number      // 0–100
  color?: string
  height?: number
  showLabel?: boolean
  animated?: boolean
}

export default function ProgressBar({ value, color = 'var(--accent)', height = 6, showLabel = false, animated = true }: Props) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div style={{ width: '100%', height, background: 'rgba(255,255,255,0.08)', borderRadius: height / 2, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${clamped}%`,
        background: color,
        borderRadius: height / 2,
        transition: animated ? 'width 300ms ease-out' : 'none',
      }} />
      {showLabel && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{Math.round(clamped)}%</span>}
    </div>
  )
}
