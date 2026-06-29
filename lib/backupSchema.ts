/**
 * Backup schema version constant.
 *
 * Lives outside any `'use server'` module because Next 16 strictly forbids
 * exporting non-function values (including `const`) from `'use server'`
 * files. By keeping this small constant here, both server actions
 * (`app/actions/backup.ts`) and the client import flow
 * (`services/importService.ts`) can read the same `schemaVersion`.
 *
 * Bump this string when `BackupData` adds or removes fields.
 */
export const BACKUP_SCHEMA_VERSION = '6.4.0' as const
export type BackupSchemaVersion = typeof BACKUP_SCHEMA_VERSION

/** Older schemas supported read-compatibility during import. */
export const SUPPORTED_BACKUP_VERSIONS = ['6.3.0', '6.4.0'] as const
