// scripts/swap-database-url.mjs
// Atomic helper: replace DATABASE_URL in .env (and .env.docker) with the value
// from NEW_DATABASE_URL in scripts/.migration.env. Never echoes the password.
//
// Usage:  node scripts/swap-database-url.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

const migrationEnv = loadEnvFile(resolve(__dirname, '.migration.env'))
const newUrl = process.env.NEW_DATABASE_URL || migrationEnv.NEW_DATABASE_URL

if (!newUrl) {
  console.error('NEW_DATABASE_URL is not set (in scripts/.migration.env or shell)')
  process.exit(1)
}

// Parse the URL to extract host for verification (no password printed)
let parsed
try { parsed = new URL(newUrl) } catch {
  console.error('NEW_DATABASE_URL is not a valid URL')
  process.exit(1)
}
if (parsed.protocol !== 'postgresql:') {
  console.error('NEW_DATABASE_URL must start with postgresql://')
  process.exit(1)
}
if (!parsed.host.endsWith('neon.tech')) {
  console.error(`NEW host is not a neon.tech URL: ${parsed.host}`)
  process.exit(1)
}

const targetFiles = ['.env', '.env.docker'].filter((f) => existsSync(resolve(root, f)))
if (targetFiles.length === 0) {
  console.error('No .env or .env.docker files found.')
  process.exit(1)
}

function replaceDatabaseUrl(text, newValue) {
  const lines = text.split(/\r?\n/)
  let replaced = false
  const out = lines.map((line) => {
    const m = /^(\s*DATABASE_URL\s*=\s*)(.*)$/.exec(line)
    if (!m) return line
    replaced = true
    // Preserve leading whitespace and the "="; replace only the value tail.
    return `${m[1]}${newValue}`
  })
  if (!replaced) {
    // No existing key; prepend it.
    out.unshift(`DATABASE_URL=${newValue}`)
  }
  return { text: out.join('\r\n'), replaced }
}

console.log(`Target region: ${parsed.host.replace(/^ep-[^.]+\./, 'ep-….').split('.').slice(-3).join('.')}`)
console.log(`Files to update: ${targetFiles.join(', ')}`)

for (const rel of targetFiles) {
  const abs = resolve(root, rel)
  const before = readFileSync(abs, 'utf8')
  const { text: after, replaced } = replaceDatabaseUrl(before, newUrl)
  if (replaced && after === before) {
    console.log(`  ${rel}: unchanged (value already matches)`)
    continue
  }
  writeFileSync(abs, after, 'utf8')
  console.log(`  ${rel}: DATABASE_URL ${replaced ? 'updated' : 'appended'}`)
}

// Verify
console.log('\nVerification:')
for (const rel of targetFiles) {
  const txt = readFileSync(resolve(root, rel), 'utf8')
  const m = /^DATABASE_URL=(.+)$/m.exec(txt)
  if (!m) { console.log(`  ${rel}: ❌ no DATABASE_URL found`); continue }
  const u = new URL(m[1].trim())
  const region = u.host.includes('us-east-1') ? 'us-east-1'
    : u.host.includes('ap-southeast-1') ? 'ap-southeast-1 (Singapore)'
    : u.host.includes('ap-northeast-1') ? 'ap-northeast-1 (Tokyo)'
    : 'unknown'
  console.log(`  ${rel}: ✅  host=${u.host}  region=${region}`)
}
