# BOW Import / Export — Porting Spec

## Overview

Port the import and export logic from the legacy HTML/CSS/JS version to the Next.js version. The new implementation lives in `services/importService.ts` and `services/exportService.ts` / `app/actions/backup.ts`. This document describes the current (correct) behaviour that must be preserved.

---

## Backup File Format

### JSON structure

```json
{
  "exportedAt": "2026-07-09T11:07:34.932Z",
  "schemaVersion": "6.3.0 | 6.4.0",
  "profile": {
    "country": "Japan",
    "weeklyLimit": 28,
    "currency": "JPY"
  },
  "jobs": [
    {
      "id": "nithesh_j1",
      "name": "McDonald's",
      "color": "#f59e0b",
      "rate": 1250,
      "nightRate": 1563
    }
  ],
  "shifts": {
    "2026-07-11": [
      {
        "jobId": "nithesh_j1",
        "start": "10:00",
        "end": "18:00",
        "breaks": [{ "start": "14:00", "end": "15:00" }]
      }
    ]
  },
  "templates": [
    {
      "id": "nithesh_tpl1",
      "name": "Weekend 1",
      "days": [5, 6],
      "jobId": "nithesh_j1",
      "start": "10:00",
      "end": "18:00"
    }
  ],
  "entries": [
    {
      "date": "2026-04-22",
      "jobs": [{ "jobId": "nithesh_j1", "dayHours": 7.2, "nightHours": 1.1 }],
      "totalEarned": 9021
    }
  ]
}
```

### Two schema versions

| Version | Shift storage | Migration path |
|---------|--------------|----------------|
| **6.3** | `entries[]` — aggregated daily hours per job (lossy) | `synthShiftsFromEntries()` converts to `shifts{}` dict on import |
| **6.4** | `shifts{}` — exact start/end/breaks per day per job (lossless) | No conversion needed |

**Critical mixed-format rule**: A backup may contain BOTH `entries[]` AND `shifts{}` (e.g. exported mid-transition). The `shifts{}` dict should take precedence. If `shifts{}` exists and has any keys, `entries[]` is **ignored** (not synthesised). If `shifts{}` is empty/missing, `entries[]` is synthesised into `shifts{}` format.

---

## Export

### What to export

All data for the authenticated user:

- `profile` — user preferences (country, weeklyLimit, currency)
- `jobs[]` — all job rows with their current IDs
- `shifts{}` — all shifts keyed by date `YYYY-MM-DD`, **not** `entries[]`
- `templates[]` — all template rows
- `expenses{}` — expenses grouped by month key `YYYY-MM`
- `categories[]` — all expense categories (parents + children)
- `goals[]` — all budget goals
- `monthNotes{}` — budget month notes keyed by `YYYY-MM`
- `exportedAt` — ISO timestamp
- `schemaVersion` — always `"6.4.0"`

### Format

Single JSON file download. MIME type `application/json`. Filename format: `bow_backup_YYYYMMDD.json`.

---

## Import

### File acceptance

- Max 25 MB
- Auto-detect JSON vs CSV by `looksLikeCsv()`: if first non-empty line starts with `# section:` or has 3+ commas → CSV, else JSON
- `schemaVersion` must be `"6.3.0"` or `"6.4.0"`. Reject anything newer.

### Two modes

| Mode | Behaviour |
|------|-----------|
| `replace` | Delete ALL existing user data (jobs, templates, shifts, categories, expenses, goals, notes) BEFORE importing. Sequential deletes — wait for each to finish before starting the next. |
| `merge` | Keep existing data. Dedupe by name (jobs), by (date+start+end) for shifts, by category+amount+date+note for expenses. |

### Import order

This ORDER matters — do not change it:

1. Profile prefs
2. Wipe existing data (replace mode only)
3. **Jobs** — must be imported before templates and shifts
4. **Templates** — must be imported after jobs (jobId must resolve)
5. **Shifts** — must be imported after jobs and templates
6. Categories (parents before children)
7. Expenses
8. Goals
9. Month notes
10. Refresh all Zustand stores

### Job ID remapping (KEY RULE)

**During import, server MUST NOT accept client-supplied job IDs.** The importing user's prefix is different from the backup's user prefix. Passing `id: "nithesh_j1"` to `createJob` when importing as `bob` will fail.

**Correct approach:**
- When importing jobs, **do NOT pass the `id` field** to `createJob`. Let the server generate a fresh ID using the importing user's handle as prefix.
- Build a `jobIdMap: Map<backupJobId, newDbJobId>` as jobs are created.
- After all jobs exist, query the DB by name to fill in any gaps (for jobs that already existed and were reused).

```typescript
// Pseudo-code for job import
const jobIdMap = new Map<string, string>() // backupId → newDbId
const dbJobsByName = new Map<string, string>() // name → dbId

// Pre-link: jobs that already exist by name
for (const j of backup.jobs) {
  const existing = dbJobsByName.get(normalizeName(j.name))
  if (existing) jobIdMap.set(j.id, existing)
}

// Create new jobs — NO id passed
for (const j of backup.jobs) {
  if (jobIdMap.has(j.id)) continue
  const created = await serverCreateJob({ name: j.name, color: j.color, rate: j.rate, nightRate: j.nightRate })
  jobIdMap.set(j.id, created.id)
}
```

### Template import rules

