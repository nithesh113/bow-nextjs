/* eslint-disable no-console */
/**
 * scripts/mark-init-applied.mjs
 *
 * Marks every migration in `prisma/migrations/` as already-applied on
 * the target Postgres database, by invoking Prisma's own
 * `migrate resolve --applied` for each one. Letting Prisma create
 * the `_prisma_migrations` table avoids any column-name drift
 * between Prisma versions (Prisma 6 uses `logs`, an older or newer
 * version could differ; the CLI owns its own DDL).
 *
 * Why this exists
 * The project switched from `prisma db push` (v6.x) to
 * `prisma migrate` (v7.x) mid-flight. The Neon database already
 * has the v6.x + v7.x tables populated but no migration
 * tracker. `migrate deploy` raised P3005 against an empty schema-
 * state because it couldn't tell which migrations had been
 * applied. This script rescues that case so the next deploy
 * applies only NEW migrations.
 *
 * Usage
 *   node scripts/mark-init-applied.mjs                 # reads DATABASE_URL from .env
 *   node scripts/mark-init-applied.mjs <DATABASE_URL>  # explicit override
 *
 * Both paths avoid loading `.env` when an explicit DATABASE_URL
 * is given. Re-running is idempotent: Prisma's `resolve --applied`
 * already rejects "already applied" rows.
 */

import { spawn } from 'node:child_process'
import * as path from 'node:path'
import * as fs from 'node:fs'

const MIGRATIONS_DIR = 'prisma/migrations'

function loadDotEnv() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return
  const text = fs.readFileSync(envPath, 'utf8')
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/.exec(line)
    if (!m) continue
    const [, key, valRaw] = m
    const val = valRaw.startsWith('"') && valRaw.endsWith('"')
      ? valRaw.slice(1, -1)
      : valRaw.replace(/^'(.*)'$/, '$1')
    if (process.env[key] === undefined) process.env[key] = val
  }
}

function listMigrationNames() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return []
  // Prisma migration dirs are named `<timestamp>_<name>`. We pick
  // every directory in the folder whose name starts with a 14-digit
  // timestamp; that's the format Prisma uses (YYYYMMDDhhmmss).
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => /^\d{14}_/.test(n))
    .sort()
}

function runPrismaResolve(migrationName) {
  return new Promise((resolve, reject) => {
    const nodeArgs = [
      '-r',
      './scripts/node-realpath-patch.cjs',
      './node_modules/prisma/build/index.js',
      'migrate',
      'resolve',
      '--applied',
      migrationName,
    ]
    const child = spawn(process.execPath, nodeArgs, {
      cwd: process.cwd(),
      // Capture stdout/stderr so the operator only sees output on
      // a real failure. P3008 / P3009 are silent idempotent skips.
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })
    let stderr = ''
    let stdout = ''
    child.stdout.on('data', (b) => (stdout += b.toString()))
    child.stderr.on('data', (b) => (stderr += b.toString()))
    child.on('exit', (code) => {
      if (code === 0) return resolve(null)
      // Bubble up the full output so the operator can read the
      // error verbatim if it isn't a known skip.
      const combined = (stdout + stderr).trim()
      reject(new Error(`prisma migrate resolve --applied ${migrationName} exited with code ${code}\n${combined}`))
    })
  })
}

async function main() {
  const cliDbUrl = process.argv[2]
  if (cliDbUrl) {
    process.env.DATABASE_URL = cliDbUrl
  } else {
    loadDotEnv()
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing. Pass it as an arg or set it in .env.')
    process.exit(1)
  }

  const migrations = listMigrationNames()
  if (migrations.length === 0) {
    console.error(`No migrations found in ${MIGRATIONS_DIR}. Did you run from the project root?`)
    process.exit(1)
  }

  let recorded = 0
  let alreadyApplied = 0
  for (const name of migrations) {
    try {
      await runPrismaResolve(name)
      recorded++
    } catch (err) {
      const msg = String(err?.message ?? err)
      // Prisma signals "already recorded" via P3008 ("migration
      // <name> is already recorded as applied in the database") or
      // P3009. Both exit 1 — same overall intent. Treat them as
      // idempotent skips.
      if (
        msg.includes('P3008') ||
        msg.includes('P3009') ||
        msg.includes('is already recorded') ||
        msg.includes('Already recorded')
      ) {
        alreadyApplied++
        continue
      }
      console.error(`[mark-init] ${name} failed: ${msg}`)
      process.exitCode = 1
    }
  }

  console.log(
    `Recorded ${recorded} migration(s). Skipped ${alreadyApplied} that were already applied.` +
    (process.exitCode ? ' (warnings above)' : '')
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
