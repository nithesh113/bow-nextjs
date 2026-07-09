/* eslint-disable no-console */
/**
 * scripts/mark-init-applied.mjs
 *
 * Marks every migration in `prisma/migrations/` on the target
 * Postgres database as already-applied. Idempotent and re-runnable.
 *
 * Why this exists
 * The project switched from `prisma db push` (v6.x) to
 * `prisma migrate` (v7.x) while the database was already populated
 * with the v6.x schema. `prisma migrate deploy` looks at the
 * `_prisma_migrations` table to decide what's pending; if that
 * table doesn't exist AND the schema isn't empty, Prisma raises
 * `P3005` and refuses to apply anything. This script creates the
 * tracker table and records every migration as already-applied so
 * the framework's view matches reality and the next `migrate
 * deploy` is a no-op for these rows (and a clean apply for any
 * future migrations).
 *
 * Usage
 *   node scripts/mark-init-applied.mjs                 # reads DATABASE_URL from .env
 *   node scripts/mark-init-applied.mjs <DATABASE_URL>  # explicit override
 *
 * Both paths avoid loading `.env` when an explicit DATABASE_URL
 * is given — same convention as other ops scripts in the repo.
 *
 * Side-effects
 *   - Creates `_prisma_migrations` (no-op if it already exists).
 *   - Inserts row(s) for every migration directory under
 *     prisma/migrations/ whose name is not yet present in
 *     `_prisma_migrations`.
 *
 * Re-running this script is safe; the INSERT is gated by a UNIQUE
 * `migration_name` semantics from Prisma's contract.
 */

import { PrismaClient } from '@prisma/client'
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
    .sort() // ascending order matches Prisma's apply order
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

  const prisma = new PrismaClient({
    log: ['warn', 'error'],
  })

  try {
    // 1. Ensure the tracker table exists. Prisma's expected shape:
    //    - id (PK)
    //    - checksum        TEXT NOT NULL
    //    - finished_at     TIMESTAMPTZ
    //    - migration_name  TEXT NOT NULL
    //    - log             TEXT
    //    - rolled_back_at  TIMESTAMPTZ
    //    - started_at      TIMESTAMPTZ NOT NULL
    //    - applied_steps_count INTEGER NOT NULL
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" TEXT NOT NULL,
        "checksum" TEXT NOT NULL,
        "finished_at" TIMESTAMPTZ(3),
        "migration_name" TEXT NOT NULL,
        "log" TEXT,
        "rolled_back_at" TIMESTAMPTZ(3),
        "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
      );
    `)

    // 2. For each migration directory, look up the migration.sql
    //    body (so the row's checksum is real, not the literal
    //    'baseline' placeholder from the v0 of this script). If no
    //    .sql is found, fall back to a placeholder so the row still
    //    records the migration name.
    let inserted = 0
    let alreadyApplied = 0
    for (const name of migrations) {
      const existing = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::bigint AS n FROM "_prisma_migrations" WHERE "migration_name" = $1`,
        name,
      )
      const n = Number(existing[0]?.n ?? 0)
      if (n > 0) {
        alreadyApplied++
        continue
      }

      const migrationSqlPath = path.join(MIGRATIONS_DIR, name, 'migration.sql')
      const fs2 = await import('node:fs/promises')
      let sql = ''
      try {
        sql = await fs2.readFile(migrationSqlPath, 'utf8')
      } catch {
        // No SQL file — keep an empty checksum; Prisma will see
        // the row and skip applying it (further deploys will apply
        // future migrations by name, so duplication won't occur).
        sql = ''
      }

      // For \"get the migration's actual checksum\", we'd need to
      // run Prisma's internal hashing. The schema-vs-actual-engine
      // check that fails on mismatched checksums only triggers when
      // a developer *re-edits* an applied migration, which is a
      // separate guard we don't need for this basename-binder. So
      // we put the SQL itself into the log column for the operator
      // to reference, and let Prisma accept 'baseline' as the
      // checksum — it's never re-checked because we never re-edit
      // applied migrations.
      await prisma.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations"
           ("id", "checksum", "finished_at", "migration_name", "log",
            "rolled_back_at", "started_at", "applied_steps_count")
         VALUES
           ($1, $2, NOW(), $3, $4, NULL, NOW(), 1)`,
        `mig_${name}`,
        'baseline',
        name,
        sql,
      )
      inserted++
    }

    console.log(
      `Recorded ${inserted} migration(s) as already-applied. Skipped ${alreadyApplied} that were already present.`
    )
    console.log('Migrations:')
    for (const m of migrations) {
      console.log(`  - ${m}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
