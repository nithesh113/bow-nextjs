'use client'

import { useTemplatesStore } from '@/store/useTemplatesStore'
import { useAppStore } from '@/store/useAppStore'
import TemplateCard from './TemplateCard'
import { useJobsStore } from '@/store/useJobsStore'

export default function TemplatesView() {
  const { templates } = useTemplatesStore()
  const { jobs } = useJobsStore()
  const { setModal } = useAppStore()

  return (
    <div style={{ padding: 16 }}>
      <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
        Templates let you quickly apply recurring shift patterns across multiple weeks.
      </p>

      {templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔁</div>
          <div style={{ fontSize: 14 }}>No templates yet</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {templates.map(t => (
            <TemplateCard key={t.id} template={t} jobs={jobs} />
          ))}
        </div>
      )}

      <button
        onClick={() => setModal('templateForm')}
        style={{
          width: '100%', marginTop: 16,
          padding: '12px 16px',
          background: 'rgba(59,130,246,0.1)',
          border: '1px dashed rgba(59,130,246,0.4)',
          color: 'var(--accent)',
          borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}
      >
        + Create New Template
      </button>
    </div>
  )
}