- `jobId` MUST resolve through `jobIdMap`. If not found → **skip and warn**. Do NOT fall back to the raw backup ID (that creates broken links).
- `id` field is NOT passed to `createTemplate` — server generates its own prefix ID.
- Days array, start/end times, workDetails are preserved as-is.

### Shift import rules

- Every shift's `jobId` MUST resolve through `jobIdMap`. If not found → **skip and warn**. Do NOT fall back to the raw backup ID.
- Merge mode: skip shifts that are exact duplicates of (jobId + start + end) on the same date.
- `date` key from the `shifts{}` dict becomes the shift's `date`.
- `breaks` array is preserved.
- `actualLogin`, `actualLogout`, `actualBreaks`, `workDetails`, `templateId`, `source` are preserved if present.

### v6.3 `entries[]` synthesis

Only runs when `shifts{}` is empty or absent. Converts:
```json
{ "date": "2026-04-22", "jobs": [{ "jobId": "j1", "dayHours": 7.2, "nightHours": 1.1 }] }
```
Into shift rows:
- Day: start 09:00, end 09:00 + floor(dayHours)
- Night: start 22:30, end 22:30 + ceil(nightHours + 0.5)
- Breaks: empty array `[]`
- Warning shown: `"Reconstructed N day(s) from v6.3 entries[] — times approximated, verify on calendar."`

### Shift normalisation

Both v6.3 and v6.4 shapes normalise to `Record<dateKey, Shift[]>` via `normalizeShiftsShape()`. Handles:
- `v6.4`: `{ "2026-07-11": [{ jobId, start, end, breaks }] }` — pass-through
- `v6.3 day-row`: `{ "0": { date: "2026-07-11", shifts: [...] } }` — extract date + shifts
- Deduplication within each date by (jobId, start, end) signature

### Warning system

Import returns an `ImportResult` with a `warnings: string[]` array. Push a warning string for every non-fatal issue:

- Template references unknown jobId → skip template, warn
- Shift references unknown jobId → skip shift, warn
- v6.3 entries-only backup → warn
- v6.3 entries synthesised → warn
- Reconstructed 0 days from entries → warn
- No shift data in backup → warn

### Store refresh

After all data is written, refresh Zustand stores in parallel:

```typescript
await Promise.all([
  useJobsStore.getState().fetchJobsFromDB(),
  useTemplatesStore.getState().fetchTemplatesFromDB(),
  useShiftsStore.getState().syncShiftsFromDB(),
])
```

---

## ID Format

All row IDs follow `{userHandle}_{prefix}{seq}` where prefix is:

| Entity | Prefix | Example |
|--------|--------|---------|
| Job | `j` | `nithesh_j1`, `bob_j2` |
| Template | `tpl` | `nithesh_tpl1` |
| Shift | `s` | `nithesh_s1` |

Server generates IDs via `makeUserRowId(userId, prefix, tx)` inside a Prisma transaction. The sequence is per-prefix, per-user, derived from `MAX(CAST(SUBSTRING(id FROM char_length(prefix) + 2) AS INT))` for that user's rows.

**Constraint**: `id` column in the DB has a CHECK constraint `id ~ '^[a-z][a-z0-9_]*_[jt][0-9]+$'`. New IDs must match this pattern.

---

## CSV format (legacy)

If `looksLikeCsv()` returns true, parse via `csvSectionsToBackupData()` from `@/lib/csv`. The CSV format is `# section:` delimited with named columns per section type. See existing `csv.ts` for current implementation — do not rewrite the CSV normaliser unless the legacy format is being deprecated.

---

## Key invariants to preserve

1. **No broken foreign keys** — jobId on templates and shifts ALWAYS resolves to an existing job in the DB at the time of insertion.
2. **No fallback to raw backup IDs** — if `jobIdMap.get(backupId)` returns undefined, the row is skipped and a warning is added.
3. **Sequential deletes in replace mode** — parallel deletes resolve before the DB has actually removed rows, causing constraint violations. Always `await` each delete.
4. **Same-user import is idempotent** — if Nithesh exports and re-imports his own backup, job names match by name → existing rows reused → `jobIdMap` has correct mappings → no duplicate jobs.
5. **Cross-user import gets fresh IDs** — Bob imports Nithesh's backup → all job IDs are generated as `bob_jN`, shifts/templates point to `bob_jN` via `jobIdMap`.

---

## File locations

| File | Purpose |
|------|---------|
| `services/importService.ts` | All import logic |
| `services/exportService.ts` | Export data assembly (called by `backup.ts`) |
| `app/actions/backup.ts` | Server actions for download/upload triggers |
| `lib/csv.ts` | CSV → BackupData normaliser (do not modify) |
| `lib/ids.ts` | `makeUserRowId()` ID generation |
| `app/actions/jobs.ts` | `createJob`, `deleteJob`, `getJobs` |
| `app/actions/shifts.ts` | `createShifts`, shift DB operations |
| `app/actions/templates.ts` | `createTemplate`, template DB operations |
| `app/actions/expenses.ts` | Expense and category operations |
| `app/actions/budget.ts` | Budget goals and month notes |
| `store/useJobsStore.ts` | Zustand jobs store |
| `store/useShiftsStore.ts` | Zustand shifts store |
| `store/useTemplatesStore.ts` | Zustand templates store |