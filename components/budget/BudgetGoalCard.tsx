'use client'

import type { BudgetGoal } from '@/types'
import { useBudgetStore } from '@/store/useBudgetStore'
import { useJobsStore } from '@/store/useJobsStore'
import { formatYen } from '@/lib/timeUtils'
import ProgressBar from '@/components/ui/ProgressBar'
import StatusBadge from '@/components/ui/StatusBadge'

interface Props {
  goal: BudgetGoal
  monthKey: string
  monthlyAllocated: number
  savings: number
}

export default function BudgetGoalCard({ goal, monthKey, monthlyAllocated, savings }: Props) {
  const { updateGoalPercentage, deleteGoal, recalculate } = useBudgetStore()
  const { jobs } = useJobsStore()

  const daysLeft = Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000)
  const pctComplete = goal.target > 0 ? Math.min(100, (goal.cumulativeAmount / goal.target) * 100) : 0

  const barColor = goal.status === 'completed' ? 'var(--success)' : goal.status === 'urgent' ? 'var(--warning)' : 'var(--accent)'

  const handleEditPct = () => {
    const val = window.prompt(`Allocate what % of savings to "${goal.name}"?\n(Currently ${goal.percentage}%)`, String(goal.percentage))
    if (val === null) return
    const pct = parseInt(val)
    if (isNaN(pct) || pct < 0 || pct > 100) return alert('Enter a value 0–100')
    void updateGoalPercentage(monthKey, goal.id, pct)
    void recalculate(monthKey, jobs)
  }

  return (
    <div style={{ background: 'var(--card)', borderRadius: 10, padding: 12, marginBottom: 8, border: `1px solid ${barColor}30` }}>
      {/* Row 1 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{goal.name}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>
            Target: {formatYen(goal.target)} · Due: {goal.deadline}
            {daysLeft > 0 && ` (${daysLeft} days left)`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <StatusBadge status={goal.status} />
          <button onClick={() => { if (window.confirm(`Delete goal "${goal.name}"?`)) void deleteGoal(monthKey, goal.id) }}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 14, cursor: 'pointer' }}>🗑️</button>
        </div>
      </div>

      {/* This month allocation */}
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
        This month: <strong style={{ color: 'var(--accent)' }}>{goal.percentage}%</strong> of savings = <strong style={{ color: 'var(--green2)' }}>{formatYen(monthlyAllocated)}</strong>
        <button onClick={handleEditPct} style={{ marginLeft: 8, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--accent)', padding: '1px 6px', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}>⚙️ Edit</button>
      </div>

      {/* Cumulative progress */}
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
        Saved: <strong style={{ color: 'var(--green2)' }}>{formatYen(goal.cumulativeAmount)}</strong> / {formatYen(goal.target)} ({Math.round(pctComplete)}%)
      </div>
      <ProgressBar value={pctComplete} color={barColor} height={8} />
    </div>
  )
}
