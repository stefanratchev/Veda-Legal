# Add topicId to time_entries Schema

**Date:** 2026-01-27
**Status:** Ready for implementation

## Problem

When editing a time entry for an internal/management client (no subtopic), the PATCH endpoint returns "Subtopic not found" error.

Root cause: The API doesn't distinguish between `subtopicId: null` (valid, intentionally no subtopic) and `subtopicId: "invalid-id"` (should error).

Deeper issue: The schema lacks a direct `topicId` FK on `time_entries`. For topic-only entries, we only have the denormalized `topicName` text field, which:
- Prevents proper FK relationships
- Makes queries inconsistent between subtopic and topic-only entries
- Conflates "topic identity" with "topic name for display"

## Solution

Add `topicId` foreign key to `time_entries` table and update API endpoints to handle it properly.

## Schema Change

**File:** `app/src/lib/schema.ts`

Add to `timeEntries` table:
```typescript
topicId: text(),  // nullable FK to topics
```

Add foreign key constraint:
```typescript
foreignKey({
  columns: [table.topicId],
  foreignColumns: [topics.id],
  name: "time_entries_topicId_fkey"
}).onUpdate("cascade").onDelete("set null"),
```

Add index:
```typescript
index("time_entries_topicId_idx").using("btree", table.topicId.asc().nullsLast().op("text_ops")),
```

Add relation:
```typescript
topic: one(topics, {
  fields: [timeEntries.topicId],
  references: [topics.id],
}),
```

## Migration & Backfill

Generate migration with `npm run db:generate`, then add backfill SQL.

**Backfill entries with subtopicId:**
```sql
UPDATE time_entries
SET "topicId" = subtopics."topicId"
FROM subtopics
WHERE time_entries."subtopicId" = subtopics.id
  AND time_entries."topicId" IS NULL;
```

**Backfill entries without subtopicId (topic-only):**
```sql
UPDATE time_entries
SET "topicId" = topics.id
FROM topics
WHERE time_entries."topicName" = topics.name
  AND time_entries."subtopicId" IS NULL
  AND time_entries."topicId" IS NULL;
```

Entries that don't match (renamed/deleted topics) will have `topicId = NULL` but retain their `topicName` for display.

## API Changes

### POST /api/timesheets (create entry)

Accept `topicId` in request body. Logic:

- If `subtopicId` provided: look up subtopic, derive `topicId` and names from it
- If only `topicId` provided (no subtopicId): look up topic, set `topicId`/`topicName`, set `subtopicId = null`, `subtopicName = ""`
- Store `topicId` in database

### PATCH /api/timesheets/[id] (update entry)

Fix the null subtopic bug. New logic:

```
if subtopicId is provided (not undefined):
  if subtopicId is null:
    → require topicId to also be provided
    → look up topic, validate exists and active
    → set topicId, topicName from topic
    → set subtopicId = null, subtopicName = ""
  else (subtopicId is a string):
    → look up subtopic, validate exists and active
    → set subtopicId, subtopicName from subtopic
    → set topicId, topicName from subtopic's parent topic

if only topicId is provided (subtopicId undefined):
  → look up topic, validate exists and active
  → update topicId, topicName
  → leave subtopicId/subtopicName unchanged
```

### GET responses

Include `topicId` in time entry response objects.

## Type Changes

**File:** `app/src/types/index.ts`

Update `TimeEntry` interface:
```typescript
interface TimeEntry {
  // ... existing fields
  topicId: string | null;  // add this
}
```

## Frontend Changes

Minimal—frontend already sends `topicId` in edit requests.

Verify `TimesheetsContent.tsx` sends `topicId` when creating entries. If not, add it.

## Test Updates

- Update existing timesheet API tests to include `topicId`
- Add test cases for:
  - Creating topic-only entry (no subtopic)
  - Editing entry to change from subtopic to topic-only
  - Editing entry to change from topic-only to subtopic
  - Editing topic-only entry to different topic

## Files to Modify

1. `app/src/lib/schema.ts` - Add topicId column, FK, index, relation
2. `app/drizzle/migrations/` - New migration with backfill
3. `app/src/app/api/timesheets/route.ts` - POST: accept/store topicId
4. `app/src/app/api/timesheets/[id]/route.ts` - PATCH: fix bug, handle topicId
5. `app/src/types/index.ts` - Add topicId to TimeEntry
6. `app/src/components/timesheets/TimesheetsContent.tsx` - Verify topicId sent on create
7. `app/src/app/api/timesheets/route.test.ts` - Update tests
8. `app/src/app/api/timesheets/[id]/route.test.ts` - Update tests, add topic-only cases
