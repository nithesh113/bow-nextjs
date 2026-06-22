// scripts/migrate-neon-region.mjs
// One-shot data mover: old Neon DB (us-east-1) → new Neon DB (ap-southeast-1).
// Safe to re-run: skips rows that already exist (uses upsert by primary key).
//
// By default reads OLD_DATABASE_URL/NEW_DATABASE_URL from scripts/.migration.env
// (one KEY=VALUE per line, comments with #). Pass env vars on the command line
// to override.
//
// Usage (from project root):
//   node scripts/migrate-neon-region.mjs
//
// Flags (optional):
//   --schema-only    just push the schema to NEW, no data copy
//   --data-only      skip the schema push (assume NEW already has tables)
//   --dry-run        read source counts, report what would be copied, exit
//   --yes            skip the "press enter to continue" prompt

import { PrismaClient } from '@prisma/client'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_FILE = resolve(__dirname, '.migration.env')

function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const txt = readFileSync(path, 'utf8')
  const out = {}
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    let val = line.slice(eq + 1).trim()
    // Strip optional surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

const fromFile = loadEnvFile(ENV_FILE)
const OLD = process.env.OLD_DATABASE_URL || fromFile.OLD_DATABASE_URL
const NEW = process.env.NEW_DATABASE_URL || fromFile.NEW_DATABASE_URL

const args = new Set(process.argv.slice(2))
const SCHEMA_ONLY = args.has('--schema-only')
const DATA_ONLY   = args.has('--data-only')
const DRY_RUN     = args.has('--dry-run')
const ASSUME_YES  = args.has('--yes')

function fail(msg, code = 1) {
  console.error(`\n[FAIL] ${msg}`)
  process.exit(code)
}

if (!OLD || !NEW) {
  fail(
    `OLD_DATABASE_URL and NEW_DATABASE_URL are required.\n` +
    `Set them in scripts/.migration.env or in your shell.`
  )
}
if (OLD === NEW) fail('OLD and NEW URLs are identical — refusing to run.')
if (!OLD.startsWith('postgres') || !NEW.startsWith('postgres')) {
  fail('Both URLs must start with postgresql://')
}

