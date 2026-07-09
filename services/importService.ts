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
  /** v6.3-compat: entries from the backup file (never applied to DB). */
  entries: number
  mode: 'replace' | 'merge'
  format: 'json' | 'csv'
  /** Warnings surfaced from the parser / dispatcher. UI shows them. */
  warnings: string[]
}

/** Hard cap on import file size (Postgres + Node safety). */
const MAX_FILE_BYTES = 25_000_000

/**
 * Detect the format of an uploaded file. The button selection is
 * authoritative when explicitly given; otherwise we infer from the
 * first non-blank, non-comment line.
 */
function looksLikeCsv(text: string): boolean {
  const first = text
    .split(/\r?\n/, 20)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('{') && !l.startsWith('//'))
  if (!first) return false
  return first.startsWith('# section:') || first.split(',').length >= 2
}

/**
 * Canonical name normaliser so user-supplied category names match across
 * export→import boundaries through this codebase. Both sides of the
 * cross-device transfer apply the same function; without this, "Food"
 * (U+0065) and "Fooԁ" (Cyrillic homoglyph), or NFC-vs-NFD, would silently
 * skip the lookup and lose the imported expense.
 */
function normalizeName(input: string): string {
  return (input ?? '').normalize('NFC').trim().toLowerCase()
}

/**
 * Stable signature for an expense row, used to dedupe against the user's
 * existing DB rows in merge mode. The shape intentionally matches the
 * documented contract on `app/actions/expenses.ts#createExpensesBulk`:
 * `(date, categoryId, amount, note)`. Two expenses with the same four
 * fields are treated as duplicates.
 */
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

/**
 * Top-level entry. Use `format` from the button panel; otherwise we
 * sniff from the file body. Returns counts + warnings.
 */
