'use client'

import { useRef } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { MONTH_NAMES } from '@/lib/constants'
import { exportData } from '@/services/exportService'
import { importData } from '@/services/importService'

export default function Topbar() {
  const { curY, curM, changeMonth, goToday, setModal } = useAppStore()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const mode = window.confirm(
      'REPLACE (OK) or MERGE (Cancel)?\n\nOK = Replace all existing data\nCancel = Merge with existing data'
    ) ? 'replace' : 'merge'
    try {
      const result = await importData(file, mode)
      alert(`✅ Import complete (${mode})\n\nJobs: ${result.jobs}\nEntries: ${result.entries}\nShifts: ${result.shifts}\nTemplates: ${result.templates}`)
      window.location.reload()
    } catch (err) {
      alert(`❌ Import failed: ${(err as Error).message}`)
    }
    e.target.value = ''
  }

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(10,12,20,0.96)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
      padding: '8px 12px',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {/* Title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          🇯🇵 Work Calendar
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>18-month tracker</div>
      </div>

      {/* Month Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button onClick={() => changeMonth(-1)} style={navBtnStyle}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 700, minWidth: 90, textAlign: 'center' }}>
          {MONTH_NAMES[curM]} {curY}
        </span>
        <button onClick={() => changeMonth(1)} style={navBtnStyle}>›</button>
      </div>

      {/* Action Buttons */}
      <button onClick={goToday} style={iconBtnStyle}>Today</button>
      <button onClick={() => setModal('jobManager')} style={iconBtnStyle}>⚙ Jobs</button>
      <button onClick={exportData} style={iconBtnStyle}>↓</button>
      <button onClick={() => fileRef.current?.click()} style={iconBtnStyle}>↑</button>
      <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
    </header>
  )
}

const navBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  width: 28, height: 28,
  borderRadius: 6,
  fontSize: 16,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
}

const iconBtnStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  padding: '4px 8px',
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}
