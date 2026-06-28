import type { BackupData } from '@/types'
import { csvSectionsToBackupData } from '@/lib/csv'
import {
  getJobs,
  createJob as serverCreateJob,
  updateJob as serverUpdateJob,
  deleteJob as serverDeleteJob,
  seedDefaultJobsIfEmpty,
} from '@/app/actions/jobs'
import {
  getTemplates,
  createTemplate as serverCreateTemplate,
  updateTemplate as serverUpdateTemplate,
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
  createCategory,
  updateCategory,
  replaceMonthsExpenses,
  createExpensesBulk,
} from '@/app/actions/expenses'
import {
  createBudgetGoal,
  updateBudgetGoal,
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

    if ((data.jobs?.length ?? 0) === 0) {
      await seedDefaultJobsIfEmpty()
    }
  }

  // ── jobs ────────────────────────────────────────────────
  let jobsInserted = 0
  for (const j of data.jobs ?? []) {
    try {
      if (mode === 'merge') {
        await serverUpdateJob(j.id, {
          name: j.name,
          color: j.color,
          rate: j.rate,
          nightRate: j.nightRate,
        })
        await serverCreateJob({
          id: j.id,
          name: j.name,
          color: j.color,
          rate: j.rate,
          nightRate: j.nightRate,
        }).catch(() => null)
      } else {
        await serverCreateJob({
          id: j.id,
          name: j.name,
          color: j.color,
          rate: j.rate,
          nightRate: j.nightRate,
        })
      }
      jobsInserted++
    } catch {
      // skip
    }
  }

  // ── templates ────────────────────────────────────────────
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
      if (mode === 'merge' && t.id) {
        await serverUpdateTemplate(t.id, tData)
        await serverCreateTemplate(tData)
      } else {
        await serverCreateTemplate(tData)
      }
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
      const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]))
      for (const c of list) {
        const parentName = (c as any).parentName as string | undefined
        let parentId: string | undefined
        if (parentName) {
          parentId = byName.get(parentName.trim().toLowerCase())?.id
        }
        try {
          const existingHit = byName.get(c.name.trim().toLowerCase())
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
      liveCats.map((c) => [c.name.trim().toLowerCase(), c.id])
    )

    const bulkInputs: Array<{
      categoryId: string
      subcategoryId?: string | null
      amount: number
      date: string
      note?: string
    }> = []

    for (const [, rows] of Object.entries(data.expenses)) {
      for (const e of rows ?? []) {
        if (!e || e.amount <= 0) continue
        const catName = ((e as any).categoryName ?? '').trim().toLowerCase()
        const catId = lookupByName.get(catName) ?? ''
        if (!catId) continue
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
  let goalsInserted = 0
  if (data.goals?.length) {
    const existingGoals = await getBudgetGoals()
    const byId = new Map(existingGoals.map((g) => [g.id, g]))
    for (const g of data.goals) {
      try {
        if (mode === 'merge' && byId.has(g.id)) {
          // Update with full payload so updates hit priority/percentage/etc.
          await updateBudgetGoal(g.id, {
            name: g.name,
            deadline: g.deadline,
            target: g.target,
            percentage: g.percentage ?? 0,
            priority: g.priority ?? 0,
            monthlyProgress: g.monthlyProgress,
          })
        } else {
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
        }
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
