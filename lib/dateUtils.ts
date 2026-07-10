// ═══════════════════════════════════════════════
// Date Utilities — BOW v6.3
// ═══════════════════════════════════════════════

/** Format date as "YYYY-MM-DD" — m is 0-indexed */
export function dateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** Today as "YYYY-MM-DD" */
export function todayKey(): string {
  const t = new Date()
  return dateKey(t.getFullYear(), t.getMonth(), t.getDate())
}

/** Parse "YYYY-MM-DD" → Date object (local time midnight) */
export function parseDate(dk: string): Date {
  const [y, m, d] = dk.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Format "YYYY-MM-DD" → "15 Monday" */
export function formatDayTitle(dk: string): string {
  const d = parseDate(dk)
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  return `${d.getDate()} ${days[d.getDay()]}`
}

/** Format "YYYY-MM-DD" → "Mon, 15 Jun" */
export function formatShortDate(dk: string): string {
  const d = parseDate(dk)
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`
}

/**
 * Week start = Monday of the given date's week
 * Uses Monday-based weeks (critical for Japan visa 28h compliance)
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const offset = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + offset)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Return array of 7 Date objects [Mon, Tue, ... Sun] for the week */
export function weekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
}

/** Convert Date to Monday-based day index: Mon=0, Tue=1...Sun=6 */
export function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

/** Format month key "YYYY-MM" from year/month (0-indexed) */
export function monthKey(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

/** Parse "YYYY-MM" → { year, month (0-indexed) } */
export function parseMonthKey(mk: string): { year: number; month: number } {
  const [y, m] = mk.split('-').map(Number)
  return { year: y, month: m - 1 }
}

/** Navigate month: returns new { year, month } — unclamped, free navigation. */
export function navigateMonth(
  y: number, m: number, delta: number
): { year: number; month: number } {
  let nm = m + delta
  let ny = y
  if (nm > 11) { ny += Math.floor(nm / 12); nm = nm % 12 }
  if (nm < 0)  { ny += Math.floor(nm / 12); nm = ((nm % 12) + 12) % 12 }
  return { year: ny, month: nm }
}

/** Get all dates for a calendar grid (fills from Mon before first day) */
export function calendarGridDates(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const startOffset = mondayIndex(first)  // 0=Mon

  const cells: (Date | null)[] = []
  // Prefix nulls to align to Monday
  for (let i = 0; i < startOffset; i++) cells.push(null)
  // Actual days
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d))
  // Suffix nulls to complete last week
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}