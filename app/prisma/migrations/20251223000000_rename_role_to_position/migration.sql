-- Rename role to position with new enum values
-- Maps: ADMIN → ADMIN, EMPLOYEE → ASSOCIATE

-- Create the new Position enum (skip if exists)
DO $$ BEGIN
  CREATE TYPE "Position" AS ENUM ('ADMIN', 'PARTNER', 'SENIOR_ASSOCIATE', 'ASSOCIATE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add the new position column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE "users" ADD COLUMN "position" "Position";
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Map existing role values to position (only if role column exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'role') THEN
    -- Set ADMIN users first
    UPDATE "users" SET "position" = 'ADMIN' WHERE "role"::text = 'ADMIN';
    -- Set remaining users to ASSOCIATE
    UPDATE "users" SET "position" = 'ASSOCIATE' WHERE "position" IS NULL;
    -- Drop the old role column
    ALTER TABLE "users" DROP COLUMN "role";
  ELSE
    -- Role column already gone, just ensure position has a default for any NULLs
    UPDATE "users" SET "position" = 'ASSOCIATE' WHERE "position" IS NULL;
  END IF;
END $$;

-- Set NOT NULL and default after data is migrated
ALTER TABLE "users" ALTER COLUMN "position" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "position" SET DEFAULT 'ASSOCIATE';

-- Drop the old UserRole enum if it exists
DROP TYPE IF EXISTS "UserRole";
