-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'PENDING';
