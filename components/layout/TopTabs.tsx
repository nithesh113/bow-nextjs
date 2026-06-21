'use client'

import { useAppStore } from '@/store/useAppStore'
import type { TopTab } from '@/types'

const TABS: { id: TopTab; label: string }[] = [
  { id: 'calendar',  label: '📅 Calendar'  },
  { id: 'templates', label: '🔁 Templates' },
  { id: 'budget',    label: '💰 Budget'    },
  { id: 'expenses',  label: '💴 Expenses'  },
  { id: 'summary',   label: '📊 Insights & Analysis' },
  { id: 'account',   label: '👤 Account'   },
]

export default function TopTabs() {
  const { activeTab, activeBottomTab, setTab } = useAppStore()
  const isActive = activeBottomTab === null

  return (
    <nav style={{
      display: 'flex',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      overflowX: 'auto',
      position: 'sticky',
      top: 44,
      zIndex: 99,
    }}>
      {TABS.map((tab) => {
        const active = isActive && activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            style={{
              flex: 1,
              minWidth: 80,
              padding: '12px 10px',
              background: 'none',
              border: 'none',
              borderBottom: active ? '3px solid var(--accent)' : '3px solid transparent',
              color: active ? 'var(--accent)' : 'var(--muted)',
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'color 150ms ease, border-color 150ms ease',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
