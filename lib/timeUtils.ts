// ═══════════════════════════════════════════════
// Time Utilities — BOW v6.3
// ═══════════════════════════════════════════════

/** "HH:MM" → total minutes from midnight */
export function timeToMins(t: string): number {
  if (!t || !t.includes(':')) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Total minutes → "HH:MM" */
export function minsToTime(m: number): string {
  const totalM = ((m % 1440) + 1440) % 1440
  return `${String(Math.floor(totalM / 60)).padStart(2, '0')}:${String(totalM % 60).padStart(2, '0')}`
}

/** Format decimal hours as "7h 30m" or "7h" */
export function formatHours(h: number): string {
  if (h <= 0) return '0h'
  const hours = Math.floor(h)
  const mins  = Math.round((h - hours) * 60)
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

/** Format ¥ amount: 12500 → "¥12,500" */
export function formatYen(amount: number): string {
  return `¥${Math.round(amount).toLocaleString('ja-JP')}`
}

/** Check if a time (mins) falls in night pay period: 22:00–05:00 */
export function isNightMinute(m: number): boolean {
  // Normalise to 0–1439
  const n = ((m % 1440) + 1440) % 1440
  return n >= 22 * 60 || n < 5 * 60
}

/** Current time as "HH:MM" */
export function nowTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Current date as "YYYY-MM-DD" */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
