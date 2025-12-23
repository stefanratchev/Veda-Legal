-- AlterEnum: Add CONSULTANT to Position
ALTER TYPE "Position" ADD VALUE 'CONSULTANT';

-- DropIndex: Remove unique constraint on timesheetCode
DROP INDEX "clients_timesheetCode_key";

-- AlterTable: Remove timesheetCode column from clients
ALTER TABLE "clients" DROP COLUMN "timesheetCode";
