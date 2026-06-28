import type { BackupData } from '@/types'
import { useJobsStore } from '@/store/useJobsStore'
import { useShiftsStore } from '@/store/useShiftsStore'
import { useTemplatesStore } from '@/store/useTemplatesStore'
import { CONFIG } from '@/lib/constants'

/**
 * Export a full backup of the user's DB-backed data as a JSON file.
 *
 * Read sources:
 *   - jobs      ← useJobsStore (mirrors `user_jobs`)
 *   - shifts    ← useShiftsStore (mirrors `user_shifts`)
 *   - templates ← useTemplatesStore (mirrors `user_templates`)
 *   - entries   ← derived per-(day, job) hour totals from the in-memory
 *                 `dayTotals` map, so the backup stays compatible with
 *                 the legacy v6.3 JSON schema older backups used.
 *
 * Imported by Topbar, SettingsView.
 */
export function exportData(): void {
  const jobs      = useJobsStore.getState().jobs
  const shifts    = useShiftsStore.getState().shifts
  const templates = useTemplatesStore.getState().templates
  const dayTotals = useShiftsStore.getState().dayTotals

  const entries: BackupData['entries'] = []
  for (let mo = 0; mo < CONFIG.TOTAL_MONTHS; mo++) {
    const rawM = CONFIG.START_MONTH + mo
    const y = CONFIG.START_YEAR + Math.floor(rawM / 12)
    const m = ((rawM % 12) + 12) % 12
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    for (let mo2 = 1; mo2 <= daysInMonth; mo2++) {
      const yyyy = y
      const mm = String(m + 1).padStart(2, '0')
      const dd = String(mo2).padStart(2, '0')
      const dk = `${yyyy}-${mm}-${dd}`

      const dayMap = dayTotals[dk]
      if (!dayMap) continue

      const jobEntries = jobs
        .map((j) => {
          const cell = dayMap[j.id]
          if (!cell || cell.total <= 0) return null
          const nightHours = cell.night
          const dayHours = Math.max(0, cell.total - cell.night)
          return { jobId: j.id, dayHours, nightHours }
        })
        .filter((e): e is { jobId: string; dayHours: number; nightHours: number } => e !== null)
      if (jobEntries.length === 0) continue

      const totalEarned = jobEntries.reduce((sum, e) => {
        const job = jobs.find((j) => j.id === e.jobId)
        if (!job) return sum
        const nightRate = job.nightRate || Math.round(job.rate * 1.25)
        return sum + e.dayHours * job.rate + e.nightHours * nightRate
      }, 0)

      entries.push({ date: dk, jobs: jobEntries, totalEarned: Math.round(totalEarned) })
    }
  }

  const backup: BackupData = {
    exportedAt: new Date().toISOString(),
    profile: {
      country: 'Japan',
      weeklyLimit: CONFIG.WEEKLY_HOUR_LIMIT,
      currency: CONFIG.CURRENCY,
    },
    jobs,
    entries,
    shifts,
    templates,
  }

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bow_backup_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
