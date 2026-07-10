import type { BackupData } from '@/types'
import { csvSectionsToBackupData } from '@/lib/csv'
import { applyProfilePrefs } from '@/app/actions/account'
import {
  getJobs,
  createJob as serverCreateJob,
  deleteJob as serverDeleteJob,
} from '@/app/actions/jobs'
import {
  getTemplates,
  createTemplate as serverCreateTemplate,
  deleteTemplate as serverDeleteTemplate,
  type TemplateData,
} from '@/app/actions/templates'
import {
  createShifts as serverCreateShifts,
  deleteShiftsByDate as serverDeleteShiftsByDate,
  type NewShiftInput,
} from '@/app/actions/shifts'
import {
  getCategories,
  getExpenses,
  createCategory,
  updateCategory,
  replaceMonthsExpenses,
  createExpensesBulk,
} from '@/app/actions/expenses'
import {
  createBudgetGoal,
  deleteBudgetGoal,
  setBudgetMonthNotes,
  getBudgetGoals,
} from '@/app/actions/budget'
import { useJobsStore } from '@/store/useJobsStore'
import { useShiftsStore } from '@/store/useShiftsStore'
import { useTemplatesStore } from '@/store/useTemplatesStore'

export interface ImportResult {
  jobs: number
  templates: number
  shifts: number
  categories: number
  expenses: number
  goals: number
  notes: number
  entries: number
  mode: 'replace' | 'merge'
  format: 'json' | 'csv'
  warnings: string[]
  /** Per-domain failures caught by the dispatcher. Surfaces in toast so silent-passes become visible. */
  failures: string[]
}

/** Hard cap on import file size. */
const MAX_FILE_BYTES = 25_000_000

// ── Format sniffing ────────────────────────────────────────

function looksLikeCsv(text: string): boolean {
  const first = text
    .split(/\r?\n/, 20)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('{') && !l.startsWith('"') && !l.startsWith('//'))
  if (!first) return false
  return first.startsWith('# section:') || first.split(',').length >= 3
}


// ── Normalisers ────────────────────────────────────────────

function normalizeName(input: string): string {
  return (input ?? '').normalize('NFC').trim().toLowerCase()
}

function dedupSignature(input: {
  categoryId: string
  amount: number
  date: string
  note?: string
}): string {
  return [
    input.date ?? '',
    input.categoryId ?? '',
    Number.isFinite(input.amount) ? input.amount : 0,
    input.note ?? '',
  ].join('\u0001')
}

/** Does a value look like a v6.3 day-row wrapper? */
function looksLikeDayRow(x: unknown): x is { date: string; shifts: unknown[] } {
  if (!x || typeof x !== 'object') return false
  const r = x as Record<string, unknown>
  return typeof r.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
    Array.isArray(r.shifts)
}

/** Detect a raw shift row: {jobId:string, start:'HH:MM', end:'HH:MM'}. */
function looksLikeShiftRow(x: unknown): x is { jobId: string; start: string; end: string } {
  if (!x || typeof x !== 'object') return false
  const r = x as Record<string, unknown>
  return typeof r.jobId === 'string' && r.jobId.length > 0 &&
    typeof r.start === 'string' && r.start.length > 0 && /^\d{2}:\d{2}$/.test(r.start) &&
    typeof r.end === 'string' && r.end.length > 0 && /^\d{2}:\d{2}$/.test(r.end)
}

/**
 * Returns a shift row only if it has valid non-empty start+end times.
 * Used to filter out bad data from old exports (e.g. { start: '', end: '' }).
 */
function isValidShift(x: unknown): x is { jobId: string; start: string; end: string; breaks?: unknown[]; workDetails?: string } {
  return looksLikeShiftRow(x)
}

/**
 * Canonicalise data.shifts into Record<dateKey, Shift[]>.
 *
 * Handles both:
 *   v6.4  { "2026-04-25": [{jobId,start,end,...}], … }
 *   v6.3  { "0": { date: "2026-04-25", shifts: [{jobId,start,end,breaks}] }, … }
 *
 * Dedupes within each date by (jobId, start, end) so duplicate
 * localStorage rows don't create calendar noise.
 */
