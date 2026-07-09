'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { exportData } from '@/services/exportService'
import { importData, type ImportResult } from '@/services/importService'

type PanelMode = 'export' | 'import'
type Format = 'json' | 'csv'

export default function BackupPanel() {
  const [mode, setMode] = useState<PanelMode | null>(null)
  const [format, setFormat] = useState<Format>('json')
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('merge')
  const [step, setStep] = useState<'format' | 'preview' | 'done'>('format')
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pickedFile, setPickedFile] = useState<File | null>(null)

  const close = () => { setMode(null); setStep('format'); setPreview(null); setPickedFile(null) }

  const handleExport = async () => {
    setLoading(true)
    try {
      await exportData(format)
      toast.success(`Backup exported as ${format.toUpperCase()}`)
      close()
    } catch (err) {
      toast.error((err as Error).message || 'Export failed')
    } finally {
      setLoading(false)
    }
  }

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 25_000_000) {
      toast.error('File too large (>25 MB)')
      e.target.value = ''
      return
    }
    setPickedFile(f)
    setFormat('auto' as Format) // let importer sniff
    setStep('preview')
    e.target.value = ''
  }

  const handleImport = async () => {
    if (!pickedFile) return
    setLoading(true)
    try {
      const result = await importData(pickedFile, importMode, 'auto')
      setPreview(result)
      setStep('done')
      toast.success(
        `Imported: ${result.jobs} jobs · ${result.templates} templates · ` +
        `${result.shifts} shifts · ${result.categories} categories · ` +
        `${result.expenses} expenses · ${result.goals} goals · ${result.notes} notes months`
      )
      if (result.warnings.length > 0) {
        toast.warning(result.warnings.join('; '))
      }
      if (result.failures && result.failures.length > 0) {
        // Cap at 5 to keep the toast readable — print the rest in a follow-up.
        const head = result.failures.slice(0, 5)
        const overflow = result.failures.length - head.length
        const suffix = overflow > 0 ? ` …and ${overflow} more` : ''
        toast.error(`Skipped (${result.failures.length}): ${head.join(' | ')}${suffix}`)
      }
    } catch (err) {
      toast.error((err as Error).message || 'Import failed')
      close()
    } finally {
      setLoading(false)
    }
  }

  // ── render ────────────────────────────────────────────────

  return (
    <section style={sectionStyle}>
      <div style={sectionTitle}>Data Management</div>

      <button onClick={() => { setMode('export'); setStep('format') }} style={actionBtn}>
        <span>📥</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Export Backup</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Download as JSON or CSV</div>
        </div>
      </button>

      <button onClick={() => { setMode('import'); setStep('format') }} style={actionBtn}>
        <span>📤</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Import Backup</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Restore from JSON or CSV</div>
        </div>
      </button>

      <input
        ref={fileRef}
        type="file"
        accept=".json,.csv"
        style={{ display: 'none' }}
        onChange={handleFilePick}
      />

      {/* ── Modal overlay ───────────────────────────────── */}
      {mode && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) close() }}
          style={overlayStyle}
        >
          <div style={sheetStyle}>
            <div style={headerStyle}>
              <span style={{ fontWeight: 700 }}>
                {mode === 'export' ? 'Export Backup' : 'Import Backup'}
              </span>
              <button onClick={close} style={closeBtn}>✕</button>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: '60vh' }}>
              {mode === 'export' && step === 'format' && (
                <>
                  <div style={label}>Choose format</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {(['json', 'csv'] as Format[]).map((f) => (
                      <div
                        key={f}
                        onClick={() => setFormat(f)}
                        style={{
                          ...cardStyle,
                          borderColor: format === f ? 'var(--accent)' : 'var(--border)',
                          background: format === f ? 'rgba(59,130,246,0.08)' : 'var(--card)',
                        }}
                      >
                        <div style={{ fontSize: 20 }}>{f === 'json' ? '{ }' : '⊞'}</div>
                        <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                          {f.toUpperCase()}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                          {f === 'json' ? 'Full backup, every field' : 'Spreadsheet-friendly'}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleExport}
                    disabled={loading}
                    style={{ ...primaryBtn, marginTop: 16, width: '100%' }}
                  >
                    {loading ? 'Exporting…' : `Download ${format.toUpperCase()}`}
                  </button>
                </>
              )}

              {mode === 'import' && step === 'format' && (
                <>
                  <div style={label}>Choose a backup file</div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    style={{
                      ...primaryBtn,
                      width: '100%',
                      padding: '20px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>📂</span>
                    <span style={{ fontWeight: 800 }}>
                      Choose JSON or CSV backup
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>
                      Format is detected automatically from the file.
                    </span>
                  </button>
                </>
              )}

              {mode === 'import' && step === 'preview' && pickedFile && (
                <>
                  <div style={label}>Import mode</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {(['merge', 'replace'] as const).map((m) => (
                      <div
                        key={m}
                        onClick={() => setImportMode(m)}
                        style={{
                          ...cardStyle,
                          borderColor: importMode === m ? 'var(--accent)' : 'var(--border)',
                          background: importMode === m ? 'rgba(59,130,246,0.08)' : 'var(--card)',
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: 13 }}>
                          {m === 'replace' ? 'Replace' : 'Merge'}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                          {m === 'replace'
                            ? 'Wipe existing, then import'
                            : 'Keep existing, add new'}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 14, fontSize: 12, color: 'var(--muted)' }}>
                    <div>📄 {pickedFile.name} ({(pickedFile.size / 1024).toFixed(1)} KB)</div>
                    <div>📦 Format: {pickedFile.name.endsWith('.csv') ? 'CSV' : 'JSON'}</div>
                  </div>

                  {importMode === 'replace' && (
                    <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 11, color: 'var(--red)' }}>
                      ⚠️ Existing data will be replaced. Expenses & notes for months in this backup are scoped; jobs/goals are all-time.
                    </div>
                  )}

                  <button
                    onClick={handleImport}
                    disabled={loading}
                    style={{ ...primaryBtn, marginTop: 16, width: '100%' }}
                  >
                    {loading ? 'Importing…' : `Import (${importMode})`}
                  </button>
                </>
              )}

              {mode === 'import' && step === 'done' && preview && (
                <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--green)' }}>
                    ✅ Import complete
                  </div>
                  {[
                    ['Jobs', preview.jobs],
                    ['Templates', preview.templates],
                    ['Shifts', preview.shifts],
                    ['Categories', preview.categories],
                    ['Expenses', preview.expenses],
                    ['Goals', preview.goals],
                    ['Notes months', preview.notes],
                  ].map(([label, count]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{label}</span>
                      <span style={{ fontWeight: 600 }}>{count}</span>
                    </div>
                  ))}
                  {preview.warnings.length > 0 && (
                    <div style={{ marginTop: 8, padding: 6, background: 'rgba(234,179,8,0.08)', borderRadius: 4, fontSize: 10, color: 'var(--yellow)' }}>
                      {preview.warnings.join('; ')}
                    </div>
                  )}
                  <button onClick={close} style={{ ...primaryBtn, marginTop: 12, width: '100%' }}>
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--card)',
  borderRadius: 12, padding: 14, marginBottom: 12,
}
const sectionTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8,
}
const actionBtn: React.CSSProperties = {
  width: '100%', display: 'flex', gap: 10, alignItems: 'center',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border)',
  borderRadius: 10, padding: 12, marginBottom: 8,
  color: 'var(--text)', cursor: 'pointer', textAlign: 'left' as const,
}
const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.6)',
  zIndex: 960,
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
}
const sheetStyle: React.CSSProperties = {
  width: '100%', maxWidth: 480,
  background: 'var(--surface)',
  borderRadius: '20px 20px 0 0',
  maxHeight: '85vh',
  display: 'flex', flexDirection: 'column',
  animation: 'slideUp 250ms cubic-bezier(0.4,0,0.2,1)',
}
const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 20px',
  borderBottom: '1px solid var(--border)',
  fontSize: 16,
}
const closeBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'var(--muted)',
  fontSize: 18, cursor: 'pointer', padding: '4px 8px',
}
const label: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8,
}
const cardStyle: React.CSSProperties = {
  flex: 1, padding: '14px 10px',
  borderRadius: 10, border: '1px solid var(--border)',
  cursor: 'pointer', textAlign: 'center',
  transition: 'border-color 150ms',
}
const primaryBtn: React.CSSProperties = {
  background: 'var(--accent)', color: '#fff',
  border: 'none', borderRadius: 8, padding: '10px 16px',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
}