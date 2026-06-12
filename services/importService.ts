import type { BackupData } from '@/types'
import { saveJobs, saveShifts, saveTemplates, setDayHours, clearDayHours } from './storage'
import { CONFIG } from '@/lib/constants'
import { dateKey } from '@/lib/dateUtils'

export interface ImportResult {
  jobs: number; entries: number; shifts: number; templates: number; mode: string
}

export async function importData(file: File, mode: 'replace' | 'merge'): Promise<ImportResult> {
  const text = await file.text()
  const data: BackupData = JSON.parse(text)
  if (!data.jobs || !data.entries) throw new Error('Invalid backup file: missing jobs or entries')

  if (mode === 'replace') {
    for (let mo = 0; mo < CONFIG.TOTAL_MONTHS; mo++) {
      const rawM = CONFIG.START_MONTH + mo
      const y = CONFIG.START_YEAR + Math.floor(rawM / 12)
      const m = ((rawM % 12) + 12) % 12
      const days = new Date(y, m + 1, 0).getDate()
      for (let d = 1; d <= days; d++) {
        clearDayHours(dateKey(y, m, d), data.jobs.map(j => j.id))
      }
    }
    saveJobs([]); saveShifts({}); saveTemplates([])
  }

  saveJobs(data.jobs)
  for (const e of data.entries) {
    for (const je of e.jobs) {
      setDayHours(e.date, je.jobId, je.dayHours + je.nightHours, je.nightHours)
    }
  }
  if (data.shifts)    saveShifts(data.shifts)
  if (data.templates) saveTemplates(data.templates)

  return {
    jobs: data.jobs.length, entries: data.entries.length,
    shifts: Object.keys(data.shifts || {}).length,
    templates: (data.templates || []).length, mode,
  }
}
