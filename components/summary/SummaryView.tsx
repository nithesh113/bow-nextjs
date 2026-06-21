'use client'

import { useMemo, useEffect } from 'react'
import { useJobsStore } from '@/store/useJobsStore'
import { useAppStore } from '@/store/useAppStore'
import { useExpensesStore } from '@/store/useExpensesStore'
import { getDayHours, getNightHours } from '@/services/storage'
import { dateKey } from '@/lib/dateUtils'
import { formatHours, formatYen } from '@/lib/timeUtils'
import { CONFIG, MONTH_NAMES } from '@/lib/constants'
import ProgressBar from '@/components/ui/ProgressBar'
import { AuthUser } from '@/lib/auth/session'

interface SummaryViewProps {
  user: AuthUser
}

export default function SummaryView({ user }: SummaryViewProps) {
  const { curY, curM } = useAppStore()
  const { jobs } = useJobsStore()
  const { expensesByMonth, loadMonth } = useExpensesStore()

  const monthKey = `${curY}-${String(curM + 1).padStart(2, '0')}`
  const schoolFeeTarget = user.schoolFee ?? 840000

  // Load database expenses for the currently viewed month
  useEffect(() => {
    loadMonth(monthKey)
  }, [monthKey, loadMonth])

  // Get expenses for the selected month
  const activeMonthExpenses = useMemo(() => {
    return expensesByMonth[monthKey] || []
  }, [expensesByMonth, monthKey])

  const totalMonthExpenses = useMemo(() => {
    return activeMonthExpenses.reduce((sum, e) => sum + e.amount, 0)
  }, [activeMonthExpenses])

  // Calculate statistics over all configured months (All-Time)
  const allTimeStats = useMemo(() => {
    let totalHours = 0
    let totalEarned = 0
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
          const total = getDayHours(dk, j.id)
          const night = getNightHours(dk, j.id)
          const dayH = total - night
          const nightRate = j.nightRate || Math.round(j.rate * 1.25)
          const earned = dayH * j.rate + night * nightRate
          totalHours += total
          totalEarned += earned
          monthEarned += earned
          if (!perJob[j.id]) perJob[j.id] = { hours: 0, earned: 0 }
          perJob[j.id].hours += total
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
      feeGap: Math.max(0, schoolFeeTarget - Math.round(totalEarned)),
      feePct: Math.min(100, (totalEarned / schoolFeeTarget) * 100),
      perJob: Object.entries(perJob).map(([id, s]) => ({
        job: jobs.find(j => j.id === id)!, ...s, earned: Math.round(s.earned),
      })),
      perMonth,
    }
  }, [jobs, schoolFeeTarget])

  // Calculate statistics specifically for the active/selected month
  const activeMonthStats = useMemo(() => {
    let monthHours = 0
    let monthEarned = 0
    let nightHours = 0
    let nightPremiumEarned = 0
    const days = new Date(curY, curM + 1, 0).getDate()

    for (let d = 1; d <= days; d++) {
      const dk = dateKey(curY, curM, d)
      for (const j of jobs) {
        const total = getDayHours(dk, j.id)
        const night = getNightHours(dk, j.id)
        const dayH = total - night
        const nightRate = j.nightRate || Math.round(j.rate * 1.25)
        const earned = dayH * j.rate + night * nightRate

        monthHours += total
        monthEarned += earned
        nightHours += night
        nightPremiumEarned += night * (nightRate - j.rate)
      }
    }

    const netSavings = monthEarned - totalMonthExpenses
    const savingsRate = monthEarned > 0 ? Math.max(-100, Math.min(100, (netSavings / monthEarned) * 100)) : 0

    return {
      hours: monthHours,
      earned: Math.round(monthEarned),
      nightHours,
      nightPremiumEarned: Math.round(nightPremiumEarned),
      netSavings: Math.round(netSavings),
      savingsRate: Math.round(savingsRate),
    }
  }, [curY, curM, jobs, totalMonthExpenses])

  // Calculate Mon-Sun weekly hours worked for the active month to run the Visa Audit
  const weeklyVisaAudit = useMemo(() => {
    const startOfMonth = new Date(curY, curM, 1)
    const endOfMonth = new Date(curY, curM + 1, 0)

    // Find the Monday offset of the first week touching this month
    const startDay = startOfMonth.getDay() // 0 = Sun, 1 = Mon ...
    const offset = startDay === 0 ? -6 : 1 - startDay
    const firstMonday = new Date(startOfMonth)
    firstMonday.setDate(startOfMonth.getDate() + offset)

    const weeks: { weekNum: number; weekStart: string; weekEnd: string; hours: number; status: 'compliant' | 'warning' | 'danger' }[] = []

    let currentMonday = new Date(firstMonday)
    let weekIndex = 1

    while (currentMonday <= endOfMonth) {
      let weekHours = 0
      const weekStartStr = `${currentMonday.getMonth() + 1}/${currentMonday.getDate()}`

      const currentSunday = new Date(currentMonday)
      currentSunday.setDate(currentMonday.getDate() + 6)
      const weekEndStr = `${currentSunday.getMonth() + 1}/${currentSunday.getDate()}`

      for (let i = 0; i < 7; i++) {
        const d = new Date(currentMonday)
        d.setDate(currentMonday.getDate() + i)
        const dk = dateKey(d.getFullYear(), d.getMonth(), d.getDate())
        for (const j of jobs) {
          weekHours += getDayHours(dk, j.id)
        }
      }

      let status: 'compliant' | 'warning' | 'danger' = 'compliant'
      if (weekHours > CONFIG.WEEKLY_HOUR_LIMIT) {
        status = 'danger'
      } else if (weekHours >= CONFIG.WEEK_NEAR_THRESHOLD) {
        status = 'warning'
      }

      weeks.push({
        weekNum: weekIndex++,
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        hours: weekHours,
        status,
      })

      currentMonday.setDate(currentMonday.getDate() + 7)
    }

    const maxWeekHours = weeks.reduce((max, w) => Math.max(max, w.hours), 0)
    const hasDanger = weeks.some(w => w.status === 'danger')
    const hasWarning = weeks.some(w => w.status === 'warning')

    let monthSafetyStatus: 'safe' | 'caution' | 'violating' = 'safe'
    if (hasDanger) monthSafetyStatus = 'violating'
    else if (hasWarning) monthSafetyStatus = 'caution'

    return {
      weeks,
      maxWeekHours,
      monthSafetyStatus,
    }
  }, [curY, curM, jobs])

  return (
    <div style={{
      padding: '16px 12px 120px 12px',
      maxWidth: 600,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>

      {/* ── Active Month Overview Tab Header ────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--display)', color: '#fff', letterSpacing: '-0.01em' }}>
          {MONTH_NAMES[curM]} {curY} Analytics
        </h2>
        <span style={{
          fontSize: 9,
          background: 'rgba(59,130,246,0.1)',
          border: '1px solid rgba(59,130,246,0.2)',
          padding: '4px 10px',
          borderRadius: 20,
          color: 'var(--info)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em'
        }}>
          🗄️ Neon DB Sync
        </span>
      </div>

      {/* ── 1. Visa Hours Compliance Audit Card ────────────────── */}
      <div style={{
        background: 'var(--card)',
        borderRadius: 16,
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${weeklyVisaAudit.monthSafetyStatus === 'violating'
            ? 'var(--red)'
            : weeklyVisaAudit.monthSafetyStatus === 'caution'
              ? 'var(--yellow)'
              : 'var(--success)'
          }`,
        padding: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🛡️</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Visa Compliance Audit
            </span>
          </div>
          {weeklyVisaAudit.monthSafetyStatus === 'safe' && (
            <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.25)', padding: '2px 8px', borderRadius: 12 }}>
              COMPLIANT
            </span>
          )}
          {weeklyVisaAudit.monthSafetyStatus === 'caution' && (
            <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(245,158,11,0.1)', color: 'var(--yellow)', border: '1px solid rgba(245,158,11,0.25)', padding: '2px 8px', borderRadius: 12 }}>
              CAUTION
            </span>
          )}
          {weeklyVisaAudit.monthSafetyStatus === 'violating' && (
            <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(239,68,68,0.1)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.25)', padding: '2px 8px', borderRadius: 12 }}>
              OVER LIMIT
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <div style={{
            flex: '1 1 120px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: 12,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2, fontWeight: 500 }}>Month Hours</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{formatHours(activeMonthStats.hours)}</span>
          </div>
          <div style={{
            flex: '1 1 120px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: 12,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2, fontWeight: 500 }}>Peak Week</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: weeklyVisaAudit.monthSafetyStatus === 'violating' ? 'var(--red)' : weeklyVisaAudit.monthSafetyStatus === 'caution' ? 'var(--yellow)' : 'var(--accent)' }}>
              {formatHours(weeklyVisaAudit.maxWeekHours)} <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted)' }}>/ 28h</span>
            </span>
          </div>
        </div>

        {/* Responsive horizontal or vertical week list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {weeklyVisaAudit.weeks.map(w => (
            <div key={w.weekNum} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid rgba(255,255,255,0.02)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Week {w.weekNum}</span>
                <span style={{ fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>{w.weekStart} – {w.weekEnd}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'monospace' }}>{formatHours(w.hours)}</span>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: w.status === 'danger' ? 'var(--red)' : w.status === 'warning' ? 'var(--yellow)' : 'var(--success)',
                  boxShadow: `0 0 8px ${w.status === 'danger' ? 'var(--red)' : w.status === 'warning' ? 'var(--yellow)' : 'var(--success)'}`
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. Current Month Cash Flow & Savings Rate Card ──────── */}
      <div style={{
        background: 'var(--card)',
        borderRadius: 16,
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${activeMonthStats.netSavings >= 0 ? 'var(--success)' : 'var(--red)'}`,
        padding: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>💰</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Cash Flow & Savings Rate
          </span>
        </div>

        {/* Responsive flex wrapping for cash flow widgets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Earnings', value: formatYen(activeMonthStats.earned), color: 'var(--green2)', bg: 'rgba(34,197,94,0.03)', border: 'rgba(34,197,94,0.1)' },
            { label: 'Expenses', value: formatYen(totalMonthExpenses), color: 'var(--accent2)', bg: 'rgba(239,68,68,0.03)', border: 'rgba(239,68,68,0.1)' },
            { label: 'Net Savings', value: (activeMonthStats.netSavings >= 0 ? '+' : '') + formatYen(activeMonthStats.netSavings), color: activeMonthStats.netSavings >= 0 ? 'var(--info)' : 'var(--red)', bg: 'rgba(14,165,233,0.03)', border: 'rgba(14,165,233,0.1)' }
          ].map((item, idx) => (
            <div key={idx} style={{
              flex: '1 1 120px',
              background: item.bg,
              border: `1px solid ${item.border}`,
              borderRadius: 12,
              padding: '10px 8px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              minWidth: 100
            }}>
              <span style={{ fontSize: 9, color: 'var(--muted)', marginBottom: 3, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>{item.label}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Savings Rate progress indicator */}
        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: 12, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, marginBottom: 6 }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Month Savings Rate</span>
            <span style={{ fontWeight: 800, color: activeMonthStats.savingsRate >= 0 ? 'var(--success)' : 'var(--red)', fontSize: 12 }}>
              {activeMonthStats.savingsRate}%
            </span>
          </div>
          <ProgressBar value={Math.max(0, activeMonthStats.savingsRate)} color={activeMonthStats.savingsRate >= 0 ? 'var(--success)' : 'var(--red)'} height={8} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 9, color: 'var(--muted)', fontWeight: 500 }}>
            <span>0% (Neutral)</span>
            <span>Target: High Savings</span>
          </div>
        </div>
      </div>

      {/* ── 3. Night-Pay Optimization Card ─────────────────────── */}
      <div style={{
        background: 'var(--card)',
        borderRadius: 16,
        border: '1px solid var(--border)',
        borderLeft: '4px solid var(--yellow)',
        padding: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>🌙</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Night Pay & Premium Optimization
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Premium Night Hours</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
              {formatHours(activeMonthStats.nightHours)}
            </span>
            <span style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
              {activeMonthStats.hours > 0 ? Math.round((activeMonthStats.nightHours / activeMonthStats.hours) * 100) : 0}% of your total workload
            </span>
          </div>
          <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>Night Premium Bonus</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--yellow)' }}>
              +{formatYen(activeMonthStats.nightPremiumEarned)}
            </span>
            <span style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>
              Extra money earned from night differential pay
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. Dynamic School Fee Progress Card ────────────────── */}
      <div style={{
        background: 'var(--card)',
        borderRadius: 16,
        border: '1px solid var(--border)',
        borderLeft: '4px solid var(--info)',
        padding: 16,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🎓</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              School Fee Goal Tracker
            </span>
          </div>
          <span style={{
            fontSize: 9,
            fontWeight: 800,
            color: 'var(--info)',
            background: 'rgba(14,165,233,0.1)',
            border: '1px solid rgba(14,165,233,0.25)',
            padding: '2px 8px',
            borderRadius: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.02em'
          }}>
            {Math.round(allTimeStats.feePct)}% Met
          </span>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.02)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <ProgressBar value={allTimeStats.feePct} color="var(--info)" height={12} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--muted)', fontWeight: 500 }}>
            <span>Earned: <strong style={{ color: 'var(--green2)' }}>{formatYen(allTimeStats.totalEarned)}</strong></span>
            <span>Target: <strong style={{ color: '#fff' }}>{formatYen(schoolFeeTarget)}</strong></span>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Remaining Target Gap</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: allTimeStats.feeGap > 0 ? 'var(--warning)' : 'var(--success)' }}>
              {allTimeStats.feeGap > 0 ? formatYen(allTimeStats.feeGap) : '🎉 Tuition Fully Met!'}
            </span>
          </div>
          <div style={{ flex: '1 1 120px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>Monthly Avg Earnings</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{formatYen(allTimeStats.avgPerMonth)}</span>
          </div>
        </div>
      </div>

      {/* ── 5. ✨ AI Financial & Visa Insights Card (Beta Preview) ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(168,85,247,0.06) 0%, rgba(59,130,246,0.06) 100%)',
        border: '1px solid rgba(168,85,247,0.25)',
        borderLeft: '4px solid #a855f7',
        borderRadius: 16,
        padding: 16,
        boxShadow: '0 4px 24px rgba(139,92,246,0.12)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: -50, right: -50, width: 100, height: 100,
          background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>✨</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              AI Financial & Visa Insights
            </span>
          </div>
          <span style={{ fontSize: 9, fontWeight: 800, background: 'rgba(192,132,252,0.15)', color: '#c084fc', border: '1px solid rgba(192,132,252,0.3)', padding: '2px 8px', borderRadius: 8, letterSpacing: '0.03em' }}>
            BETA PREVIEW
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 11, lineHeight: 1.5 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 13, display: 'inline-block', minWidth: 16, textAlign: 'center' }}>🛡️</span>
            <div>
              <strong style={{ color: '#fff', fontWeight: 700 }}>Visa Safety Analysis:</strong>{' '}
              <span style={{ color: 'var(--text-secondary)' }}>
                Your current schedule ({formatHours(activeMonthStats.hours)} this month) is compliant.
                {weeklyVisaAudit.monthSafetyStatus === 'safe'
                  ? ' Safety margins look healthy, with an average weekly workload of ' + formatHours(activeMonthStats.hours / 4) + '.'
                  : ' Caution: Week ' + weeklyVisaAudit.weeks.find(w => w.status !== 'compliant')?.weekNum + ' is close to or over the limit. Adjust your schedule.'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 13, display: 'inline-block', minWidth: 16, textAlign: 'center' }}>📈</span>
            <div>
              <strong style={{ color: '#fff', fontWeight: 700 }}>Goal Target Forecast:</strong>{' '}
              <span style={{ color: 'var(--text-secondary)' }}>
                At your average monthly earnings rate ({formatYen(allTimeStats.avgPerMonth)}/mo), you will bridge your remaining school fee gap of{' '}
                {formatYen(allTimeStats.feeGap)} in{' '}
                <span style={{ color: 'var(--green2)', fontWeight: 800 }}>
                  {allTimeStats.avgPerMonth > 0 ? (allTimeStats.feeGap / allTimeStats.avgPerMonth).toFixed(1) : '0.0'} months
                </span>.
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 13, display: 'inline-block', minWidth: 16, textAlign: 'center' }}>🌙</span>
            <div>
              <strong style={{ color: '#fff', fontWeight: 700 }}>Night Premium Opportunity:</strong>{' '}
              <span style={{ color: 'var(--text-secondary)' }}>
                Shift 2 hours of your weekly McDonald's shifts after 22:00 to boost your monthly income by approximately{' '}
                <span style={{ color: 'var(--yellow)', fontWeight: 800 }}>+¥2,500</span> without increasing your work hours.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 6. Month-by-Month Historical Breakdown ─────────────── */}
      {allTimeStats.perMonth.length > 0 && (
        <div style={{
          background: 'var(--card)',
          borderRadius: 16,
          border: '1px solid var(--border)',
          padding: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            Monthly Earnings breakdown
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {allTimeStats.perMonth.map(pm => {
              const [y, mo] = pm.key.split('-').map(Number)
              const pct = Math.min(100, (pm.earned / (allTimeStats.avgPerMonth || 1)) * 100)
              return (
                <div key={pm.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{MONTH_NAMES[mo - 1]} {y}</span>
                    <span style={{ color: 'var(--green2)', fontWeight: 700 }}>{formatYen(pm.earned)}</span>
                  </div>
                  <ProgressBar value={pct} color="var(--accent)" height={4} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
