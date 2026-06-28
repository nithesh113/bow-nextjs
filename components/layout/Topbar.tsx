'use client'

import { useAppStore } from '@/store/useAppStore'
import { MONTH_NAMES } from '@/lib/constants'
import { logoutAction } from '@/app/auth/actions'

export default function Topbar({ userName }: { userName: string }) {
  const { curY, curM, changeMonth, goToday, setModal } = useAppStore()

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
      <form action={logoutAction}>
        <button title={`Signed in as ${userName}`} style={iconBtnStyle}>Logout</button>
      </form>
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