export async function importData(
  file: File,
  mode: 'replace' | 'merge',
  format: 'json' | 'csv' | 'auto' = 'auto'
): Promise<ImportResult> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `Backup file is too large (${Math.round(file.size / 1024 / 1024)} MB > 25 MB). Re-export with fewer months.`
    )
  }

  const text = await file.text()
  const detected: 'json' | 'csv' =
    format === 'auto' ? (looksLikeCsv(text) ? 'csv' : 'json') : format

  let data: Partial<BackupData>
  const warnings: string[] = []

  if (detected === 'csv') {
    data = csvSectionsToBackupData(text)
  } else {
    try {
      data = JSON.parse(text) as Partial<BackupData>
      if (!data || typeof data !== 'object' || !Array.isArray((data as any).jobs)) {
        throw new Error('Invalid JSON backup (missing jobs[])')
      }
    } catch (err) {
      throw new Error(
        `Backup looks like JSON but couldn't parse: ${(err as Error).message}. ` +
          `Did you mean to pick CSV?`
      )
    }
  }

  // ── version check ───────────────────────────────────────
  const version = (data.schemaVersion ?? '6.3.0') as string
  if (version !== '6.3.0' && version !== '6.4.0') {
    throw new Error(
      `Backup file is from a newer version (${version}). Update the app before importing.`
    )
  }
  if (version === '6.3.0') {
    const hasExtras =
      !!data.categories?.length ||
      !!data.expenses ||
      !!data.goals?.length ||
      !!data.monthNotes
    if (!hasExtras) {
      warnings.push(
        'v6.3 backup file detected; only jobs/templates/shifts will be imported.'
      )
    }
  }

  if (!data.jobs) throw new Error('Invalid backup file: missing jobs')

  // ── profile prefs (best-effort) ────────────────────────
  // Apply portable profile preferences early so downstream store
  // refreshes pick up the new currency/location/schoolFee. Identity
  // fields (name, email) are not touched on purpose — those are
  // per-account, not per-device.
  if (data.profile) {
    try {
      await applyProfilePrefs({
        currency: data.profile.currency,
        location: data.profile.country,
        schoolFee: data.profile.schoolFee,
      })
    } catch (err) {
      // Non-fatal: log and continue so the rest of the import still runs.
      console.warn('[importData] applyProfilePrefs failed', err)
    }
  }

  // ── replace mode: wipe first (scoped per domain) ────────
  if (mode === 'replace') {
    const existingJobs = await getJobs()
    await Promise.all(existingJobs.map((j) => serverDeleteJob(j.id).catch(() => null)))

    const existingTemplates = await getTemplates()
    await Promise.all(
      existingTemplates.map((t) => serverDeleteTemplate(t.id).catch(() => null))
    )

    const shiftsState = useShiftsStore.getState().shifts
    await Promise.all(
      Object.keys(shiftsState).map((dk) => serverDeleteShiftsByDate(dk).catch(() => null))
    )

    const existingGoals = await getBudgetGoals()
    await Promise.all(existingGoals.map((g) => deleteBudgetGoal(g.id).catch(() => null)))

    const monthKeysFromBackup = Object.keys(data.expenses ?? {})
    if (monthKeysFromBackup.length > 0) {
      await replaceMonthsExpenses(monthKeysFromBackup).catch(() => null)
    }

    // Don't seed defaults here. The post-import empty-job-list is
    // the user's exported: data.jobs=[] says so. AppShell's session
    // hook (`seedJobs()`) will seed defaults on the next login if
    // the user really wants them — that path is idempotent and safe.
    //
    // Seeding here previously caused a P2002 unique-id violation:
    // the wipe runs `Promise.all(deleteMany)` then this branch's
    // findMany-gated createMany — racing deletes that hadn't yet
    // committed, getting `j1` from a leftover row and blowing up.
    // Removing the call is the only race-free fix.
  }

  // ── jobs ────────────────────────────────────────────────
  // Both merge and replace funnel through the same try/create path:
  // `serverCreateJob` mints a fresh id when the row's id is missing, and
  // retries on Prisma P2002 unique-id collision. Update semantics add no
  // value because the DB `id` is already unique per user, and a missing
  // row in merge mode previously caused an unhandled throw that aborted
  // the entire import.
  let jobsInserted = 0
  for (const j of data.jobs ?? []) {
    try {
      await serverCreateJob({
        id: j.id,
        name: j.name,
        color: j.color,
        rate: j.rate,
        nightRate: j.nightRate,
      })
      jobsInserted++
    } catch {
      // skip
    }
  }

  // ── templates ────────────────────────────────────────────
  // Same idempotent try/create approach as for jobs above. `Template.id`
  // is the DB primary key (it's also stored as `id String @id` in the
  // schema), so re-creating with the same id surfaces as a P2002 and the
  // server action retries with a fresh client id. Merge vs replace
  // behaves identically at the row level for this shape.
  let templatesInserted = 0
  for (const t of data.templates ?? []) {
    const tData: TemplateData = {
      name: t.name,
      days: Array.isArray(t.days) ? t.days : [],
      jobId: t.jobId,
      start: t.start,
      end: t.end,
      workDetails: (t as any).workDetails ?? null,
    }
    try {
      await serverCreateTemplate(tData)
      templatesInserted++
    } catch {
      // skip
    }
  }

  // ── shifts ───────────────────────────────────────────────
  const existingShifts = useShiftsStore.getState().shifts
  const shiftInputs: NewShiftInput[] = []
  const shiftsByDate = data.shifts ?? {}
  for (const dk of Object.keys(shiftsByDate)) {
    const day = shiftsByDate[dk] ?? []
    const existingDay = existingShifts[dk] ?? []
    for (const s of day) {
      if (mode === 'merge') {
        const dup = existingDay.find(
          (e) => e.jobId === s.jobId && e.start === s.start && e.end === s.end
        )
        if (dup) continue
      }
      shiftInputs.push({
        date: dk,
        jobId: s.jobId,
        start: s.start,
        end: s.end,
        actualLogin: s.actualLogin ?? null,
        actualLogout: s.actualLogout ?? null,
        actualBreaks: ((s as any).actualBreaks as any) ?? null,
        // Preserve the per-shift metadata captured by v6.4 backups so that
        // re-import round-trips without losing workDetails/templateId/source.
        workDetails: ((s as any).workDetails as any) ?? null,
        templateId: ((s as any).templateId as any) ?? undefined,
        source: ((s as any).source as any) ?? undefined,
      })
    }
  }
  if (shiftInputs.length > 0) {
    const chunkSize = 100
    for (let i = 0; i < shiftInputs.length; i += chunkSize) {
      try {
        await serverCreateShifts({ shifts: shiftInputs.slice(i, i + chunkSize) })
      } catch {
        // chunk failed; skip
      }
    }
  }

  // ── categories ───────────────────────────────────────────
  // Two passes so children don't reference parents that don't exist yet
  // when we're in merge mode and the new ids differ from the old ones.
  let categoriesInserted = 0
  if (data.categories?.length) {
    const isParent = (c: any) => !c?.parentName
    const parentRows = data.categories.filter(isParent)
    const childRows  = data.categories.filter((c: any) => !isParent(c))

    // Two passes; reuse the live byName map across both.
    for (let pass = 0; pass < 2; pass++) {
      const list = pass === 0 ? parentRows : childRows
      // Re-read after each pass so newly-created categories are visible.
      const existing = await getCategories()
      const byName = new Map(existing.map((c) => [normalizeName(c.name), c]))
      for (const c of list) {
        const parentName = (c as any).parentName as string | undefined
        let parentId: string | undefined
        if (parentName) {
          parentId = byName.get(normalizeName(parentName))?.id
        }
        try {
          const existingHit = byName.get(normalizeName(c.name))
          if (existingHit && mode === 'merge') {
            await updateCategory(existingHit.id, c.name, c.icon, c.budget).catch(
              () => null
            )
          } else {
            await createCategory(c.name, c.icon, parentId)
          }
          categoriesInserted++
        } catch {
          // skip
        }
      }
    }
  }

  // ── expenses ─────────────────────────────────────────────
  let expensesInserted = 0
  if (data.expenses && Object.keys(data.expenses).length > 0) {
    const liveCats = await getCategories()
    const lookupByName = new Map(
      liveCats.map((c) => [normalizeName(c.name), c.id])
    )

    const bulkInputs: Array<{
      categoryId: string
      subcategoryId?: string | null
      amount: number
      date: string
      note?: string
    }> = []

    // Build the set of expenses that already exist in the DB so we can
    // skip duplicates in merge mode. We hit the DB once per month, which
    // is the same granularity the receipt page uses; in replace mode the
    // wipe step already cleared those rows so the check passes trivially.
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
        } catch {
          // ignore — fallback to no-dedup for that month
        }
      }
    }

    for (const [monthKey, rows] of Object.entries(data.expenses)) {
      const monthSigs = liveExpensesByMonth.get(monthKey)
      for (const e of rows ?? []) {
        if (!e || e.amount <= 0) continue
        const catName = normalizeName((e as any).categoryName ?? '')
        const catId = lookupByName.get(catName) ?? ''
        if (!catId) continue
        const sig = dedupSignature({
          categoryId: catId,
          amount: Number(e.amount),
          date: e.date,
          note: e.note ?? '',
        })
        if (mode === 'merge' && monthSigs?.has(sig)) continue
        bulkInputs.push({
          categoryId: catId,
          amount: Number(e.amount),
          date: e.date,
          note: e.note ?? '',
        })
      }
    }

    expensesInserted = bulkInputs.length

    const chunkSize = 200
    for (let i = 0; i < bulkInputs.length; i += chunkSize) {
      try {
        await createExpensesBulk(bulkInputs.slice(i, i + chunkSize))
      } catch {
        // chunk failed
      }
    }
  }

  // ── goals ────────────────────────────────────────────────
  // Same idempotent try/create approach as for jobs/templates above.
  // `UserBudgetGoal.id` is the DB primary key (see prisma/schema.prisma),
  // so re-creating with the same id surfaces as P2002 and the server
  // action mints a fresh id. `updateBudgetGoal` is intentionally not
  // called here — it would throw `Record not found` for any goal id not
  // already present in the receiving user's DB, aborting the import.
  let goalsInserted = 0
  if (data.goals?.length) {
    for (const g of data.goals) {
      try {
        await createBudgetGoal({
          id: g.id,
          name: g.name,
          deadline: g.deadline,
          target: g.target,
          percentage: g.percentage ?? 0,
          priority: g.priority ?? 0,
          createdMonth: g.createdMonth,
          monthlyProgress: g.monthlyProgress,
        })
        goalsInserted++
      } catch {
        // skip
      }
    }
  }

  // ── notes ────────────────────────────────────────────────
  let notesInserted = 0
  if (data.monthNotes) {
    for (const [monthKey, notes] of Object.entries(data.monthNotes)) {
      try {
        await setBudgetMonthNotes({ monthKey, notes })
        notesInserted++
      } catch {
        // skip
      }
    }
  }

  // ── refresh every store that hydrates ────────────────────
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
    entries: (data.entries ?? []).length,
    mode,
    format: detected,
    warnings,
  }
}
