-- CreateEnum
CREATE TYPE "SubtopicStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- DropForeignKey
ALTER TABLE "time_entries" DROP CONSTRAINT IF EXISTS "time_entries_topicId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "time_entries_topicId_idx";

-- AlterTable: Remove topicId from time_entries, add subtopic fields
ALTER TABLE "time_entries" DROP COLUMN IF EXISTS "topicId";
ALTER TABLE "time_entries" ADD COLUMN "subtopicId" TEXT;
ALTER TABLE "time_entries" ADD COLUMN "topicName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "time_entries" ADD COLUMN "subtopicName" TEXT NOT NULL DEFAULT '';

-- AlterTable: Remove code from topics
ALTER TABLE "topics" DROP CONSTRAINT IF EXISTS "topics_code_key";
ALTER TABLE "topics" DROP COLUMN IF EXISTS "code";

-- CreateTable
CREATE TABLE "subtopics" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isPrefix" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "SubtopicStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subtopics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subtopics_topicId_idx" ON "subtopics"("topicId");

-- CreateIndex
CREATE INDEX "time_entries_subtopicId_idx" ON "time_entries"("subtopicId");

-- AddForeignKey
ALTER TABLE "subtopics" ADD CONSTRAINT "subtopics_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_subtopicId_fkey" FOREIGN KEY ("subtopicId") REFERENCES "subtopics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
