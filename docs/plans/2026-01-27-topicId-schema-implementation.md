# Add topicId to time_entries Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `topicId` foreign key to `time_entries` table to fix bug where editing topic-only entries fails with "Subtopic not found".

**Architecture:** Add nullable `topicId` column with FK constraint to `time_entries`. Update POST/PATCH API endpoints to accept and store `topicId`. Backfill existing entries from subtopic's parent topic or by matching `topicName`.

**Tech Stack:** Drizzle ORM, PostgreSQL, Next.js API Routes, Vitest

---

## Task 1: Update Schema

**Files:**
- Modify: `app/src/lib/schema.ts:146-178` (timeEntries table)

**Step 1: Add topicId column to timeEntries table**

In `app/src/lib/schema.ts`, add the `topicId` column to the `timeEntries` table definition:

```typescript
export const timeEntries = pgTable("time_entries", {
	id: text().primaryKey().notNull(),
	date: date().notNull(),
	hours: numeric({ precision: 4, scale:  2 }).notNull(),
	description: text().notNull(),
	userId: text().notNull(),
	clientId: text().notNull(),
	topicId: text(),  // ADD THIS LINE
	subtopicId: text(),
	topicName: text().default('').notNull(),
	subtopicName: text().default('').notNull(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("time_entries_clientId_idx").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	index("time_entries_date_idx").using("btree", table.date.asc().nullsLast().op("date_ops")),
	index("time_entries_topicId_idx").using("btree", table.topicId.asc().nullsLast().op("text_ops")),  // ADD THIS LINE
	index("time_entries_subtopicId_idx").using("btree", table.subtopicId.asc().nullsLast().op("text_ops")),
	index("time_entries_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "time_entries_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.clientId],
			foreignColumns: [clients.id],
			name: "time_entries_clientId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({  // ADD THIS BLOCK
			columns: [table.topicId],
			foreignColumns: [topics.id],
			name: "time_entries_topicId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.subtopicId],
			foreignColumns: [subtopics.id],
			name: "time_entries_subtopicId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);
```

**Step 2: Add topic relation to timeEntriesRelations**

Update the `timeEntriesRelations` in `app/src/lib/schema.ts`:

```typescript
export const timeEntriesRelations = relations(timeEntries, ({ one, many }) => ({
  user: one(users, {
    fields: [timeEntries.userId],
    references: [users.id],
  }),
  client: one(clients, {
    fields: [timeEntries.clientId],
    references: [clients.id],
  }),
  topic: one(topics, {  // ADD THIS BLOCK
    fields: [timeEntries.topicId],
    references: [topics.id],
  }),
  subtopic: one(subtopics, {
    fields: [timeEntries.subtopicId],
    references: [subtopics.id],
  }),
  billingLineItems: many(serviceDescriptionLineItems),
}));
```

**Step 3: Verify schema compiles**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add app/src/lib/schema.ts
git commit -m "$(cat <<'EOF'
feat(schema): add topicId column to time_entries

Add nullable topicId foreign key to topics table for proper
referential integrity on topic-only entries (internal/management).

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Generate and Apply Migration

**Files:**
- Create: `app/drizzle/migrations/XXXX_add_topicId_to_time_entries.sql` (generated)

**Step 1: Generate migration**

Run: `cd app && npm run db:generate`
Expected: New migration file created in `app/drizzle/migrations/`

**Step 2: Review generated migration**

The generated SQL should include:
- `ALTER TABLE "time_entries" ADD COLUMN "topicId" text;`
- `CREATE INDEX` for `topicId`
- `ALTER TABLE` to add foreign key constraint

**Step 3: Add backfill SQL to migration**

Edit the generated migration file to add backfill statements at the end:

```sql
-- Backfill topicId for entries WITH subtopicId (derive from subtopic's parent)
UPDATE "time_entries"
SET "topicId" = "subtopics"."topicId"
FROM "subtopics"
WHERE "time_entries"."subtopicId" = "subtopics"."id"
  AND "time_entries"."topicId" IS NULL;

-- Backfill topicId for entries WITHOUT subtopicId (match by topicName)
UPDATE "time_entries"
SET "topicId" = "topics"."id"
FROM "topics"
WHERE "time_entries"."topicName" = "topics"."name"
  AND "time_entries"."subtopicId" IS NULL
  AND "time_entries"."topicId" IS NULL;
```

**Step 4: Apply migration to local database**

Run: `cd app && npm run db:migrate`
Expected: Migration applies successfully

**Step 5: Verify backfill worked**

Run: `cd app && npm run db:studio`
Check that existing time_entries have `topicId` populated.

**Step 6: Commit**

