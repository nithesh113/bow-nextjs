import { fetchBackupBundle } from '@/app/actions/backup'

/**
 * v6.4 client-side Export. Server delivers a `BackupBundle`
 * (JSON shape + multi-table CSV), the browser picks one & triggers
 * a download.
 */
export async function exportData(format: 'json' | 'csv' = 'json'): Promise<void> {
  const { data, csvText } = await fetchBackupBundle()

  if (format === 'csv') {
    download(csvText, 'csv', data.exportedAt)
  } else {
    download(JSON.stringify(data, null, 2), 'json', data.exportedAt)
  }
}

function download(content: string, ext: 'json' | 'csv', exportedAt: string) {
  const mime = ext === 'csv' ? 'text/csv;charset=utf-8' : 'application/json'
  const date = (exportedAt ?? new Date().toISOString()).slice(0, 10)
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bow_backup_${date}-${ext === 'csv' ? 'v6_4' : 'v6_4'}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}