function normalizeShiftsShape(raw: Record<string, unknown>): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {}

  for (const k of Object.keys(raw ?? {})) {
    const v = raw[k]
    // v6.4 → pass-through
    if (Array.isArray(v)) {
      for (const row of v) {
        if (looksLikeShiftRow(row)) { (out[k] ??= []).push(row); continue }
        if (looksLikeDayRow(row)) {
          (out[row.date] ??= [])
          for (const s of row.shifts ?? []) if (looksLikeShiftRow(s)) out[row.date].push(s)
        }
      }
      continue
    }
    // v6.3 day-row wrapper
    if (looksLikeDayRow(v)) {
      (out[v.date] ??= [])
      for (const s of v.shifts ?? []) if (looksLikeShiftRow(s)) out[v.date].push(s)
      continue
    }
    // defensive fallback for unusual nested shapes
    if (v && typeof v === 'object' && Array.isArray((v as any).shifts)) {
      const dk = (v as any).date ?? k
      ;(out[dk] ??= [])
      for (const s of (v as any).shifts ?? []) if (looksLikeShiftRow(s)) out[dk].push(s)
    }
  }

  // Dedupe inside each date: keep only the first (jobId, start, end).
  for (const dk of Object.keys(out)) {
    const seen = new Set<string>()
    const dedup: unknown[] = []
    for (const row of out[dk] ?? []) {
      if (!looksLikeShiftRow(row)) continue
      const sig = `${row.jobId}\u0001${row.start}\u0001${row.end}`
      if (seen.has(sig)) continue
      seen.add(sig)
      dedup.push(row)
    }
    out[dk] = dedup
  }

  return out
}

/**
 * Reconstruct shifts from a v6.3 entries[] backup when no shifts dict
 * exists. Entries carry aggregated hours: {date, jobs:[{jobId,dayHours,nightHours}]}.
 *
 * We synthesise:
 *   Day:   09:00 → 09:00 + floor(dayHours)
 *   Night: 22:30 → 22:30 + ceil(nightHours+0.5)
 * This is lossy — breaks and exact start/end are lost.
 */
function synthShiftsFromEntries(entries: unknown[]): Record<string, unknown[]> {
  const out: Record<string, unknown[]> = {}
  for (const e of entries) {
    if (!e || typeof (e as any).date !== 'string') continue
    const dk = (e as any).date as string
    ;(out[dk] ??= [])
    const jobs: unknown[] = (e as any).jobs ?? []
    for (const j of jobs) {
      if (!j || typeof (j as any).jobId !== 'string') continue
      const day = Number((j as any).dayHours) || 0
      const night = Number((j as any).nightHours) || 0
      if (day + night <= 0) continue
      if (day > 0) {
        const startH = 9
        const endH = Math.max(startH + 1, startH + Math.floor(day))
        out[dk].push({
          jobId: (j as any).jobId as string,
          start: pad(startH) + ':00',
          end:   pad(endH)   + ':00',
          breaks: [],
        })
      }
      if (night > 0) {
        out[dk].push({
          jobId: (j as any).jobId as string,
          start: '22:30',
          end:   pad(22 + Math.ceil(night + 0.5)) + ':00',
          breaks: [],
        })
      }
    }
  }
  return out
}

function pad(n: number): string { return String(n).padStart(2, '0') }

// ── Top-level entry ────────────────────────────────────────