```bash
git add app/drizzle/
git commit -m "$(cat <<'EOF'
chore(db): add migration for topicId column with backfill

Backfills existing entries:
- Entries with subtopicId: derive topicId from subtopic's parent
- Entries without subtopicId: match topicId by topicName

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Update TimeEntry Type

**Files:**
- Modify: `app/src/types/index.ts:57-71`

**Step 1: Add topicId to TimeEntry interface**

```typescript
export interface TimeEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  clientId: string;
  client: {
    id: string;
    name: string;
  };
  topicId?: string | null;  // ADD THIS LINE
  subtopicId?: string | null;
  topicName: string;
  subtopicName: string;
  isLocked?: boolean;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add app/src/types/index.ts
git commit -m "$(cat <<'EOF'
feat(types): add topicId to TimeEntry interface

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update POST /api/timesheets

**Files:**
- Modify: `app/src/app/api/timesheets/route.ts:269-367`
- Test: `app/src/app/api/timesheets/route.test.ts`

**Step 1: Write failing test for topicId in response**

Add to `app/src/app/api/timesheets/route.test.ts` in the "Happy Path" describe block:

```typescript
it("returns topicId in response for regular entries", async () => {
  const user = createMockUser();
  setupAuthenticatedUser(user);
  mockDb.query.clients.findFirst.mockResolvedValue(mockActiveClient);
  mockDb.query.subtopics.findFirst.mockResolvedValue({
    ...mockActiveSubtopic,
    topicId: "topic-123",
  });

  const createdEntry = {
    id: "entry-123",
    date: "2024-12-20",
    hours: "2.5",
    description: "Test work",
    clientId: "client-123",
    topicId: "topic-123",
    subtopicId: "subtopic-123",
    topicName: "M&A Advisory",
    subtopicName: "Drafting documents",
    createdAt: "2024-12-20T10:00:00.000Z",
    updatedAt: "2024-12-20T10:00:00.000Z",
  };

  mockDb.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([createdEntry]),
    }),
  });

  mockDb.query.clients.findFirst
    .mockResolvedValueOnce(mockActiveClient)
    .mockResolvedValueOnce({ id: "client-123", name: "Test Client" });

  const request = createMockRequest({
    method: "POST",
    url: "/api/timesheets",
    body: validBody,
  });

  const response = await POST(request);
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data.topicId).toBe("topic-123");
});
```

**Step 2: Run test to verify it fails**

Run: `cd app && npm run test -- route.test.ts --run`
Expected: FAIL - topicId not in response

**Step 3: Update POST handler to store and return topicId**

In `app/src/app/api/timesheets/route.ts`, update the internal entry logic (around line 274-294):

```typescript
// Variables to hold topic/subtopic data for the entry
let topicName: string;
let subtopicName: string;
let finalSubtopicId: string | null;
let finalTopicId: string | null;  // ADD THIS

if (isInternalEntry) {
  // Internal/Management entries require topicId, no subtopicId
  if (!topicId) {
    return errorResponse("Topic is required for internal entries", 400);
  }
  const topic = await db.query.topics.findFirst({
    where: eq(topics.id, topicId),
    columns: { id: true, name: true, status: true, topicType: true },
  });
  if (!topic) {
    return errorResponse("Topic not found", 404);
  }
  if (topic.status !== "ACTIVE") {
    return errorResponse("Cannot log time with inactive topic", 400);
  }
  if (topic.topicType !== client.clientType) {
    return errorResponse("Topic type must match client type", 400);
  }
  topicName = topic.name;
  subtopicName = "";
  finalSubtopicId = null;
  finalTopicId = topicId;  // ADD THIS
} else {
  // Regular entries require subtopicId
  if (!subtopicId) {
    return errorResponse("Subtopic is required", 400);
  }
  const subtopic = await db.query.subtopics.findFirst({
    where: eq(subtopics.id, subtopicId),
    columns: {
      id: true,
      name: true,
      status: true,
      topicId: true,  // ADD THIS
    },
    with: {
      topic: {
        columns: { name: true, status: true },
      },
    },
  });
  if (!subtopic) {
    return errorResponse("Subtopic not found", 404);
  }
  if (subtopic.status !== "ACTIVE") {
    return errorResponse("Cannot log time with inactive subtopic", 400);
  }
  if (subtopic.topic.status !== "ACTIVE") {
    return errorResponse("Cannot log time with inactive topic", 400);
  }
  topicName = subtopic.topic.name;
  subtopicName = subtopic.name;
  finalSubtopicId = subtopicId;
  finalTopicId = subtopic.topicId;  // ADD THIS
}
```

Update the insert statement (around line 345-367):

