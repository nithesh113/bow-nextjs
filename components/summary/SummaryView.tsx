'use client'

import { useMemo } from 'react'
import { useJobsStore } from '@/store/useJobsStore'
import { getDayHours, getNightHours } from '@/services/storage'
import { dateKey } from '@/lib/dateUtils'
import { formatHours, formatYen } from '@/lib/timeUtils'
import { CONFIG, MONTH_NAMES } from '@/lib/constants'
import ProgressBar from '@/components/ui/ProgressBar'

export default function SummaryView() {
  const { jobs } = useJobsStore()

  const stats = useMemo(() => {
    let totalHours = 0, totalEarned = 0
    const perJob: Record<string, { hours: number; earned: number }> = {}
    const perMonth: { key: string; earned: number }[] = []

    for (let mo = 0; mo < CONFIG.TOTAL_MONTHS; mo++) {
      const rawM = CONFIG.START_MONTH + mo
      const y = CONFIG.START_YEAR + Math.floor(rawM / 12)
      const m = ((rawM % 12) + 12) % 12
      const days = new Date(y, m + 1, 0).getDate()
      let monthEarned = 0

      for (let d = 1; d <= days; d++) {
        const dk = dateKey(y, m, d)
        for (const j of jobs) {
          const total  = getDayHours(dk, j.id)
          const night  = getNightHours(dk, j.id)
          const dayH   = total - night
          const nightRate = j.nightRate || Math.round(j.rate * 1.25)
          const earned = dayH * j.rate + night * nightRate
          totalHours  += total
          totalEarned += earned
          monthEarned += earned
          if (!perJob[j.id]) perJob[j.id] = { hours: 0, earned: 0 }
          perJob[j.id].hours  += total
          perJob[j.id].earned += earned
        }
      }

      if (monthEarned > 0) {
        perMonth.push({ key: `${y}-${String(m + 1).padStart(2, '0')}`, earned: Math.round(monthEarned) })
      }
    }

    return {
      totalHours,
      totalEarned: Math.round(totalEarned),
      avgPerMonth: perMonth.length ? Math.round(totalEarned / perMonth.length) : 0,
      feeGap: Math.max(0, CONFIG.SCHOOL_FEE - Math.round(totalEarned)),
      feePct: Math.min(100, (totalEarned / CONFIG.SCHOOL_FEE) * 100),
      perJob: Object.entries(perJob).map(([id, s]) => ({
        job: jobs.find(j => j.id === id)!, ...s, earned: Math.round(s.earned),
      })),
      perMonth,
    }
  }, [jobs])

  return (
    <div style={{ padding: 16 }}>
      {/* Cumulative card */}
      <div style={{ background: 'var(--card)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
          All-Time Totals
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          {[
            { label: 'Total Hours', value: formatHours(stats.totalHours), color: 'var(--accent)' },
            { label: 'Total Earned', value: formatYen(stats.totalEarned), color: 'var(--green2)' },
            { label: 'Avg / Month', value: formatYen(stats.avgPerMonth), color: 'var(--info)' },
            { label: stats.feeGap > 0 ? 'Fee Gap' : '✓ Fee Met!', value: stats.feeGap > 0 ? formatYen(stats.feeGap) : '🎉', color: stats.feeGap > 0 ? 'var(--warning)' : 'var(--success)' },
          ].map(c => (
            <div key={c.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Per-job breakdown */}
        {stats.perJob.filter(j => j.job).map(j => (
          <div key={j.job.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: j.job.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, flex: 1 }}>{j.job.name}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatHours(j.hours)}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--green2)' }}>{formatYen(j.earned)}</span>
          </div>
        ))}
      </div>

      {/* School Fee Progress */}
      <div style={{ background: 'var(--card)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🎓 School Fee Progress
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
            {Math.round(stats.feePct)}%
          </span>
        </div>
        <ProgressBar value={stats.feePct} color="var(--accent)" height={12} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
          <span>Earned: <strong style={{ color: 'var(--green2)' }}>{formatYen(stats.totalEarned)}</strong></span>
          <span>Target: <strong style={{ color: 'var(--text)' }}>{formatYen(CONFIG.SCHOOL_FEE)}</strong></span>
        </div>
      </div>

      {/* Monthly breakdown */}
      {stats.perMonth.length > 0 && (
        <div style={{ background: 'var(--card)', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
            Monthly Breakdown
          </div>
          {stats.perMonth.map(pm => {
            const [y, mo] = pm.key.split('-').map(Number)
            const pct = Math.min(100, (pm.earned / (stats.avgPerMonth || 1)) * 100)
            return (
              <div key={pm.key} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: 'var(--text)' }}>{MONTH_NAMES[mo - 1]} {y}</span>
                  <span style={{ color: 'var(--green2)', fontWeight: 700 }}>{formatYen(pm.earned)}</span>
                </div>
                <ProgressBar value={pct} color="var(--accent)" height={4} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
