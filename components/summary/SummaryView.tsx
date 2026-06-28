'use client'

import { useMemo, useEffect } from 'react'
import { useJobsStore } from '@/store/useJobsStore'
import { useAppStore } from '@/store/useAppStore'
import { useExpensesStore } from '@/store/useExpensesStore'
import { getDayHours, getNightHours } from '@/lib/dayHours'
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

  // Visa audit color (used on multiple subsections — derive once)
  const visaColor =
    weeklyVisaAudit.monthSafetyStatus === 'violating' ? 'var(--red)'
    : weeklyVisaAudit.monthSafetyStatus === 'caution'   ? 'var(--yellow)'
    : 'var(--success)'

  // Card layout — match Calendar's compact strip aesthetic
  return (
    <div style={{
      padding: '12px 12px 120px 12px',
      maxWidth: 600,
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>

      {/* ── Header ─────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
          {MONTH_NAMES[curM]} {curY}
        </h2>
        <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Summary
        </span>
      </div>

      {/* ── Section helper ─────────────────── */}
      <Section emoji="🛡️" label="Visa" sublabel={`Limit ${CONFIG.WEEKLY_HOUR_LIMIT}h/wk`}>
        <Strip>
          <Stat label="Hours" value={formatHours(activeMonthStats.hours)} />
          <Stat label="Peak Wk" value={formatHours(weeklyVisaAudit.maxWeekHours)} unit={`/${CONFIG.WEEKLY_HOUR_LIMIT}h`} valueColor={visaColor} />
          <Stat
            label="Status"
            value={
              weeklyVisaAudit.monthSafetyStatus === 'safe' ? '✓ Safe'
              : weeklyVisaAudit.monthSafetyStatus === 'caution' ? '⚡ Caution'
              : '⚠ Over'
            }
            valueColor={visaColor}
          />
        </Strip>

        {/* Compact week rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
          {weeklyVisaAudit.weeks.map(w => {
            const dotColor =
              w.status === 'danger' ? 'var(--red)'
              : w.status === 'warning' ? 'var(--yellow)'
              : 'var(--success)'
            return (
              <div key={w.weekNum} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '5px 8px', borderRadius: 6,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  W{w.weekNum} <span style={{ color: 'var(--muted)', fontWeight: 500 }}>· {w.weekStart}–{w.weekEnd}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{formatHours(w.hours)}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 8,
                    background: `${dotColor.replace(')', ', 0.08)')}55`,
                    color: dotColor,
                  }}>
                    {w.status === 'danger' ? 'OVER' : w.status === 'warning' ? 'NEAR' : 'OK'}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      </Section>

      {/* ── Cash flow + savings ────────────── */}
      <Section emoji="💰" label="Cash flow" sublabel={`${MONTH_NAMES[curM]} this month`}>
        <Strip>
          <Stat label="Earned" value={formatYen(activeMonthStats.earned)} valueColor="var(--green2)" />
          <Stat label="Spent" value={formatYen(totalMonthExpenses)} valueColor="var(--accent2)" />
          <Stat
            label="Net"
            value={(activeMonthStats.netSavings >= 0 ? '+' : '') + formatYen(activeMonthStats.netSavings)}
            valueColor={activeMonthStats.netSavings >= 0 ? 'var(--info)' : 'var(--red)'}
          />
        </Strip>

        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
            <span>Savings rate</span>
            <span style={{ fontWeight: 700, color: activeMonthStats.savingsRate >= 0 ? 'var(--success)' : 'var(--red)' }}>
              {activeMonthStats.savingsRate}%
            </span>
          </div>
          <ProgressBar
            value={Math.max(0, activeMonthStats.savingsRate)}
            color={activeMonthStats.savingsRate >= 0 ? 'var(--success)' : 'var(--red)'}
            height={6}
          />
        </div>
      </Section>

      {/* ── Night pay ──────────────────────── */}
      <Section emoji="🌙" label="Night premium" sublabel="22:00–05:00 differential">
        <Strip>
          <Stat
            label="Night hrs"
            value={formatHours(activeMonthStats.nightHours)}
            sub={activeMonthStats.hours > 0
              ? `${Math.round((activeMonthStats.nightHours / activeMonthStats.hours) * 100)}% of total`
              : '—'}
          />
          <Stat
            label="Bonus"
            value={`+${formatYen(activeMonthStats.nightPremiumEarned)}`}
            valueColor="var(--yellow)"
            sub="From night differential"
          />
        </Strip>
      </Section>

      {/* ── School fee ─────────────────────── */}
      <Section emoji="🎓" label="School fee" sublabel={`Target ${formatYen(schoolFeeTarget)}`}>
        <Strip>
          <Stat label="Earned" value={formatYen(allTimeStats.totalEarned)} valueColor="var(--green2)" />
          <Stat
            label="Gap"
            value={allTimeStats.feeGap > 0 ? formatYen(allTimeStats.feeGap) : '✓ Met'}
            valueColor={allTimeStats.feeGap > 0 ? 'var(--warning)' : 'var(--success)'}
          />
          <Stat label="Avg/mo" value={formatYen(allTimeStats.avgPerMonth)} />
        </Strip>

        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
            <span>Progress</span>
            <span style={{ fontWeight: 700, color: 'var(--info)' }}>{Math.round(allTimeStats.feePct)}%</span>
          </div>
          <ProgressBar value={allTimeStats.feePct} color="var(--info)" height={6} />
        </div>
      </Section>

      {/* ── Insights (single neutral card) ── */}
      <Section emoji="✨" label="Insights" sublabel="This month">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          <Insight icon="🛡️">
            <strong style={{ color: '#fff' }}>Visa:</strong>{' '}
            {weeklyVisaAudit.monthSafetyStatus === 'safe'
              ? `${formatHours(activeMonthStats.hours)} this month looks compliant.`
              : `Week ${weeklyVisaAudit.weeks.find(w => w.status !== 'compliant')?.weekNum} is close to or over the limit.`}
          </Insight>
          <Insight icon="📈">
            <strong style={{ color: '#fff' }}>Goal:</strong> at{' '}
            {formatYen(allTimeStats.avgPerMonth)}/mo you'll close the{' '}
            {formatYen(allTimeStats.feeGap)} gap in{' '}
            <strong style={{ color: 'var(--green2)' }}>
              {allTimeStats.avgPerMonth > 0 ? (allTimeStats.feeGap / allTimeStats.avgPerMonth).toFixed(1) : '0.0'} months
            </strong>.
          </Insight>
          <Insight icon="🌙">
            <strong style={{ color: '#fff' }}>Night:</strong> shifting 2h after 22:00 ≈{' '}
            <strong style={{ color: 'var(--yellow)' }}>+¥2,500</strong>/mo without extra hours.
          </Insight>
        </div>
      </Section>

      {/* ── Monthly history ────────────────── */}
      {allTimeStats.perMonth.length > 0 && (
        <Section emoji="📅" label="History" sublabel="All-time earnings">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {allTimeStats.perMonth.map(pm => {
              const [y, mo] = pm.key.split('-').map(Number)
              const pct = Math.min(100, (pm.earned / (allTimeStats.avgPerMonth || 1)) * 100)
              return (
                <div key={pm.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {MONTH_NAMES[mo - 1].slice(0, 3)} {y}
                    </span>
                    <span style={{ color: 'var(--green2)', fontWeight: 700 }}>{formatYen(pm.earned)}</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: 'var(--accent)',
                      borderRadius: 2,
                      transition: 'width 300ms ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}
    </div>
  )
}

/* ── Sub-components (visual-only) ────────────── */

function Section({
  emoji, label, sublabel, children,
}: {
  emoji: string
  label: string
  sublabel?: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      background: 'var(--card)',
      borderRadius: 10,
      border: '1px solid var(--border)',
      padding: '10px 10px 12px 10px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13 }}>{emoji}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{label}</span>
        </div>
        {sublabel && (
          <span style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
            {sublabel}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function Strip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${React.Children.count(children)}, 1fr)`,
      gap: 6,
    }}>
      {children}
    </div>
  )
}

function Stat({
  label, value, unit, valueColor, sub,
}: {
  label: string
  value: string
  unit?: string
  valueColor?: string
  sub?: string
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.05)',
      borderRadius: 8,
      padding: '8px 6px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
    }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: valueColor || 'var(--accent)' }}>
        {value}
        {unit && <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 600, marginLeft: 2 }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 9, color: 'var(--muted2)', marginTop: 2 }}>{sub}</div>
      )}
    </div>
  )
}

function Insight({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span style={{
        flexShrink: 0,
        width: 18, height: 18,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, borderRadius: 999,
        background: 'rgba(255,255,255,0.04)',
      }}>{icon}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

/* re-export React.Children: keep the React import local-only via JSX runtime */
import React from 'react'