```typescript
const [entry] = await db.insert(timeEntries).values({
  id: createId(),
  date: dateStr,
  hours: String(hoursNum),
  description: (description || "").trim(),
  userId: user.id,
  clientId: clientId,
  topicId: finalTopicId,  // ADD THIS
  subtopicId: finalSubtopicId,
  topicName: topicName,
  subtopicName: subtopicName,
  updatedAt: now,
}).returning({
  id: timeEntries.id,
  date: timeEntries.date,
  hours: timeEntries.hours,
  description: timeEntries.description,
  clientId: timeEntries.clientId,
  topicId: timeEntries.topicId,  // ADD THIS
  subtopicId: timeEntries.subtopicId,
  topicName: timeEntries.topicName,
  subtopicName: timeEntries.subtopicName,
  createdAt: timeEntries.createdAt,
  updatedAt: timeEntries.updatedAt,
});
```

**Step 4: Run test to verify it passes**

Run: `cd app && npm run test -- route.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add app/src/app/api/timesheets/route.ts app/src/app/api/timesheets/route.test.ts
git commit -m "$(cat <<'EOF'
feat(api): store and return topicId in POST /api/timesheets

- Derive topicId from subtopic for regular entries
- Use provided topicId for internal/management entries
- Include topicId in response

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Update GET /api/timesheets to return topicId

**Files:**
- Modify: `app/src/app/api/timesheets/route.ts:29-47,106-132`

**Step 1: Update serializeTimeEntry function**

```typescript
function serializeTimeEntry(entry: {
  id: string;
  date: string;
  hours: string;
  description: string;
  clientId: string;
  client: { id: string; name: string } | null;
  topicId: string | null;  // ADD THIS
  subtopicId: string | null;
  topicName: string;
  subtopicName: string;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    ...entry,
    hours: serializeDecimal(entry.hours),
  };
}
```

**Step 2: Update query to select topicId**

In the GET handler, update the findMany query (around line 111):

```typescript
const entries = await db.query.timeEntries.findMany({
  where: and(
    eq(timeEntries.userId, user.id),
    eq(timeEntries.date, dateStr)
  ),
  columns: {
    id: true,
    date: true,
    hours: true,
    description: true,
    clientId: true,
    topicId: true,  // ADD THIS
    subtopicId: true,
    topicName: true,
    subtopicName: true,
    createdAt: true,
    updatedAt: true,
  },
  with: {
    client: {
      columns: {
        id: true,
        name: true,
      },
    },
  },
  orderBy: [desc(timeEntries.createdAt)],
});
```

**Step 3: Run existing tests to verify no regressions**

Run: `cd app && npm run test -- route.test.ts --run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add app/src/app/api/timesheets/route.ts
git commit -m "$(cat <<'EOF'
feat(api): return topicId in GET /api/timesheets response

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Fix PATCH /api/timesheets/[id] - Handle null subtopicId

**Files:**
- Modify: `app/src/app/api/timesheets/[id]/route.ts:23-40,67,129-188`
- Test: `app/src/app/api/timesheets/[id]/route.test.ts`

**Step 1: Write failing test for topic-only update**

Add to `app/src/app/api/timesheets/[id]/route.test.ts`:

```typescript
describe("Topic-Only Entries", () => {
  it("allows updating to topic-only (subtopicId: null) when topicId is provided", async () => {
    const user = createMockUser({ id: "user-1" });
    const entry = createMockTimeEntry({
      id: "entry-1",
      userId: user.id,
      subtopicId: "old-subtopic",
      topicId: "old-topic",
      topicName: "Old Topic",
      subtopicName: "Old Subtopic",
    });

    const mockTopic = {
      id: "new-topic",
      name: "Internal Topic",
      status: "ACTIVE",
    };

    const updatedEntry = {
      ...entry,
      topicId: "new-topic",
      subtopicId: null,
      topicName: "Internal Topic",
      subtopicName: "",
      updatedAt: new Date().toISOString(),
    };

    setupAuthenticatedUser(user);
    mockDb.query.timeEntries.findFirst.mockResolvedValue(entry);
    mockDb.query.topics = { findFirst: vi.fn().mockResolvedValue(mockTopic) };
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updatedEntry]),
        }),
      }),
    });

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/timesheets/entry-1",
      body: { subtopicId: null, topicId: "new-topic" },
    });

    const response = await PATCH(request, { params: createParams("entry-1") });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.topicId).toBe("new-topic");
    expect(data.subtopicId).toBeNull();
    expect(data.topicName).toBe("Internal Topic");
    expect(data.subtopicName).toBe("");
  });

  it("returns 400 when subtopicId is null but topicId is not provided", async () => {
    const user = createMockUser({ id: "user-1" });
    const entry = createMockTimeEntry({
      id: "entry-1",
      userId: user.id,
    });

    setupAuthenticatedUser(user);
    mockDb.query.timeEntries.findFirst.mockResolvedValue(entry);

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/timesheets/entry-1",
      body: { subtopicId: null },
    });

    const response = await PATCH(request, { params: createParams("entry-1") });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("topicId is required when clearing subtopicId");
  });

  it("returns 404 when topicId does not exist", async () => {
    const user = createMockUser({ id: "user-1" });
    const entry = createMockTimeEntry({
      id: "entry-1",
      userId: user.id,
    });

    setupAuthenticatedUser(user);
    mockDb.query.timeEntries.findFirst.mockResolvedValue(entry);
    mockDb.query.topics = { findFirst: vi.fn().mockResolvedValue(null) };

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/timesheets/entry-1",
      body: { subtopicId: null, topicId: "nonexistent" },
    });

    const response = await PATCH(request, { params: createParams("entry-1") });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Topic not found");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd app && npm run test -- "[id]/route.test.ts" --run`
