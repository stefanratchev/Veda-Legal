ALTER TABLE "time_entries" ADD COLUMN "isWrittenOff" boolean DEFAULT false NOT NULL;

-- Backfill: mark time entries as written off if they have waived line items in FINALIZED SDs
UPDATE "time_entries" SET "isWrittenOff" = true
WHERE id IN (
  SELECT DISTINCT li."timeEntryId"
  FROM "service_description_line_items" li
  INNER JOIN "service_description_topics" t ON li."topicId" = t.id
  INNER JOIN "service_descriptions" sd ON t."serviceDescriptionId" = sd.id
  WHERE li."waiveMode" IS NOT NULL
    AND li."timeEntryId" IS NOT NULL
    AND sd."status" = 'FINALIZED'
);