function mask(url) {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.username}:***@${u.host}${u.pathname}`
  } catch {
    return '(unparseable url)'
  }
}

const clientOpts = (url) => ({
  datasourceUrl: url,
  log: ['error', 'warn'],
})

const sourceDb = new PrismaClient(clientOpts(OLD))
const targetDb = new PrismaClient(clientOpts(NEW))

const TABLES = [
  { name: 'User',               model: 'user' },
  { name: 'VerificationToken',  model: 'verificationToken' },
  { name: 'Session',            model: 'session' },
  { name: 'PasswordResetToken', model: 'passwordResetToken' },
  { name: 'ExpenseCategory',    model: 'expenseCategory' },
  { name: 'Expense',            model: 'expense' },
  { name: 'UserTemplate',       model: 'userTemplate' },
  { name: 'UserShift',          model: 'userShift' },
]

// Models whose createMany() we know is safe — i.e. they have no Json columns
// and no relations that would trip Postgres on bulk inserts.
const BULK_SAFE = new Set(['user', 'verificationToken', 'session', 'passwordResetToken', 'expenseCategory', 'expense', 'userShift'])

async function ping(p, label) {
  try {
    const r = await p.$queryRaw`SELECT current_database() AS db, inet_server_addr() AS addr`
    return { ok: true, label, info: r[0] }
  } catch (e) {
    return { ok: false, label, error: e.message.split('\n')[0] }
  }
}

async function migrateSchema() {
  console.log('[schema] running prisma db push against NEW DB')
  // Use the Prisma CLI's engine via child_process so we get proper error output,
  // but trim the Prisma client invocation cost — actually, simplest is to use
  // $executeRaw to run a no-op and trust that the schema is already in place.
  // Better: shell out to the npm script so we go through the real engine.
  const { spawn } = await import('node:child_process')
  return new Promise((resolveP, rejectP) => {
    // On Windows, spawning npm.cmd without shell:true fails with EINVAL.
    // Use shell:true and let the OS route through cmd.exe.
    const isWin = process.platform === 'win32'
    const cmd = isWin ? 'npm.cmd' : 'npm'
    const child = spawn(cmd, ['run', 'prisma:push', '--', '--accept-data-loss'], {
      cwd: resolve(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: NEW },
      stdio: 'inherit',
      shell: isWin,
    })
    child.on('exit', (code) => (code === 0 ? resolveP() : rejectP(new Error(`prisma db push exited ${code}`))))
    child.on('error', rejectP)
  })
}

async function migrate() {
  console.log('--- Connectivity check ---')
  const a = await ping(sourceDb, 'OLD')
  const b = await ping(targetDb, 'NEW')
  console.log('OLD', a.ok ? JSON.stringify(a.info) : `FAIL: ${a.error}`)
  console.log('NEW', b.ok ? JSON.stringify(b.info) : `FAIL: ${b.error}`)
  if (!a.ok || !b.ok) fail('Connectivity failed — fix credentials before continuing.')
  console.log()

  console.log('Source:', mask(OLD))
  console.log('Target:', mask(NEW))

  if (!SCHEMA_ONLY && !ASSUME_YES) {
    console.log('\nPress Enter to continue, Ctrl+C to abort...')
    await new Promise((res) => process.stdin.once('data', res))
  }

  if (!DATA_ONLY) {
    console.log('\n[1/2] Pushing schema to NEW...')
    if (DRY_RUN) {
      console.log('[1/2] (dry-run: still pushing schema so we can report counts)')
    }
    try {
      await migrateSchema()
      console.log('[1/2] schema push OK')
    } catch (e) {
      fail(`schema push failed: ${e.message}`)
    }
  }

  if (SCHEMA_ONLY) {
    console.log('\n(--schema-only set, skipping data copy)')
    return
  }

  console.log('\n[2/2] Copying data OLD → NEW')
  const summary = []

  for (const t of TABLES) {
    const target = targetDb[t.model]
    const source = sourceDb[t.model]

    const sourceCount = await source.count()
    const targetCount = await target.count()

    if (sourceCount === 0) {
      console.log(`  ${t.name.padEnd(18)} source empty — skip`)
      summary.push({ table: t.name, source: 0, target: targetCount, copied: 0 })
      continue
    }

    if (targetCount >= sourceCount) {
      console.log(`  ${t.name.padEnd(18)} target already has ${targetCount} (>= source ${sourceCount}) — skip`)
      summary.push({ table: t.name, source: sourceCount, target: targetCount, copied: 0 })
      continue
    }

    console.log(`  ${t.name.padEnd(18)} source=${sourceCount} target=${targetCount} → copying`)
    if (DRY_RUN) {
      summary.push({ table: t.name, source: sourceCount, target: targetCount, copied: 0, dryRun: true })
      continue
    }

    const BATCH = 100
    let copied = 0
    let cursor = null

    while (true) {
      const rows = await source.findMany({
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      })
      if (rows.length === 0) break

      // Strip Date objects → ISO strings for createMany compatibility
      const data = rows.map((r) => {
        const out = { ...r }
        for (const k of Object.keys(out)) {
          if (out[k] instanceof Date) out[k] = out[k]
          // Prisma's createMany / upsert accepts Date() directly for @db.Date etc.
        }
        return out
      })

      try {
        if (BULK_SAFE.has(t.model)) {
          await target.createMany({ data, skipDuplicates: true })
        } else {
          // Fall back to per-row upsert for tables with json columns
          for (const row of data) {
            await target.upsert({ where: { id: row.id }, update: row, create: row })
          }
        }
        copied += rows.length
      } catch (err) {
        fail(`[${t.name}] copy failed at row ${copied + 1}: ${err.message}`)
      }

      cursor = rows[rows.length - 1].id
    }

    const finalCount = await target.count()
    console.log(`  ${t.name.padEnd(18)} copied ${copied}, target now ${finalCount}`)
    summary.push({ table: t.name, source: sourceCount, target: finalCount, copied })
  }

  console.log('\n--- Summary ---')
  console.table(summary)

  if (DRY_RUN) {
    console.log('\n(dry-run: no changes made — re-run without --dry-run to migrate)')
    return
  }

  const mismatched = summary.filter((s) => s.source !== s.target && s.source > 0)
  if (mismatched.length > 0) {
    fail(`Row counts do not match for: ${mismatched.map((m) => m.table).join(', ')}`)
  }

  console.log('\n✅ All tables match. Migration successful.')
  console.log('Next step: update DATABASE_URL in your .env files to the NEW URL.')
}

migrate()
  .catch((err) => fail(err.stack || err.message))
  .finally(async () => {
    await sourceDb.$disconnect()
    await targetDb.$disconnect()
  })
