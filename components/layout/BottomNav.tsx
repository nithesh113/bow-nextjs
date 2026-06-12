'use client'

import { useAppStore } from '@/store/useAppStore'
import type { BottomTab } from '@/types'

const TABS: { id: BottomTab; label: string; icon: string }[] = [
  { id: 'transactions', label: 'Trans.',   icon: '📄' },
  { id: 'stats',        label: 'Stats',    icon: '📊' },
  { id: 'accounts',     label: 'Accounts', icon: '🏦' },
  { id: 'more',         label: 'More',     icon: '⋯'  },
]

export default function BottomNav() {
  const { activeBottomTab, setBottomTab } = useAppStore()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      background: 'var(--bg)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      zIndex: 100,
    }}>
      {TABS.map((tab) => {
        const active = activeBottomTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => setBottomTab(active ? null : tab.id)}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 2,
              background: 'none', border: 'none',
              color: active ? 'var(--accent2)' : 'var(--muted)',
              borderBottom: active ? '2px solid var(--accent2)' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 600,
              transition: 'color 150ms ease',
            }}
          >
            <span style={{ fontSize: 16 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
