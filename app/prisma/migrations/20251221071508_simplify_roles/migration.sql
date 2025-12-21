-- Map existing roles to new simplified roles
UPDATE users SET role = 'ADMIN' WHERE role IN ('PARTNER', 'ASSOCIATE');
UPDATE users SET role = 'EMPLOYEE' WHERE role IN ('PARALEGAL', 'EMPLOYEE');

-- Update the enum (PostgreSQL specific)
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EMPLOYEE');
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE users ALTER COLUMN role TYPE "UserRole" USING role::text::"UserRole";
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'EMPLOYEE';
DROP TYPE "UserRole_old";
