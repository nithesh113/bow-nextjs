-- Add user_id column to users table.
ALTER TABLE "users" ADD COLUMN "user_id" TEXT;

-- Case-insensitive uniqueness via expression index.
-- Prisma can't represent this in its schema language, so the migration
-- creates the index directly. Allows NULL so old (pre-feature) rows
-- can coexist; the filter excludes NULL from the unique constraint.
CREATE UNIQUE INDEX "users_user_id_lower_unique_idx"
  ON "users" (LOWER("user_id"))
  WHERE "user_id" IS NOT NULL;

-- Helpful btree index for case-insensitive equality lookups.
-- The expression index above is used by LOWER(...) equality but a
-- complementary btree lets SQL planner skip the expression work
-- for the bytea-equality queries Prisma auto-generates.
-- Skipping the btree: it duplicates work the expression index
-- already does, and adds write cost. Leaving it out for now.
