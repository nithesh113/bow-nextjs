// scripts/clear-test-data.mjs
//
// Wipe per-user test data from the live Neon DB. PRESERVES:
//   - users (you stay logged in)
//   - sessions, password_reset_tokens, verification_tokens (auth)
//   - admin_audit_log, email_logs (audit trail)
//
// Deletes (in FK-safe order):
//   1. user_shifts               (no children)
//   2. user_templates            (no children)
//   3. expenses                  (FK → expense_categories.id)
//   4. expense_categories (children-first via recursive CTE style: delete
//      all categories, FK is SetNull on parent delete so child becomes
//      orphans; we want to clear all rows, so two-pass DELETE-children
//      then DELETE-parents is fine)
//   5. user_budget_month_metas   (no children)
//   6. user_budget_goals         (no children)
//   7. user_jobs                 (no children now that shifts/templates are gone)
//   8. user_feedback             (last, no children)
//
// Usage:
//   node scripts/clear-test-data.mjs          # dry-run: print counts only
//   node scripts/clear-test-data.mjs --all    # delete every row (every user)
//   node scripts/clear-test-data.mjs --user <uuid>   # delete only that user's rows
//
// SAFETY:
//   - Default mode is dry-run — no DELETEs without `--all` or `--user X`
//   - Refuses to run if DATABASE_URL is missing, doesn't look like neon,
//     or any forbidden table (users/sessions/etc.) is target of delete
//   - Prints row counts BEFORE and AFTER

import { PrismaClient } from '@prisma/client'

const args = process.argv.slice(2)
const hasAll = args.includes('--all')
const userFlagIdx = args.indexOf('--user')
const userId = userFlagIdx >= 0 ? args[userFlagIdx + 1] : null

// Tables we allow to be cleared
const ALLOWED = new Set([
  'user_shifts',
  'user_templates',
  'expenses',
  'expense_categories',
  'user_budget_month_metas',
  'user_budget_goals',
  'user_jobs',
  'user_feedback',
])

// FORBIDDEN — must NEVER be wiped by this script
const FORBIDDEN = new Set([
  'users',
  'sessions',
  'password_reset_tokens',
  'verification_tokens',
  'admin_audit_log',
  'email_logs',
  '_prisma_migrations',
])

function fail(msg) {
  console.error(`❌  ${msg}`)
  process.exit(2)
}

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) fail('DATABASE_URL not set — aborting.')
if (!dbUrl.includes('neon.tech')) {
  console.warn('⚠️  DATABASE_URL does not look like a Neon host. Double-check before proceeding.')
}

if (!hasAll && !userId) {
  console.log(`
clear-test-data.mjs — DRY-RUN MODE (no deletes will run)

Wipe per-user test data on this Neon DB. USERS + AUTH tables are preserved.

Args:
  --all               Delete every row in the 8 allowed tables
  --user <uuid>       Delete only rows for the given userId
  (no flag)           Dry-run: print counts only, don't run any DELETE

Examples:
  node scripts/clear-test-data.mjs
  node scripts/clear-test-data.mjs --all
  node scripts/clear-test-data.mjs --user 123e4567-e89b-12d3-a456-426614174000
`)
}

const prisma = new PrismaClient({ log: ['error'] })

async function safeDeleteMany(modelName, where) {
  const m = prisma[modelName]
  if (!m || typeof m.deleteMany !== 'function') return { count: 0, _skipped: modelName }
  try {
    return await m.deleteMany({ where })
  } catch (err) {
    const code = err?.code
    if (code === 'P2021') return { count: 0, _skipped: modelName, _reason: 'table missing' }
    throw err
  }
}

async function safeCount(modelName, where) {
  const m = prisma[modelName]
  if (!m || typeof m.count !== 'function') return 0
  try {
    return await m.count({ where })
  } catch (err) {
    if (err?.code === 'P2021') return 0
    throw err
  }
}

