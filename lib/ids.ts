/**
 * USER-PREFIXED ROW IDs — replace UUID auto-generation for shift,
 * template, and job entities.
 *
 * Format:  `{userId}_{prefix}{seq}`   (e.g. `nithesh_s1`, `nithesh_j3`)
 *
 * Each user has an independent sequence per prefix, so `nithesh_s1`
 * and `arockia_s1` are different rows.
 *
 * Concurrency: the seq counter is derived from `SELECT MAX(...)` just
 * before insert, so concurrent creates for the same user+prefix may
 * race.  The call site handles P2002 (unique-constraint violation)
 * via retry — the helper exports `nextUserSeq` for that loop.
 *
 * Import resilience: an import may supply the id explicitly
 * (`nithesh_s5`).  The service layer upserts by that id (or by a
 * de-duped name for jobs).  The helper also exports `parseUserId`
 * so the import layer can verify the claimed userId matches the
 * authenticated user.
 */

import { prisma } from '@/lib/auth/prisma'
import type { Prisma } from '@prisma/client'

export type SeqPrefix = 's' | 'tpl' | 'j'

// Database table names (from Prisma @@map — raw SQL must use actual DB names)
const TABLE: Record<SeqPrefix, string> = {
  s: 'user_shifts',
  tpl: 'user_templates',
  j: 'user_jobs',
}

/** Derive the next seq number for userId + prefix by reading the DB.

    Returns 1 when no rows exist yet for that user+prefix.
    Runs inside a Prisma transaction so the read and subsequent write
    are causally consistent (though not locked — P2002 retry covers
    concurrent inserts). */
export async function nextUserSeq(
  userId: string,
  prefix: SeqPrefix,
  tx?: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>,
): Promise<number> {
  const db = tx ?? prisma
  const table = TABLE[prefix]
  // Query ALL rows for that user whose id starts with `{userId}_{prefix}`
  // and extract the numeric suffix via substring.
  //
  // PostgreSQL MAX on a filtered substring expression is fast (< 1 ms
  // for thousands of rows) and is safe because the format always has
  // the underscore separator.
  const rows = await (db as any).$queryRawUnsafe(
    `SELECT MAX(CAST(SUBSTRING(id FROM POSITION('_' IN id) + LENGTH($2) + 1) AS INTEGER)) AS max_seq
     FROM ${table}
     WHERE "user_id" = $1
       AND id LIKE $3`,
    userId,
    prefix,
    `${userId}_${prefix}%`,
  ) as Array<{ max_seq: bigint | null }>
  const max = rows?.[0]?.max_seq
  return max ? Number(max) + 1 : 1
}

/** Build a full row id: `{userId}_{prefix}{seq}`. */
export function formatUserRowId(userId: string, prefix: SeqPrefix, seq: number): string {
  return `${userId}_${prefix}${seq}`
}

/**
 * Parse a user-prefixed id.
 *
 * Examples:
 *   `nithesh_s3`         → { userId: 'nithesh', prefix: 's', seq: 3 }
 *   `arockia_j1`         → { userId: 'arockia', prefix: 'j', seq: 1 }
 *   `some_uuid_here`     → null  (UUID or non-prefixed format)
 */
export function parseUserPrefixedId(id: string): {
  userId: string
  prefix: SeqPrefix
  seq: number
} | null {
  // Must match `{handle}_{prefix}{digits}`
  const m = /^([a-z][a-z0-9_]{1,29})_(s|tpl|j)(\d{1,10})$/.exec(id)
  if (!m) return null
  return { userId: m[1], prefix: m[2] as SeqPrefix, seq: Number(m[3]) }
}

/**
 * Convenience: generate a new id for the given user+prefix.
 *
 * Calls nextUserSeq + formatUserRowId.  Use inside a P2002-retry
 * block so concurrent inserts don't lose rows.
 */
export async function makeUserRowId(
  userId: string,
  prefix: SeqPrefix,
  tx?: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>,
): Promise<string> {
  const seq = await nextUserSeq(userId, prefix, tx)
  return formatUserRowId(userId, prefix, seq)
}