Expected: FAIL - "Subtopic not found" instead of expected behavior

**Step 3: Update serializeTimeEntry in PATCH route**

Update `app/src/app/api/timesheets/[id]/route.ts` serializeTimeEntry function:

```typescript
function serializeTimeEntry(entry: {
  id: string;
  date: string;
  hours: string;
  description: string;
  clientId: string;
  client: { id: string; name: string } | null;
  topicId: string | null;  // ADD THIS
  subtopicId: string | null;
  topicName: string;
  subtopicName: string;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    ...entry,
    hours: serializeDecimal(entry.hours),
  };
}
```

**Step 4: Update imports to include topics**

At top of file, ensure `topics` is imported:

```typescript
import {
  timeEntries,
  clients,
  subtopics,
  topics,  // ADD THIS if not present
  serviceDescriptionLineItems,
  serviceDescriptionTopics,
  serviceDescriptions,
  timesheetSubmissions,
} from "@/lib/schema";
```

**Step 5: Extract topicId from request body**

Update line 67:

```typescript
const { hours, description, subtopicId, topicId, clientId } = body;
```

**Step 6: Update updateData type**

Update the updateData type (around line 130):

```typescript
const updateData: {
  hours?: string;
  description?: string;
  topicId?: string | null;  // ADD THIS
  subtopicId?: string | null;  // CHANGE from string to string | null
  topicName?: string;
  subtopicName?: string;
  clientId?: string;
  updatedAt: string;
} = {
  updatedAt: new Date().toISOString(),
};
```

**Step 7: Rewrite subtopicId/topicId handling logic**

Replace the subtopicId handling block (lines 159-188) with:

```typescript
// Handle subtopicId changes
if (subtopicId !== undefined) {
  if (subtopicId === null) {
    // Clearing subtopic - require topicId to be provided
    if (topicId === undefined || topicId === null) {
      return errorResponse("topicId is required when clearing subtopicId", 400);
    }

    // Look up the topic
    const topic = await db.query.topics.findFirst({
      where: eq(topics.id, topicId),
      columns: { id: true, name: true, status: true },
    });

    if (!topic) {
      return errorResponse("Topic not found", 404);
    }
    if (topic.status !== "ACTIVE") {
      return errorResponse("Cannot use inactive topic", 400);
    }

    updateData.topicId = topicId;
    updateData.topicName = topic.name;
    updateData.subtopicId = null;
    updateData.subtopicName = "";
  } else {
    // Setting a subtopic - look it up and derive topic from it
    const subtopic = await db.query.subtopics.findFirst({
      where: eq(subtopics.id, subtopicId),
      columns: {
        id: true,
        name: true,
        status: true,
        topicId: true,
      },
      with: {
        topic: {
          columns: { name: true, status: true },
        },
      },
    });

    if (!subtopic) {
      return errorResponse("Subtopic not found", 404);
    }
    if (subtopic.status !== "ACTIVE") {
      return errorResponse("Cannot use inactive subtopic", 400);
    }
    if (subtopic.topic.status !== "ACTIVE") {
      return errorResponse("Cannot use subtopic with inactive topic", 400);
    }

    updateData.topicId = subtopic.topicId;
    updateData.subtopicId = subtopicId;
    updateData.topicName = subtopic.topic.name;
    updateData.subtopicName = subtopic.name;
  }
} else if (topicId !== undefined) {
  // Only topicId provided (no subtopicId change) - just update topicId/topicName
  const topic = await db.query.topics.findFirst({
    where: eq(topics.id, topicId),
    columns: { id: true, name: true, status: true },
  });

  if (!topic) {
    return errorResponse("Topic not found", 404);
  }
  if (topic.status !== "ACTIVE") {
    return errorResponse("Cannot use inactive topic", 400);
  }

  updateData.topicId = topicId;
  updateData.topicName = topic.name;
}
```