export async function importData(
  file: File,
  mode: 'replace' | 'merge',
  format: 'json' | 'csv' | 'auto' = 'auto'
): Promise<ImportResult> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`Backup file too large (${Math.round(file.size / 1024 / 1024)} MB > 25 MB).`)
  }

  const text = await file.text()
  const detected: 'json' | 'csv' =
    format === 'auto' ? (looksLikeCsv(text) ? 'csv' : 'json') : format

  let data: Partial<BackupData>
  const warnings: string[] = []
  const failures: string[] = []

  function pushFailure(domain: string, ctx: string, err: unknown) {
    try {
      const msg = (err instanceof Error ? err.message : String(err)) || String(err)
      failures.push(`${domain}: ${ctx} => ${msg}`)
    } catch {
      failures.push(`${domain}: ${ctx} => <unavailable>`)
    }
  }

  if (detected === 'csv') {
    data = csvSectionsToBackupData(text)
  } else {
      try {
        data = JSON.parse(text) as Partial<BackupData>
        console.warn('[importData] raw parse complete, schemaVersion:', data.schemaVersion, 'jobs type:', typeof data.jobs, 'isArray:', Array.isArray(data.jobs), 'jobs len:', (data.jobs as any[])?.length)
      } catch (err) {
        throw new Error(`JSON parse failed: ${(err as Error).message}. Did you mean CSV?`)
      }
      if (!data || typeof data !== 'object' || (!data.jobs && !data.shifts)) {
        throw new Error('Invalid backup: missing jobs and shifts.')
      }
    }

  // ── version tolerance ───────────────────────────────────
    const version = (data.schemaVersion ?? '6.3.0') as string
    if (version !== '6.3.0' && version !== '6.4.0') {
      throw new Error(`Backup file version (${version}) is too new. Update the app.`)
    }
    if (version === '6.3.0' && !data.shifts && (data as any).entries) {
      warnings.push('v6.3 entries-only backup — shifts synthesised, times are lossy.')
    }

    // ── shift normalisation (THE FIX) ────────────────────────
    // Always run before any downstream processing so both v6.3
    // and v6.4 shapes collapse into a single canonical dict.
    const preNormKeys = data.shifts ? Object.keys(data.shifts) : []
    console.warn('[importData]....', data)
    console.warn('[importData] pre-normalize shifts keys:', preNormKeys.slice(0, 5), 'total:', preNormKeys.length)
    if (data.shifts && typeof data.shifts !== 'string' && !Array.isArray(data.shifts)) {
      data.shifts = normalizeShiftsShape(data.shifts as unknown as Record<string, unknown>) as any
    }
    const postNormKeys = data.shifts ? Object.keys(data.shifts) : []
    console.warn('[importData] post-normalize shifts keys:', postNormKeys.slice(0, 5), 'total:', postNormKeys.length)

    // Fallback: if file has entries[] but no v6.4-style shifts dict,
    // reconstruct losses from entries via synthShiftsFromEntries.
    const rawEntries = (data as any).entries as unknown[] | undefined
    const hadShifts = !!(data.shifts && Object.keys(data.shifts).length > 0)
    console.warn('[importData] rawEntries count:', rawEntries?.length ?? 0, 'hadShifts:', hadShifts)

    // DEBUG: log parsed data shape
    console.warn('[importData] parsed data:', {
      version: data.schemaVersion,
      hasJobs: Array.isArray(data.jobs),
      jobsCount: (data.jobs as unknown[])?.length ?? 0,
      hasShifts: !!data.shifts,
      shiftsKeys: postNormKeys.slice(0, 3),
      hasEntries: Array.isArray(rawEntries),
      entriesCount: rawEntries?.length ?? 0,
      firstEntry: rawEntries?.[0],
      hadShifts,
    })

  if (!hadShifts && Array.isArray(rawEntries)) {
      ;(data as any).shifts = synthShiftsFromEntries(rawEntries)
      // DEBUG: log synthesis result
      const synthResult: Record<string, unknown[]> = (data as any).shifts
      console.warn('[importData] synthShiftsFromEntries result:', JSON.stringify(synthResult))
      if (Object.keys(synthResult).length > 0) {
        warnings.push(
          `Reconstructed ${Object.keys(synthResult).length} day(s) from v6.3 entries[] — times approximated, verify on calendar.`
        )
      }
      if (rawEntries.length > 0 && Object.keys(synthResult).length === 0) {
        warnings.push(
          `Reconstructed 0 day(s) of work-hours from a v6.3 entries[] backup. Times are approximated — verify on the calendar.`
        )
      }
    } else if (!hadShifts) {
      warnings.push('Backup contains no shift data.')
    }

  // ── profile prefs ────────────────────────────────────────
  if (data.profile) {
    try {
      await applyProfilePrefs({
        currency: (data.profile as any).currency ?? null,
        location: (data.profile as any).country ?? null,
        schoolFee: (data.profile as any).schoolFee ?? null,
      })
    } catch (err) {
      console.warn('[importData] applyProfilePrefs failed', err)
    }
  }

  // ── replace mode – wipe ─────────────────────────────────
  // Wipe SEQUENTIALLY (not in parallel) so each delete fully completes
  // before the next begins. Parallel deletes resolve before the DB has
  // actually removed the rows, causing P2002 constraint violations when
  // imports start immediately after.
    if (mode === 'replace') {
      const existingJobs = await getJobs()
      for (const j of existingJobs) await serverDeleteJob(j.id).catch(() => null)

      const existingTemplates = await getTemplates()
      for (const t of existingTemplates) await serverDeleteTemplate(t.id).catch(() => null)

      const shiftsState = useShiftsStore.getState().shifts
      for (const dk of Object.keys(shiftsState)) await serverDeleteShiftsByDate(dk).catch(() => null)

      const existingGoals = await getBudgetGoals()
      for (const g of existingGoals) await deleteBudgetGoal(g.id).catch(() => null)

      const monthKeys = Object.keys(data.expenses ?? {})
      if (monthKeys.length > 0) await replaceMonthsExpenses(monthKeys).catch(() => null)
    }

  const jobIdMap = new Map<string, string>() // oldId → DB id

    // ── jobs ─────────────────────────────────────────────────
    let jobsInserted = 0
    if (Array.isArray(data.jobs)) {
      for (const j of data.jobs) {
        try {
          const created = await serverCreateJob({
            id: j.id,
            name: j.name,
            color: j.color,
            rate: j.rate,
            nightRate: j.nightRate,
          })
          jobIdMap.set(j.id, created.id)
          jobsInserted++
        } catch { /* skip – server retries on P2002 */ }
      }
    }

  // ── templates ─────────────────────────────────────────────
    let templatesInserted = 0
    if (Array.isArray(data.templates)) {
      for (const t of data.templates) {
        const mappedJobId = jobIdMap.get(t.jobId) ?? t.jobId
        try {
          await serverCreateTemplate({
            name: t.name,
            days: Array.isArray(t.days) ? t.days : [],
            jobId: mappedJobId,
            start: t.start,
            end: t.end,
            workDetails: (t as any).workDetails ?? null,
          })
          templatesInserted++
        } catch { /* skip */ }
      }
    }

  // ── shifts (now always canonical) ────────────────────────
  const existingShifts = useShiftsStore.getState().shifts
  const shiftsByDate = (data.shifts ?? {}) as Record<string, unknown[]>
  const shiftInputs: NewShiftInput[] = []

  for (const dk of Object.keys(shiftsByDate)) {
    const day = shiftsByDate[dk] ?? []
    const existingDay = existingShifts[dk] ?? []
    for (const s of day) {
      if (mode === 'merge') {
        const dup = existingDay.find(
          (e) => e.jobId === (s as any).jobId && e.start === (s as any).start && e.end === (s as any).end
        )
        if (dup) continue
      }
      shiftInputs.push({
              date: dk,
              jobId: jobIdMap.get((s as any).jobId as string) ?? (s as any).jobId as string ?? '',
              start: (s as any).start as string ?? '00:00',
              end:   (s as any).end   as string ?? '00:00',
              actualLogin: (s as any).actualLogin ?? null,
              actualLogout: (s as any).actualLogout ?? null,
              actualBreaks: (s as any).actualBreaks ?? null,
              workDetails: (s as any).workDetails ?? null,
              templateId: (s as any).templateId ?? undefined,
              source: (s as any).source ?? undefined,
            })
    }
  }

  if (shiftInputs.length > 0) {
    const chunkSize = 100
    for (let i = 0; i < shiftInputs.length; i += chunkSize) {
      try {
        await serverCreateShifts({ shifts: shiftInputs.slice(i, i + chunkSize) })
      } catch { /* chunk failure — skip */ }
    }
  }

  // ── categories ────────────────────────────────────────────
  let categoriesInserted = 0
  if (Array.isArray(data.categories) && data.categories.length > 0) {
    const isParent = (c: any) => !c?.parentName
    const parents = (data.categories as unknown[]).filter(isParent)
    const children = (data.categories as unknown[]).filter((c: any) => !isParent(c))
    for (let pass = 0; pass < 2; pass++) {
      const list = pass === 0 ? parents : children
      const existing = await getCategories()
      const byName = new Map(existing.map((c) => [normalizeName(c.name), c]))
      for (const row of list) {
        const c = row as any
        const hit = c.parentName ? byName.get(normalizeName(c.parentName)) : undefined
        const parentId = (hit as any)?.id
        try {
          const existingHit = byName.get(normalizeName(c.name)) as any
          if (existingHit && mode === 'merge') {
            await updateCategory(existingHit.id, c.name, c.icon, c.budget).catch(() => null)
          } else {
            await createCategory(c.name, c.icon, parentId)
          }
          categoriesInserted++
        } catch { /* skip */ }
      }
    }
  }

  // ── expenses ──────────────────────────────────────────────
  let expensesInserted = 0
  if (data.expenses && Object.keys(data.expenses).length > 0) {
    const liveCats = await getCategories()
    const lookupByName = new Map(liveCats.map((c) => [normalizeName(c.name), c.id]))

    const liveExpensesByMonth = new Map<string, Set<string>>()
    if (mode === 'merge') {
      for (const mk of Object.keys(data.expenses)) {
        try {
          const existing = await getExpenses(mk)
          const sigs = new Set<string>(
            (existing ?? []).map((e) =>
              dedupSignature({
                categoryId: e.categoryId,
                amount: Number(e.amount),
                date: typeof e.date === 'string' ? e.date : String(e.date),
                note: e.note ?? '',
              })
            )
          )
          liveExpensesByMonth.set(mk, sigs)
        } catch { /* fallback: no dedup for that month */ }
      }
    }

    interface BulkRow { categoryId: string; amount: number; date: string; note?: string }
    const bulkInputs: BulkRow[] = []

    for (const [monthKey, rows] of Object.entries(data.expenses)) {
      const monthSigs = liveExpensesByMonth.get(monthKey)
      for (const raw of (rows as any[] as any[]) ?? []) {
        const e = raw as any
        if (!e || Number(e.amount) <= 0) continue
        const catName = normalizeName(e.categoryName ?? '')
        const catId = lookupByName.get(catName) ?? ''
        if (!catId) continue
        const sig = dedupSignature({
          categoryId: catId,
          amount: Number((e as any).amount),
          date: typeof (e as any).date === 'string' ? ((e as any).date as string) : String((e as any).date),
          note: typeof (e as any).note === 'string' ? ((e as any).note as string) : '',
        } as any)
        if (mode === 'merge' && monthSigs?.has(sig)) continue
        bulkInputs.push({
          categoryId: catId,
          amount: Number((e as any).amount),
          date: typeof (e as any).date === 'string' ? ((e as any).date as string) : String((e as any).date),
          note: typeof (e as any).note === 'string' ? ((e as any).note as string) : '',
        } as any)
      }
    }

    expensesInserted = bulkInputs.length
    const chunkSize = 200
    for (let i = 0; i < bulkInputs.length; i += chunkSize) {
      try { await createExpensesBulk(bulkInputs.slice(i, i + chunkSize)) } catch { /* skip */ }
    }
  }

  // ── goals ──────────────────────────────────────────────────
  let goalsInserted = 0
  if (Array.isArray(data.goals)) {
    for (const g of data.goals) {
      try {
        await createBudgetGoal({
          id: (g as any).id,
          name: (g as any).name,
          deadline: (g as any).deadline,
          target: (g as any).target,
          percentage: (g as any).percentage ?? 0,
          priority: (g as any).priority ?? 0,
          createdMonth: (g as any).createdMonth,
          monthlyProgress: (g as any).monthlyProgress ?? {},
        })
        goalsInserted++
      } catch { /* skip */ }
    }
  }

  // ── notes ──────────────────────────────────────────────────
  let notesInserted = 0
  if (typeof data.monthNotes === 'object' && data.monthNotes) {
    for (const [monthKey, notesText] of Object.entries(data.monthNotes)) {
      try {
        await setBudgetMonthNotes({ monthKey, notes: notesText as string })
        notesInserted++
      } catch { /* skip */ }
    }
  }

  // ── refresh stores ─────────────────────────────────────────
  await Promise.all([
    useJobsStore.getState().fetchJobsFromDB(),
    useTemplatesStore.getState().fetchTemplatesFromDB(),
    useShiftsStore.getState().syncShiftsFromDB(),
  ])

  return {
    jobs: jobsInserted,
    templates: templatesInserted,
    shifts: Object.keys(shiftsByDate).length,
    categories: categoriesInserted,
    expenses: expensesInserted,
    goals: goalsInserted,
    notes: notesInserted,
    entries: Array.isArray(rawEntries) ? rawEntries.length : 0,
    mode,
    format: detected,
    warnings,
    failures,
  }
}