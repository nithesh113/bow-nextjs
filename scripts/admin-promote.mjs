#!/usr/bin/env node
/**
 * scripts/admin-promote.mjs
 *
 * Promote (or demote) an existing user to ADMIN by email.
 *
 * Plan §19 says the bootstrap flow is: register normally, then
 * promote the seeded user. This CLI does that against
 * DATABASE_URL — keeps it offline from the running app server,
 * no shared session/cookie needed, no HTTP plumbing.
 *
 * Usage:
 *   node scripts/admin-promote.mjs <email> [USER|ADMIN]
 *
 * Defaults to promoting to ADMIN when no role is passed. Empty
 * arg → exits with a non-zero code.
 *
 * Idempotent on the role you already hold — it exits 0 with a
 * 'no change' message rather than throwing. Errors throw and
 * exit 1 so CI / one-shot scripts get a clear signal.
 */

import { PrismaClient } from '@prisma/client'
import * as path from 'node:path'
import * as fs from 'node:fs'

const VALID_ROLES = ['USER', 'ADMIN']
const MIGRATION_NAME = 'admin-promote-cli'

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

async function main() {
  const [, , targetEmail, requestedRole = 'ADMIN'] = process.argv

  if (!targetEmail) {
    console.error('Usage: node scripts/admin-promote.mjs <email> [USER|ADMIN]')
    process.exit(2)
  }
  if (!VALID_ROLES.includes(requestedRole)) {
    console.error(`Role must be one of: ${VALID_ROLES.join(', ')} (got '${requestedRole}')`)
    process.exit(2)
  }
  if (process.argv.length > 4) {
    console.error('Unexpected extra arguments.')
    process.exit(2)
  }

  loadDotEnv()
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing. Pass it as an env var or set it in .env.')
    process.exit(1)
  }

  const prisma = new PrismaClient({
    log: ['warn', 'error'],
  })

  try {
    const email = targetEmail.trim().toLowerCase()
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true },
    })
    if (!user) {
      console.error(`No user found for email '${email}'.`)
      process.exit(1)
    }
    if (user.role === requestedRole) {
      console.log(`User ${user.email} is already ${user.role}. No-op.`)
      return
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { role: requestedRole },
    })

    // Audit log entry: nobody is "logged in" when the CLI runs, so
    // we use the user's own id as the actor and tag the action with
    // the CLI's name in metadata. Stays discoverable in
    // /admin/audit-log without inventing a separate actor field.
    try {
      await prisma.adminAuditLog.create({
        data: {
          adminUserId: user.id,
          action: 'admin.cli_role_change',
          targetType: 'user',
          targetId: user.id,
          metadata: { source: MIGRATION_NAME, before: user.role, after: requestedRole, email: user.email },
        },
      })
    } catch (err) {
      console.error(`Warning: role update applied but audit log write failed: ${err.message}`)
    }

    console.log(`✅ ${user.email} (${user.name}): role ${user.role} -> ${requestedRole}.`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