**Step 8: Update returning clause to include topicId**

Update the returning clause (around line 212):

```typescript
.returning({
  id: timeEntries.id,
  date: timeEntries.date,
  hours: timeEntries.hours,
  description: timeEntries.description,
  clientId: timeEntries.clientId,
  topicId: timeEntries.topicId,  // ADD THIS
  subtopicId: timeEntries.subtopicId,
  topicName: timeEntries.topicName,
  subtopicName: timeEntries.subtopicName,
  createdAt: timeEntries.createdAt,
  updatedAt: timeEntries.updatedAt,
});
```

**Step 9: Run tests to verify they pass**

Run: `cd app && npm run test -- "[id]/route.test.ts" --run`
Expected: All tests pass

**Step 10: Run all timesheet tests**

Run: `cd app && npm run test -- timesheets --run`
Expected: All tests pass

**Step 11: Commit**

```bash
git add app/src/app/api/timesheets/[id]/route.ts app/src/app/api/timesheets/[id]/route.test.ts
git commit -m "$(cat <<'EOF'
fix(api): handle null subtopicId in PATCH /api/timesheets/[id]

- Allow subtopicId: null when topicId is provided (topic-only entries)
- Derive topicId from subtopic when subtopicId is set
- Return topicId in response
- Add tests for topic-only entry updates

Fixes bug where editing internal/management entries failed with
"Subtopic not found".

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Update mock factories for tests

**Files:**
- Modify: `app/src/test/mocks/factories.ts`

**Step 1: Add topicId to createMockTimeEntry**

Find the `createMockTimeEntry` function and add `topicId`:

```typescript
export function createMockTimeEntry(overrides: Partial<MockTimeEntry> = {}): MockTimeEntry {
  return {
    id: `entry-${Date.now()}`,
    date: "2024-12-20",
    hours: "2.5",
    description: "Test work",
    userId: "user-123",
    clientId: "client-123",
    client: { id: "client-123", name: "Test Client" },
    topicId: "topic-123",  // ADD THIS
    subtopicId: "subtopic-123",
    topicName: "M&A Advisory",
    subtopicName: "Drafting documents",
    createdAt: "2024-12-20T10:00:00.000Z",
    updatedAt: "2024-12-20T10:00:00.000Z",
    ...overrides,
  };
}
```

**Step 2: Update MockTimeEntry type if it exists**

```typescript
export interface MockTimeEntry {
  id: string;
  date: string;
  hours: string;
  description: string;
  userId: string;
  clientId: string;
  client: { id: string; name: string };
  topicId: string | null;  // ADD THIS
  subtopicId: string | null;
  topicName: string;
  subtopicName: string;
  createdAt: string;
  updatedAt: string;
}
```

**Step 3: Run all tests**

Run: `cd app && npm run test -- --run`
Expected: All tests pass

**Step 4: Commit**

```bash
git add app/src/test/mocks/factories.ts
git commit -m "$(cat <<'EOF'
test: add topicId to mock time entry factory

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Final Verification

**Step 1: Run all tests**

Run: `cd app && npm run test -- --run`
Expected: All tests pass

**Step 2: Run linter**

Run: `cd app && npm run lint`
Expected: No errors

**Step 3: Build the application**

Run: `cd app && npm run build`
Expected: Build succeeds

**Step 4: Manual testing (optional)**

1. Start dev server: `cd app && npm run dev`
2. Create a time entry for a regular client (with subtopic) - verify it works
3. Create a time entry for an internal client (topic only) - verify it works
4. Edit a regular entry - verify it works
5. Edit an internal entry - verify the bug is fixed (no "Subtopic not found")
6. Edit a regular entry to become topic-only - verify it works

**Step 5: Final commit if any changes needed**

If any fixes were needed during verification, commit them.

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Update schema | `schema.ts` |
| 2 | Generate migration with backfill | `drizzle/migrations/` |
| 3 | Update TimeEntry type | `types/index.ts` |
| 4 | Update POST endpoint | `route.ts`, `route.test.ts` |
| 5 | Update GET endpoint | `route.ts` |
| 6 | Fix PATCH endpoint (main bug fix) | `[id]/route.ts`, `[id]/route.test.ts` |
| 7 | Update test factories | `factories.ts` |
| 8 | Final verification | - |
