-- Migration: replace UUID auto-generation with user-prefixed row IDs
-- for shifts, templates, and jobs.
--
-- The application layer (lib/ids.ts) now mints ids in the format
-- `{userId}_{prefix}{seq}` (e.g. `nithesh_s1`, `nithesh_tpl1`, `nithesh_j1`).
-- Existing UUID-based ids are preserved; this migration only removes
-- the database-level DEFAULT so new rows require an explicit id.
--
-- `@db.Uuid` type is dropped because the new ids are plain strings,
-- not UUIDs. This is a safe cast: the column type remains TEXT/VARCHAR
-- in PostgreSQL and existing values validate fine as text.

-- === UserShift ===
ALTER TABLE "user_shifts"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "id" TYPE TEXT;

-- === UserTemplate ===
ALTER TABLE "user_templates"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "id" TYPE TEXT;

-- === UserJob ===
ALTER TABLE "user_jobs"
  ALTER COLUMN "id" DROP DEFAULT,
  ALTER COLUMN "id" TYPE TEXT;