import type { BackupData } from '@/types'
import { loadJobs, loadShifts, loadTemplates, getDayHours, getNightHours } from './storage'
import { dateKey } from '@/lib/dateUtils'
import { CONFIG } from '@/lib/constants'

export function exportData(): void {
  const jobs = loadJobs()
  const shifts = loadShifts()
  const templates = loadTemplates()
  const entries: BackupData['entries'] = []

  for (let mo = 0; mo < CONFIG.TOTAL_MONTHS; mo++) {
    const rawM = CONFIG.START_MONTH + mo
    const y = CONFIG.START_YEAR + Math.floor(rawM / 12)
    const m = ((rawM % 12) + 12) % 12
    const days = new Date(y, m + 1, 0).getDate()
    for (let d = 1; d <= days; d++) {
      const dk = dateKey(y, m, d)
      const jobEntries = jobs.map(j => ({
        jobId: j.id,
        dayHours:   Math.max(0, getDayHours(dk, j.id) - getNightHours(dk, j.id)),
        nightHours: getNightHours(dk, j.id),
      })).filter(e => e.dayHours + e.nightHours > 0)
      if (!jobEntries.length) continue
      const totalEarned = jobEntries.reduce((sum, e) => {
        const job = jobs.find(j => j.id === e.jobId)
        if (!job) return sum
        return sum + e.dayHours * job.rate + e.nightHours * (job.nightRate || Math.round(job.rate * 1.25))
      }, 0)
      entries.push({ date: dk, jobs: jobEntries, totalEarned: Math.round(totalEarned) })
    }
  }

  const backup: BackupData = {
    exportedAt: new Date().toISOString(),
    profile: { country: 'Japan', weeklyLimit: CONFIG.WEEKLY_HOUR_LIMIT, currency: CONFIG.CURRENCY },
    jobs, entries, shifts, templates,
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `bow_backup_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