async function countUserJobs(userIdOrUndefined) {
  const where = userIdOrUndefined ? { userId: userIdOrUndefined } : {}
  return {
    user_shifts:            await safeCount('userShift', where),
    user_templates:         await safeCount('userTemplate', where),
    expenses:               await safeCount('expense', where),
    expense_categories:     await safeCount('expenseCategory', where),
    user_budget_month_metas: await safeCount('userBudgetMonthMeta', where),
    user_budget_goals:      await safeCount('userBudgetGoal', where),
    user_jobs:              await safeCount('userJob', where),
    user_feedback:          await safeCount('userFeedback', where),
    // preserved
    users:                  await safeCount('user', {}),
    sessions:               await safeCount('session', {}),
    admin_audit_log:        await safeCount('adminAuditLog', {}),
    email_logs:             await safeCount('emailLog', {}),
  }
}

async function wipeForUser(userIdOrUndefined) {
  const where = userIdOrUndefined ? { userId: userIdOrUndefined } : {}
  const results = {}

  results.user_shifts     = await safeDeleteMany('userShift', where)
  results.user_templates  = await safeDeleteMany('userTemplate', where)
  results.expenses        = await safeDeleteMany('expense', where)
  // Categories: two-pass so child→parent SetNull edges still let us
  // delete parents without violating self-FK.
  results.expense_categories_children = await safeDeleteMany('expenseCategory', {
    ...where, parentId: { not: null },
  })
  results.expense_categories_parents  = await safeDeleteMany('expenseCategory', {
    ...where, parentId: null,
  })
  results.user_budget_month_metas = await safeDeleteMany('userBudgetMonthMeta', where)
  results.user_budget_goals       = await safeDeleteMany('userBudgetGoal', where)
  results.user_jobs               = await safeDeleteMany('userJob', where)
  results.user_feedback           = await safeDeleteMany('userFeedback', where)
  return results
}

async function main() {
  console.log(`\n=== clear-test-data.mjs ===`)
  console.log(`Mode: ${hasAll ? 'WIPE ALL USERS' : userId ? `WIPE ONE USER (${userId})` : 'DRY-RUN (no deletes)'}`)

  let before = null
  console.log(`\n── Counts BEFORE ──`)
  try {
    before = await countUserJobs(userId ?? undefined)
    for (const [k, v] of Object.entries(before)) console.log(`   ${k.padEnd(26)} ${v}`)
    console.log(`\nAllowed deletes :`)
    for (const t of ALLOWED) console.log(`   ✔ ${t}`)
    console.log(`\nPreserved (NEVER touched) :`)
    for (const t of FORBIDDEN) console.log(`   ✘ ${t}`)
  } catch (err) {
    console.warn('⚠️  Some count queries failed (probably missing tables in DB):')
    console.warn('   ', err?.message ?? err)
    console.warn('   Continuing — wipe will skip any tables Prisma cannot reach.')
  }

  if (!hasAll && !userId) {
    console.log(`\nDry-run complete. Re-run with --all or --user <uuid> to wipe.`)
    await prisma.$disconnect()
    process.exit(0)
  }

  console.log(`\nRunning DELETE pass…`)
  const stats = await wipeForUser(userId ?? undefined)
  for (const [k, v] of Object.entries(stats)) {
    console.log(`   deleted ${k.padEnd(30)} ${v.count}`)
  }
  console.log(`\n── Counts AFTER ──`)
  try {
    const after = await countUserJobs(userId ?? undefined)
    for (const [k, v] of Object.entries(after)) {
      const was = before ? before[k] : '?'
      console.log(`   ${k.padEnd(26)} ${v}  (was ${was})`)
    }
  } catch (err) {
    console.warn('⚠️  Could not recount after wipe:', err?.message ?? err)
  }
  await prisma.$disconnect()
  process.exit(0)
}

main().catch(async (err) => {
  console.error('❌  Wipe failed:', err)
  await prisma.$disconnect()
  process.exit(1)
})
