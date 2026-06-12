'use client'

import Modal, { btnDanger, btnSecondary } from '@/components/ui/Modal'
import { useAppStore } from '@/store/useAppStore'

export default function VisaWarningModal() {
  const { closeModal, setModal } = useAppStore()

  return (
    <Modal
      title="⚠ Visa Limit Warning"
      footer={
        <>
          <button onClick={closeModal} style={btnSecondary}>Cancel Entry</button>
          <button onClick={() => { closeModal(); setModal('day') }} style={btnDanger}>Log Anyway</button>
        </>
      }
    >
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <p style={{ fontSize: 14, color: 'var(--text)', marginBottom: 8 }}>
          Adding this shift will exceed your <strong>28-hour weekly limit</strong>.
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          Japan student visa regulations prohibit working more than 28 hours per week.
          Logging anyway may put your visa status at risk.
        </p>
      </div>
    </Modal>
  )
}
