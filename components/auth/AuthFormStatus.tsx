'use client'

export default function AuthFormStatus({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null

  return (
    <div
      role="status"
      style={{
        border: `1px solid ${error ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.35)'}`,
        background: error ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
        color: error ? '#fecaca' : '#bbf7d0',
        borderRadius: 8,
        padding: '10px 12px',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {error || success}
    </div>
  )
}
