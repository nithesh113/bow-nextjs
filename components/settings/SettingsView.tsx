'use client'

import { useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import ToggleSwitch from '@/components/ui/ToggleSwitch'
import { exportData } from '@/services/exportService'
import { importData } from '@/services/importService'

export default function SettingsView() {
  const { perMinutePay, togglePerMinutePay } = useAppStore()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const mode = window.confirm('Replace all data? OK = Replace, Cancel = Merge') ? 'replace' : 'merge'
    try {
      const result = await importData(file, mode)
      alert(`✅ Import complete!\nJobs: ${result.jobs}, Entries: ${result.entries}, Shifts: ${result.shifts}`)
      window.location.reload()
    } catch (err) {
      alert(`❌ Error: ${(err as Error).message}`)
    }
    e.target.value = ''
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
          <ToggleSwitch checked={perMinutePay} onChange={togglePerMinutePay} />
        </div>
      </section>

      {/* Data management */}
      <section style={sectionStyle}>
        <div style={sectionTitle}>Data Management</div>
        <button onClick={exportData} style={actionBtnStyle}>
          <span>📥</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Export Backup</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Download JSON backup of all data</div>
          </div>
        </button>
        <button onClick={() => fileRef.current?.click()} style={actionBtnStyle}>
          <span>📤</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>Import Backup</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Restore from JSON backup file</div>
          </div>
        </button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
      </section>

      {/* About */}
      <section style={sectionStyle}>
        <div style={sectionTitle}>About BOW</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.7 }}>
          <div><strong style={{ color: 'var(--text)' }}>Version:</strong> 6.4 (Next.js)</div>
          <div><strong style={{ color: 'var(--text)' }}>Developed by:</strong> Nitheshwar &amp; Arockia</div>
          <div><strong style={{ color: 'var(--text)' }}>Purpose:</strong> Japan student visa compliance &amp; budget tracking</div>
          <div><strong style={{ color: 'var(--text)' }}>Data:</strong> Cloud database (Neon PostgreSQL) + local work data</div>
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
  paddingBottom: 8, borderBottom: '1px solid var(--border)',
}
const actionBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  width: '100%', padding: '10px 0',
  background: 'none', border: 'none',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  color: 'var(--text)', cursor: 'pointer', textAlign: 'left',
  fontSize: 14,
}
