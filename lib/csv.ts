/**
 * Tiny RFC-4180 compliant CSV (de)serializer for backup files.
 *
 * No external dependency (no Papa Parse, no csv-parse). Handles:
 *   - quoted fields with embedded commas,
 *   - escaped double-quotes (`""`),
 *   - CRLF or LF line breaks,
 *   - empty trailing rows.
 *
 * The backup format is one **combined CSV** with sections separated by
 * a single blank row. Each section starts with `# section: <name>`,
 * followed by a CSV header row, then data rows. Example:
 *
 *   # section: jobs
 *   id,name,color,rate,nightRate
 *   j1,McDonald's,#f59e0b,1250,1562
 *
 *   # section: shifts
 *   date,jobId,start,end,actualLogin,actualLogout,actualBreaksJson
 *   2026-04-01,j1,09:00,17:00,,,
 *
 * Importer (services/importService.ts) segments on `# section:` lines
 * to know which table a row belongs to, then CSV-parses the chunk.
 */

export function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  const needsQuote = /[",\r\n]/.test(s)
  if (!needsQuote) return s
  return '"' + s.replace(/"/g, '""') + '"'
}

/** Build a CSV string from a 2-D row array (rows[0] is the header). */
export function rowsToCsv(rows: (string | number | boolean | null | undefined | unknown)[][]): string {
  return rows.map((row) => row.map(csvEscape).join(',')).join('\n')
}

/**
 * Parse a single CSV string into rows of string arrays.
 * Handles quoted fields (`"abc"def,"x,y"` → ['abcdef', 'x,y']) and
 * the doubled-quote escape (`""` → `"`).
 *
 * Returns `[]` for empty input.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let i = 0
  let inQuotes = false
  const len = text.length

  while (i < len) {
    const c = text[i]

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }

    if (c === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
      continue
    }
    if (c === '\r') {
      // Treat CRLF / CR as line-break
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
      if (text[i] === '\n') i += 1
      continue
    }
    field += c
    i += 1
  }

  // Last cell
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/**
 * Section-segmenter: group rows from `parseCsv()` into named tables
 * keyed by `# section: <name>` markers.
 */
export type CsvSection = { section: string; header: string[]; rows: string[][] }

export function segmentCsvSections(text: string): CsvSection[] {
  const rows = parseCsv(text)
  const sections: CsvSection[] = []
  let current: CsvSection | null = null

  for (const row of rows) {
    if (row.length === 1 && row[0].trim().startsWith('# section:')) {
      const name = row[0].replace(/^#\s*section:\s*/, '').trim()
      current = { section: name, header: [], rows: [] }
      sections.push(current)
      continue
    }
    if (!current) continue
    if (current.header.length === 0) {
      current.header = row
      continue
    }
    // Skip blank lines (single empty cell) — common between sections.
    if (row.length === 1 && row[0] === '') continue
    current.rows.push(row)
  }
  return sections
}

/** Decodes a section payload back to a `BackupData` shape. */
import type { BackupData } from '@/types'

export function csvSectionsToBackupData(text: string): BackupData {
  const sections = segmentCsvSections(text)
  const out: Partial<BackupData> = {
    schemaVersion: '6.4.0',
    exportedAt: new Date().toISOString(),
    profile: { country: 'Japan', weeklyLimit: 28, currency: 'JPY' },
    jobs: [],
    templates: [],
    shifts: {},
    expenses: {},
    categories: [],
    goals: [],
    monthNotes: {},
    entries: [],
  }

  const get = (name: string) => sections.find((s) => s.section === name)

  // Profile (single row)
  // Header order on the wire is: schemaVersion,exportedAt,country,weeklyLimit,currency
  const profile = get('profile')
  if (profile && profile.rows[0]) {
    const cells = profile.rows[0]
    out.schemaVersion = (cells[0] as any) || '6.4.0'
    out.exportedAt = cells[1] || new Date().toISOString()
    out.profile = {
      country: cells[2] ?? 'Japan',
      weeklyLimit: Number(cells[3] ?? 28),
      currency: cells[4] ?? 'JPY',
    }
  }

  // Jobs
  for (const row of get('jobs')?.rows ?? []) {
    if (!row[0]) continue
    out.jobs!.push({
      id: row[0],
      name: row[1] ?? '',
      color: row[2] ?? '#000000',
      rate: Number(row[3] ?? 0),
      nightRate: Number(row[4] ?? Math.round((Number(row[3] ?? 0)) * 1.25)),
    } as any)
  }

  // Templates
  for (const row of get('templates')?.rows ?? []) {
    if (!row[0]) continue
    let days: any = []
    try { days = JSON.parse(row[5] || '[]') } catch {}
    let workDetails: any = null
    try { workDetails = JSON.parse(row[6] || 'null') } catch {}
    out.templates!.push({
      id: row[0],
      name: row[1] ?? '',
      jobId: row[2] ?? '',
      start: row[3] ?? '',
      end: row[4] ?? '',
      days: Array.isArray(days) ? days : [],
      breaks: [],
      workDetails,
    } as any)
  }

  // Shifts
  // Header columns (zero-indexed): 0=date, 1=jobId, 2=start, 3=end,
  //   4=actualLogin, 5=actualLogout, 6=actualBreaksJson,
  //   7=workDetailsJson, 8=templateId, 9=source
  // Older v6.4 backups only have columns 0-6; extra columns after that
  // are simply absent and resolve to undefined through `row[8]`/`row[9]`.
  const shiftsMap: Record<string, any[]> = {}
  for (const row of get('shifts')?.rows ?? []) {
    if (!row[0]) continue
    const dk = row[0]
    let actualBreaks: any = null
    try { actualBreaks = JSON.parse(row[6] || 'null') } catch {}
    let workDetails: any = null
    try { workDetails = JSON.parse(row[7] || 'null') } catch {}
    const shift: any = {
      jobId: row[1],
      start: row[2] ?? '',
      end: row[3] ?? '',
      breaks: [],
      actualLogin: row[4] || undefined,
      actualLogout: row[5] || undefined,
      actualBreaks,
      workDetails: workDetails ?? undefined,
    }
    if (row[8]) shift.templateId = row[8]
    if (row[9]) shift.source = row[9]
    ;(shiftsMap[dk] = shiftsMap[dk] || []).push(shift)
  }
  out.shifts = shiftsMap

  // Categories
  for (const row of get('categories')?.rows ?? []) {
    if (!row[0]) continue
    const cat: any = {
      id: row[0],
      name: row[1] ?? '',
      icon: row[2] ?? '📌',
      budget: Number(row[3] ?? 0),
      priority: Number(row[4] ?? 0),
    }
    if (row[5]) cat.parentName = row[5]
    out.categories!.push(cat)
  }

  // Expenses
  for (const row of get('expenses')?.rows ?? []) {
    const monthKey = row[0] ?? ''
    if (!monthKey || !row[1]) continue
    const e: any = {
      categoryId: Number(row[2] ?? 0),
      amount: Number(row[4] ?? 0),
      date: row[1],
      note: row[5] ?? '',
    }
    if (row[3]) e.categoryName = row[3]
    ;(out.expenses![monthKey] = out.expenses![monthKey] || []).push(e)
  }

  // Goals
  for (const row of get('goals')?.rows ?? []) {
    if (!row[0]) continue
    let prog: any = {}
    try { prog = JSON.parse(row[7] || '{}') } catch {}
    out.goals!.push({
      id: row[0],
      name: row[1] ?? '',
      deadline: row[2] ?? '',
      target: Number(row[3] ?? 0),
      percentage: Number(row[4] ?? 0),
      priority: Number(row[5] ?? 0),
      createdMonth: row[6] ?? '',
      monthlyProgress: prog || {},
      cumulativeAmount: 0,
      status: 'active',
    } as any)
  }

  // Notes
  for (const row of get('notes')?.rows ?? []) {
    if (!row[0]) continue
    out.monthNotes![row[0]] = row[1] ?? ''
  }

  return out as BackupData
}
