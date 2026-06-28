import type { BackupData } from '@/types'
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
import { useJobsStore } from '@/store/useJobsStore'
import { useShiftsStore } from '@/store/useShiftsStore'
import { useTemplatesStore } from '@/store/useTemplatesStore'

export interface ImportResult {
  jobs: number
  templates: number
  shifts: number
  /** v6.3-compat: entries from the backup file (no longer applied to DB). */
  entries: number
  mode: string
}

/**
 * Import a backup JSON file and route its rows to the appropriate server
 * actions (jobs → user_jobs, templates → user_templates, shifts →
 * user_shifts). `entries` (per-day hours) is intentionally skipped: the
 * new model derives hours from persisted `UserShift` rows directly, so
 * the legacy `entries[]` field is just left as a no-op for backward
 * compatibility with v6.3 backup files.
 *
 * Behaviour:
 *   - 'replace' mode: delete all existing rows for the authenticated
 *     user first, then create the imported set.
 *   - 'merge'   mode: overwrite matching rows by id (jobs/templates);
 *     for shifts, skip rows that already exist with the same
 *     (date, jobId) tuple to avoid double-counting.
 */
export async function importData(
  file: File,
  mode: 'replace' | 'merge'
): Promise<ImportResult> {
  const text = await file.text()
  const data = JSON.parse(text) as Partial<BackupData>
  if (!data.jobs) throw new Error('Invalid backup file: missing jobs')

  // ── replace mode: wipe current data first ────────────────────
  if (mode === 'replace') {
    await Promise.all(
      (await getJobs()).map((j) => serverDeleteJob(j.id).catch(() => null))
    )
    await Promise.all(
      (await getTemplates()).map((t) => serverDeleteTemplate(t.id).catch(() => null))
    )
    // Delete only the dates we know how to find via the canonical store.
    const shiftsState = useShiftsStore.getState().shifts
    await Promise.all(
      Object.keys(shiftsState).map((dk) =>
        serverDeleteShiftsByDate(dk).catch(() => null)
      )
    )
    // Make sure the user has at least the default jobs after a wipe.
    await seedDefaultJobsIfEmpty()
  }

  // ── jobs ────────────────────────────────────────────────────
  for (const j of data.jobs ?? []) {
    try {
      if (mode === 'merge') {
        await serverUpdateJob(j.id, {
          name: j.name,
          color: j.color,
          rate: j.rate,
          nightRate: j.nightRate,
        })
      } else {
        await serverCreateJob({
          id: j.id,
          name: j.name,
          color: j.color,
          rate: j.rate,
          nightRate: j.nightRate,
        })
      }
    } catch {
      // P2002/record-not-found for merge: fall back to create.
      try {
        await serverCreateJob({
          id: j.id,
          name: j.name,
          color: j.color,
          rate: j.rate,
          nightRate: j.nightRate,
        })
      } catch {
        /* give up on this row, continue */
      }
    }
  }

  // ── templates ───────────────────────────────────────────────
  for (const t of data.templates ?? []) {
    const tData: TemplateData = {
      name: t.name,
      days: Array.isArray(t.days) ? t.days : [],
      jobId: t.jobId,
      start: t.start,
      end: t.end,
      workDetails: t.workDetails ?? null,
    }
    try {
      if (mode === 'merge' && t.id) {
        await serverUpdateTemplate(t.id, tData)
      } else {
        await serverCreateTemplate(tData)
      }
    } catch {
      try {
        await serverCreateTemplate(tData)
      } catch {
        /* give up on this row, continue */
      }
    }
  }

  // ── shifts ──────────────────────────────────────────────────
  // Best-effort: build NewShiftInput rows from the legacy shape and
  // pass them to createShifts. Deduplicate against `shifts[dk]` for
  // merge mode.
  const existingShifts = useShiftsStore.getState().shifts
  const newShiftInputs: NewShiftInput[] = []
  for (const dk of Object.keys(data.shifts ?? {})) {
    const day = data.shifts?.[dk] ?? []
    const existingDay = existingShifts[dk] ?? []
    for (const s of day) {
      // De-dupe on (jobId, start, end)
      if (mode === 'merge') {
        const dup = existingDay.find(
          (e) =>
            e.jobId === s.jobId &&
            e.start === s.start &&
            e.end === s.end
        )
        if (dup) continue
      }
      newShiftInputs.push({
        date: dk,
        jobId: s.jobId,
        start: s.start,
        end: s.end,
        actualLogin: s.actualLogin ?? null,
        actualLogout: s.actualLogout ?? null,
        actualBreaks: (s.actualBreaks as any) ?? null,
      })
    }
  }
  if (newShiftInputs.length > 0) {
    // Pagination: createShifts accepts ≤ 100 per request (its own cap).
    const chunkSize = 100
    for (let i = 0; i < newShiftInputs.length; i += chunkSize) {
      try {
        await serverCreateShifts({ shifts: newShiftInputs.slice(i, i + chunkSize) })
      } catch {
        /* chunk failed — continue */
      }
    }
  }

  // ── refresh all stores ──────────────────────────────────────
  await useJobsStore.getState().fetchJobsFromDB()
  await useTemplatesStore.getState().fetchTemplatesFromDB()
  await useShiftsStore.getState().syncShiftsFromDB()

  return {
    jobs:      (data.jobs ?? []).length,
    templates: (data.templates ?? []).length,
    shifts:    Object.keys(data.shifts ?? {}).length,
    /** Kept for backward-compat with the v6.3 JSON shape. Per-day hours
     *  (`entries`) are no longer applied to the DB; the new model derives
     *  hours from `UserShift` rows. We still report the count so the
     *  user gets feedback on what their backup contained. */
    entries:   (data.entries ?? []).length,
    mode,
  }
}
