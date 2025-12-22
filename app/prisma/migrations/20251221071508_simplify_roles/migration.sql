-- Update the enum (PostgreSQL specific)
-- First rename old enum, create new one, then convert column with mapping
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EMPLOYEE');
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE users ALTER COLUMN role TYPE "UserRole" USING (
  CASE role::text
    WHEN 'PARTNER' THEN 'ADMIN'
    WHEN 'ASSOCIATE' THEN 'ADMIN'
    WHEN 'PARALEGAL' THEN 'EMPLOYEE'
    WHEN 'EMPLOYEE' THEN 'EMPLOYEE'
  END
)::"UserRole";
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'EMPLOYEE';
DROP TYPE "UserRole_old";
