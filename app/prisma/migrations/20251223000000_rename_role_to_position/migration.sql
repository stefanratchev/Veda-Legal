-- Rename role to position with new enum values
-- Maps: ADMIN → ADMIN, EMPLOYEE → ASSOCIATE

-- Create the new Position enum
CREATE TYPE "Position" AS ENUM ('ADMIN', 'PARTNER', 'SENIOR_ASSOCIATE', 'ASSOCIATE');

-- Add the new position column with default
ALTER TABLE "users" ADD COLUMN "position" "Position" NOT NULL DEFAULT 'ASSOCIATE';

-- Map existing role values to position
UPDATE "users" SET "position" = 'ADMIN' WHERE "role" = 'ADMIN';
UPDATE "users" SET "position" = 'ASSOCIATE' WHERE "role" = 'EMPLOYEE';

-- Drop the old role column
ALTER TABLE "users" DROP COLUMN "role";

-- Drop the old UserRole enum
DROP TYPE "UserRole";
