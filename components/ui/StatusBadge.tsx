'use client'

interface Props {
  status: 'safe' | 'near' | 'over' | 'active' | 'urgent' | 'completed' | 'archived'
  size?: 'sm' | 'md'
}

const STATUS_MAP = {
  safe:      { label: '✓ Safe',     color: '#10b981' },
  near:      { label: '⚡ Near',    color: '#f59e0b' },
  over:      { label: '⚠ OVER!',   color: '#ef4444' },
  active:    { label: '● Active',   color: '#3b82f6' },
  urgent:    { label: '🔥 Urgent',  color: '#f97316' },
  completed: { label: '✓ Done',     color: '#10b981' },
  archived:  { label: '✕ Archived', color: '#888888' },
}

export default function StatusBadge({ status, size = 'sm' }: Props) {
  const s = STATUS_MAP[status]
  return (
    <span style={{
      color: s.color,
      fontSize: size === 'sm' ? 10 : 12,
      fontWeight: 700,
      letterSpacing: 0.3,
    }}>
      {s.label}
    </span>
  )
}
