'use client'

import type { Shift, Job } from '@/types'
import { timeToMins } from '@/lib/timeUtils'

interface Props { shifts: Shift[]; jobs: Job[]; dateKey: string }

const HOUR_START = 6
const HOUR_END   = 29   // 05:00 next day = hour 29
const TOTAL_MINS = (HOUR_END - HOUR_START) * 60

function pct(mins: number) {
  return Math.max(0, Math.min(100, ((mins - HOUR_START * 60) / TOTAL_MINS) * 100))
}

export default function DayTimeline({ shifts, jobs }: Props) {
  if (!shifts.length) return null

  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => {
    const h = (HOUR_START + i) % 24
    return `${String(h).padStart(2, '0')}:00`
  })

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
        Day Timeline
      </div>

      <div style={{ position: 'relative', background: 'var(--card)', borderRadius: 8, overflow: 'hidden', height: 80 }}>
        {/* Hour gridlines */}
        {hours.filter((_, i) => i % 2 === 0).map((h, i) => {
          const m = (HOUR_START + i * 2) * 60
          return (
            <div key={h} style={{
              position: 'absolute', top: 0, bottom: 0, left: `${pct(m)}%`,
              borderLeft: '1px solid rgba(255,255,255,0.06)', pointerEvents: 'none',
            }}>
              <span style={{ position: 'absolute', bottom: 2, left: 2, fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>{h}</span>
            </div>
          )
        })}

        {/* Night zones: 22:00–05:00 */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pct(22 * 60)}%`, right: '0%', background: 'rgba(99,102,241,0.08)' }} />

        {/* Shift bars */}
        {shifts.map((s, i) => {
          const job = jobs.find(j => j.id === s.jobId)
          if (!job) return null

          let startM = timeToMins(s.start)
          let endM   = timeToMins(s.end)
          if (endM <= startM) endM += 24 * 60

          // Clamp to timeline
          const clampedStart = Math.max(HOUR_START * 60, startM)
          const clampedEnd   = Math.min(HOUR_END * 60,   endM)
          const left  = pct(clampedStart)
          const width = pct(clampedEnd) - left

          return (
            <div key={i}>
              <div style={{
                position: 'absolute', top: 8,
                left: `${left}%`, width: `${Math.max(width, 0.5)}%`,
                height: 28, borderRadius: 4,
                background: `${job.color}cc`,
                border: `1px solid ${job.color}`,
                overflow: 'hidden', display: 'flex', alignItems: 'center',
              }}>
                <span style={{ fontSize: 8, padding: '0 3px', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {job.name.substring(0, 6)}
                </span>
              </div>

              {/* Break overlays */}
              {s.breaks.map((br, bi) => {
                let bs = timeToMins(br.start), be = timeToMins(br.end)
                if (be <= bs) be += 24 * 60
                const bl = pct(Math.max(HOUR_START * 60, bs))
                const bw = pct(Math.min(HOUR_END * 60, be)) - bl
                return (
                  <div key={bi} style={{
                    position: 'absolute', top: 8,
                    left: `${bl}%`, width: `${Math.max(bw, 0.3)}%`,
                    height: 28,
                    background: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.4) 0px, rgba(0,0,0,0.4) 3px, transparent 3px, transparent 6px)',
                    borderRadius: 2,
                  }} />
                )
              })}

              {/* Actual times indicator */}
              {s.actualLogin && s.actualLogout && (() => {
                let al = timeToMins(s.actualLogin), ao = timeToMins(s.actualLogout)
                if (ao <= al) ao += 24 * 60
                const al2 = pct(Math.max(HOUR_START * 60, al))
                const aw  = pct(Math.min(HOUR_END * 60, ao)) - al2
                return (
                  <div style={{
                    position: 'absolute', top: 40,
                    left: `${al2}%`, width: `${Math.max(aw, 0.5)}%`,
                    height: 12, borderRadius: 2,
                    background: `${job.color}77`,
                    border: `1px dashed ${job.color}`,
                  }} />
                )
              })()}
            </div>
          )
        })}

        {/* Now line */}
        {(() => {
          const now = new Date()
          const nowM = now.getHours() * 60 + now.getMinutes()
          if (nowM < HOUR_START * 60 || nowM > HOUR_END * 60) return null
          return (
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              left: `${pct(nowM)}%`,
              borderLeft: '1px solid var(--accent2)',
              zIndex: 5,
            }} />
          )
        })()}
      </div>
    </div>
  )
}
