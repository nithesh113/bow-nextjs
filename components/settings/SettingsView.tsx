'use client'

import { toast } from 'sonner'
import { useAppStore } from '@/store/useAppStore'
import ToggleSwitch from '@/components/ui/ToggleSwitch'
import BackupPanel from './BackupPanel'

export default function SettingsView() {
  const { perMinutePay, setPerMinutePay } = useAppStore()

  const handleToggle = async (next: boolean) => {
    const res = await setPerMinutePay(next)
    if (!res.success) {
      toast.error(res.error || 'Failed to save preference')
    } else {
      toast.success(next ? 'Per-minute pay enabled' : 'Per-minute pay disabled')
    }
  }

  return (
    <div style={{ padding: 16 }}>
      {/* Per-minute toggle */}
      <section style={sectionStyle}>
        <div style={sectionTitle}>Earnings Calculation</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Per-Minute Pay</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              Track actual clock-in/out for precise earnings
            </div>
          </div>
          <ToggleSwitch
            checked={perMinutePay}
            onChange={(next) => { void handleToggle(next) }}
          />
        </div>
      </section>

      {/* Export / Import */}
      <BackupPanel />

      {/* About */}
      <section style={sectionStyle}>
        <div style={sectionTitle}>About BOW</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
          <div><strong style={{ color: 'var(--text)' }}>Version:</strong> 7.0 (Next.js)</div>
          <div><strong style={{ color: 'var(--text)' }}>Developed by:</strong> Nitheshwar &amp; Arockia</div>
          <div><strong style={{ color: 'var(--text)' }}>Purpose:</strong> Japan student visa compliance &amp; budget tracking</div>
          <div><strong style={{ color: 'var(--text)' }}>Data:</strong> Cloud database (Neon PostgreSQL)</div>
          <div><strong style={{ color: 'var(--text)' }}>Features:</strong> Account system, email verification, expense tracking with categories</div>
          <div><strong style={{ color: 'var(--text)' }}>Date range:</strong> Apr 2026 – Sep 2027 (18 months)</div>
          <div><strong style={{ color: 'var(--text)' }}>Weekly limit:</strong> 28 hours (Japan visa rule)</div>
          <div><strong style={{ color: 'var(--text)' }}>School fee target:</strong> ¥840,000</div>
        </div>
      </section>
    </div>
  )
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--card)',
  borderRadius: 12, padding: 14, marginBottom: 12,
}
const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8,
}