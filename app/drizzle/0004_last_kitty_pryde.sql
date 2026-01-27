ALTER TABLE "time_entries" ADD COLUMN "topicId" text;--> statement-breakpoint
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."topics"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "time_entries_topicId_idx" ON "time_entries" USING btree ("topicId" text_ops);--> statement-breakpoint

-- Backfill topicId for entries WITH subtopicId (derive from subtopic's parent)
UPDATE "time_entries"
SET "topicId" = "subtopics"."topicId"
FROM "subtopics"
WHERE "time_entries"."subtopicId" = "subtopics"."id"
  AND "time_entries"."topicId" IS NULL;--> statement-breakpoint

-- Backfill topicId for entries WITHOUT subtopicId (match by topicName)
UPDATE "time_entries"
SET "topicId" = "topics"."id"
FROM "topics"
WHERE "time_entries"."topicName" = "topics"."name"
  AND "time_entries"."subtopicId" IS NULL
  AND "time_entries"."topicId" IS NULL;