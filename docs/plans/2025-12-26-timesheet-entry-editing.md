# Timesheet Entry Editing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow employees to edit their own time entries inline, with billing lock protection.

**Architecture:** Add PATCH endpoint for updates, extend TimeEntry type with `isLocked`, modify EntryRow to toggle between display/edit modes using the existing EntryForm component inline.

**Tech Stack:** Next.js API routes, Drizzle ORM, React, Vitest

---

## Task 1: Add `isLocked` to TimeEntry Type

**Files:**
- Modify: `app/src/types/index.ts:39-52`

**Step 1: Update TimeEntry interface**

Add optional `isLocked` field to TimeEntry:

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
  subtopicId?: string | null;
  topicName: string;
  subtopicName: string;
  isLocked?: boolean;
}
```

**Step 2: Verify no type errors**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add app/src/types/index.ts
git commit -m "feat(types): add isLocked to TimeEntry for billing protection"
```

---

## Task 2: Create PATCH API Endpoint Tests

**Files:**
- Create: `app/src/app/api/timesheets/[id]/route.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser, createMockTimeEntry } from "@/test/mocks/factories";

const { mockRequireAuth, mockGetUserFromSession, mockDb } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockGetUserFromSession: vi.fn(),
  mockDb: {
    query: {
      timeEntries: { findFirst: vi.fn() },
      clients: { findFirst: vi.fn() },
      subtopics: { findFirst: vi.fn() },
    },
    select: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...original,
    requireAuth: mockRequireAuth,
    getUserFromSession: mockGetUserFromSession,
  };
});

import { PATCH } from "./route";

function setupAuthenticatedUser(user: ReturnType<typeof createMockUser>) {
  mockRequireAuth.mockResolvedValue({
    session: { user: { name: user.name, email: user.email } },
  });
  mockGetUserFromSession.mockResolvedValue({
    id: user.id,
    email: user.email,
    name: user.name,
    position: user.position,
  });
}

describe("PATCH /api/timesheets/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { hours: 2 },
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "entry-1" }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("Authorization", () => {
    it("returns 404 when entry not found", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue(null);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/nonexistent",
        body: { hours: 2 },
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "nonexistent" }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Entry not found");
    });

    it("returns 403 when editing another user's entry", async () => {
      const user = createMockUser({ id: "user-1" });
      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue({
        id: "entry-1",
        userId: "other-user",
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { hours: 2 },
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "entry-1" }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("You can only edit your own entries");
    });

    it("returns 403 when entry is linked to finalized service description", async () => {
      const user = createMockUser({ id: "user-1" });
      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue({
        id: "entry-1",
        userId: "user-1",
        hours: "2.0",
        description: "Test",
        clientId: "client-1",
        subtopicId: "subtopic-1",
      });
      // Mock billing check - entry is billed
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ status: "FINALIZED" }]),
              }),
            }),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { hours: 3 },
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "entry-1" }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("This entry has been billed and cannot be edited");
    });
  });

  describe("Validation", () => {
    it("returns 400 when hours is zero", async () => {
      const user = createMockUser({ id: "user-1" });
      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue({
        id: "entry-1",
        userId: "user-1",
      });
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { hours: 0 },
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "entry-1" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Hours must be between 0 and 12");
    });

    it("returns 400 when hours exceeds maximum", async () => {
      const user = createMockUser({ id: "user-1" });
      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue({
        id: "entry-1",
        userId: "user-1",
      });
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { hours: 15 },
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "entry-1" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Hours must be between 0 and 12");
    });
  });

  describe("Happy Path", () => {
    const mockActiveClient = { id: "client-1", name: "Acme Corp", status: "ACTIVE" };
    const mockActiveSubtopic = {
      id: "subtopic-1",
      name: "Drafting",
      status: "ACTIVE",
      topic: { name: "M&A", status: "ACTIVE" },
    };

    it("updates entry with new hours", async () => {
      const user = createMockUser({ id: "user-1" });
      setupAuthenticatedUser(user);

      const existingEntry = {
        id: "entry-1",
        userId: "user-1",
        hours: "2.0",
        description: "Test",
        clientId: "client-1",
        subtopicId: "subtopic-1",
        topicName: "M&A",
        subtopicName: "Drafting",
        date: "2024-12-20",
        createdAt: "2024-12-20T10:00:00Z",
        updatedAt: "2024-12-20T10:00:00Z",
      };

      mockDb.query.timeEntries.findFirst.mockResolvedValue(existingEntry);
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      const updatedEntry = { ...existingEntry, hours: "3.0" };
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedEntry]),
          }),
        }),
      });

      mockDb.query.clients.findFirst.mockResolvedValue({ id: "client-1", name: "Acme Corp" });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { hours: 3 },
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "entry-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hours).toBe(3);
    });

    it("updates topicName and subtopicName when subtopicId changes", async () => {
      const user = createMockUser({ id: "user-1" });
      setupAuthenticatedUser(user);

      const existingEntry = {
        id: "entry-1",
        userId: "user-1",
        hours: "2.0",
        description: "Test",
        clientId: "client-1",
        subtopicId: "subtopic-1",
        topicName: "M&A",
        subtopicName: "Drafting",
        date: "2024-12-20",
        createdAt: "2024-12-20T10:00:00Z",
        updatedAt: "2024-12-20T10:00:00Z",
      };

      mockDb.query.timeEntries.findFirst.mockResolvedValue(existingEntry);
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      });

      mockDb.query.subtopics.findFirst.mockResolvedValue({
        id: "subtopic-2",
        name: "Client calls",
        status: "ACTIVE",
        topic: { name: "General", status: "ACTIVE" },
      });

      const updatedEntry = {
        ...existingEntry,
        subtopicId: "subtopic-2",
        topicName: "General",
        subtopicName: "Client calls",
      };
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedEntry]),
          }),
        }),
      });

      mockDb.query.clients.findFirst.mockResolvedValue({ id: "client-1", name: "Acme Corp" });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { subtopicId: "subtopic-2" },
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: "entry-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.topicName).toBe("General");
      expect(data.subtopicName).toBe("Client calls");
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd app && npm run test -- [id]/route.test.ts --run`
Expected: FAIL with "Cannot find module './route'"

**Step 3: Commit**

```bash
git add app/src/app/api/timesheets/[id]/route.test.ts
git commit -m "test(api): add PATCH /api/timesheets/[id] tests"
```

---

## Task 3: Implement PATCH API Endpoint

**Files:**
- Create: `app/src/app/api/timesheets/[id]/route.ts`

**Step 1: Write the PATCH endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  timeEntries,
  clients,
  subtopics,
  serviceDescriptionLineItems,
  serviceDescriptionTopics,
  serviceDescriptions,
} from "@/lib/schema";
import {
  requireAuth,
  getUserFromSession,
  errorResponse,
  serializeDecimal,
  isValidHours,
  MAX_HOURS_PER_ENTRY,
} from "@/lib/api-utils";

function serializeTimeEntry(entry: {
  id: string;
  date: string;
  hours: string;
  description: string;
  clientId: string;
  client: { id: string; name: string } | null;
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

async function isEntryBilled(entryId: string): Promise<boolean> {
  const billedEntry = await db
    .select({ status: serviceDescriptions.status })
    .from(serviceDescriptionLineItems)
    .innerJoin(
      serviceDescriptionTopics,
      eq(serviceDescriptionLineItems.topicId, serviceDescriptionTopics.id)
    )
    .innerJoin(
      serviceDescriptions,
      eq(serviceDescriptionTopics.serviceDescriptionId, serviceDescriptions.id)
    )
    .where(
      and(
        eq(serviceDescriptionLineItems.timeEntryId, entryId),
        eq(serviceDescriptions.status, "FINALIZED")
      )
    )
    .limit(1);

  return billedEntry.length > 0;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await params;

  // Find existing entry
  const existingEntry = await db.query.timeEntries.findFirst({
    where: eq(timeEntries.id, id),
  });

  if (!existingEntry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  // Check ownership
  if (existingEntry.userId !== user.id) {
    return NextResponse.json(
      { error: "You can only edit your own entries" },
      { status: 403 }
    );
  }

  // Check if billed
  if (await isEntryBilled(id)) {
    return NextResponse.json(
      { error: "This entry has been billed and cannot be edited" },
      { status: 403 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { clientId, subtopicId, hours, description } = body;

  // Build update object
  const updates: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  // Validate and set clientId if provided
  if (clientId !== undefined) {
    const client = await db.query.clients.findFirst({
      where: eq(clients.id, clientId),
      columns: { id: true, status: true },
    });
    if (!client) {
      return errorResponse("Client not found", 404);
    }
    if (client.status !== "ACTIVE") {
      return errorResponse("Cannot use inactive client", 400);
    }
    updates.clientId = clientId;
  }

  // Validate and set subtopicId if provided
  if (subtopicId !== undefined) {
    if (subtopicId === null) {
      updates.subtopicId = null;
      updates.topicName = "";
      updates.subtopicName = "";
    } else {
      const subtopic = await db.query.subtopics.findFirst({
        where: eq(subtopics.id, subtopicId),
        columns: { id: true, name: true, status: true },
        with: { topic: { columns: { name: true, status: true } } },
      });
      if (!subtopic) {
        return errorResponse("Subtopic not found", 404);
      }
      if (subtopic.status !== "ACTIVE") {
        return errorResponse("Cannot use inactive subtopic", 400);
      }
      if (subtopic.topic.status !== "ACTIVE") {
        return errorResponse("Cannot use inactive topic", 400);
      }
      updates.subtopicId = subtopicId;
      updates.topicName = subtopic.topic.name;
      updates.subtopicName = subtopic.name;
    }
  }

  // Validate and set hours if provided
  if (hours !== undefined) {
    const hoursNum = Number(hours);
    if (!isValidHours(hoursNum)) {
      return errorResponse(`Hours must be between 0 and ${MAX_HOURS_PER_ENTRY}`, 400);
    }
    updates.hours = String(hoursNum);
  }

  // Set description if provided
  if (description !== undefined) {
    if (typeof description !== "string") {
      return errorResponse("Description must be a string", 400);
    }
    updates.description = description.trim();
  }

  try {
    const [updatedEntry] = await db
      .update(timeEntries)
      .set(updates)
      .where(eq(timeEntries.id, id))
      .returning({
        id: timeEntries.id,
        date: timeEntries.date,
        hours: timeEntries.hours,
        description: timeEntries.description,
        clientId: timeEntries.clientId,
        subtopicId: timeEntries.subtopicId,
        topicName: timeEntries.topicName,
        subtopicName: timeEntries.subtopicName,
        createdAt: timeEntries.createdAt,
        updatedAt: timeEntries.updatedAt,
      });

    // Fetch client for response
    const entryClient = await db.query.clients.findFirst({
      where: eq(clients.id, updatedEntry.clientId),
      columns: { id: true, name: true },
    });

    return NextResponse.json(
      serializeTimeEntry({
        ...updatedEntry,
        client: entryClient ?? null,
      })
    );
  } catch (error) {
    console.error("Database error updating time entry:", error);
    return NextResponse.json(
      { error: "Failed to update time entry" },
      { status: 500 }
    );
  }
}
```

**Step 2: Run tests to verify they pass**

Run: `cd app && npm run test -- [id]/route.test.ts --run`
Expected: All tests PASS

**Step 3: Commit**

```bash
git add app/src/app/api/timesheets/[id]/route.ts
git commit -m "feat(api): implement PATCH /api/timesheets/[id] for editing entries"
```

---

## Task 4: Add `isLocked` Computation to GET Response

**Files:**
- Modify: `app/src/app/api/timesheets/route.ts`

**Step 1: Add isEntryBilled helper and extend GET response**

Import the billing tables at the top:

```typescript
import {
  timeEntries,
  clients,
  subtopics,
  users,
  serviceDescriptionLineItems,
  serviceDescriptionTopics,
  serviceDescriptions,
} from "@/lib/schema";
```

Add helper function after imports:

```typescript
async function getLockedEntryIds(entryIds: string[]): Promise<Set<string>> {
  if (entryIds.length === 0) return new Set();

  const billedEntries = await db
    .select({ timeEntryId: serviceDescriptionLineItems.timeEntryId })
    .from(serviceDescriptionLineItems)
    .innerJoin(
      serviceDescriptionTopics,
      eq(serviceDescriptionLineItems.topicId, serviceDescriptionTopics.id)
    )
    .innerJoin(
      serviceDescriptions,
      eq(serviceDescriptionTopics.serviceDescriptionId, serviceDescriptions.id)
    )
    .where(
      and(
        sql`${serviceDescriptionLineItems.timeEntryId} IN (${sql.join(
          entryIds.map((id) => sql`${id}`),
          sql`, `
        )})`,
        eq(serviceDescriptions.status, "FINALIZED")
      )
    );

  return new Set(billedEntries.map((e) => e.timeEntryId).filter(Boolean) as string[]);
}
```

Modify the serialization in GET to include isLocked:

```typescript
// After fetching entries, before returning:
const entryIds = entries.map((e) => e.id);
const lockedIds = await getLockedEntryIds(entryIds);

const serializedEntries = entries.map((entry) => ({
  ...serializeTimeEntry(entry),
  isLocked: lockedIds.has(entry.id),
}));
```

**Step 2: Run existing tests**

Run: `cd app && npm run test -- route.test.ts --run`
Expected: All tests PASS (existing tests don't check for isLocked)

**Step 3: Commit**

```bash
git add app/src/app/api/timesheets/route.ts
git commit -m "feat(api): add isLocked field to GET /api/timesheets response"
```

---

## Task 5: Add Edit Mode Props to EntryForm

**Files:**
- Modify: `app/src/components/timesheets/EntryForm.tsx`

**Step 1: Extend EntryFormProps interface**

Update the interface to support edit mode:

```typescript
interface EntryFormProps {
  clients: Client[];
  topics: Topic[];
  formData: FormData;
  isLoading: boolean;
  error: string | null;
  onFormChange: (updates: Partial<FormData>) => void;
  onSubmit: () => void;
  // Edit mode props
  isEditMode?: boolean;
  onCancel?: () => void;
}
```

**Step 2: Update component to accept new props**

```typescript
export function EntryForm({
  clients,
  topics,
  formData,
  isLoading,
  error,
  onFormChange,
  onSubmit,
  isEditMode = false,
  onCancel,
}: EntryFormProps) {
```

**Step 3: Update the submit button and add cancel button**

Replace the submit button section with:

```typescript
{/* Action Buttons */}
<div className="flex items-center gap-2">
  {isEditMode && onCancel && (
    <button
      type="button"
      onClick={onCancel}
      className="
        px-3 py-2 rounded flex-shrink-0
        text-[var(--text-secondary)] text-sm
        bg-[var(--bg-surface)] border border-[var(--border-subtle)]
        hover:border-[var(--border-accent)]
        transition-colors
      "
    >
      Cancel
    </button>
  )}
  <button
    onClick={onSubmit}
    disabled={!canSubmit || isLoading}
    className="
      px-4 py-2 rounded flex-shrink-0
      bg-[var(--accent-pink)] text-[var(--bg-deep)]
      font-semibold text-sm
      hover:bg-[var(--accent-pink-dim)]
      disabled:opacity-50 disabled:cursor-not-allowed
      transition-all duration-200
      shadow-lg shadow-[var(--accent-pink-glow)]
    "
  >
    {isLoading ? "..." : isEditMode ? "Save" : "Log"}
  </button>
</div>
```

**Step 4: Verify no type errors**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add app/src/components/timesheets/EntryForm.tsx
git commit -m "feat(EntryForm): add edit mode with cancel button and Save label"
```

---

## Task 6: Add Edit Button and Inline Edit to EntryRow

**Files:**
- Modify: `app/src/components/timesheets/EntryRow.tsx`

**Step 1: Extend props interface**

```typescript
import { useState, useMemo } from "react";
import { formatHours, toHoursAndMinutes } from "@/lib/date-utils";
import { EntryForm } from "./EntryForm";
import type { TimeEntry, Client, Topic, FormData } from "@/types";

interface EntryRowProps {
  entry: TimeEntry;
  onDeleteClick?: () => void;
  onUpdate?: (updatedEntry: TimeEntry) => void;
  readOnly?: boolean;
  clients?: Client[];
  topics?: Topic[];
}
```

**Step 2: Rewrite the component with inline edit mode**

```typescript
export function EntryRow({
  entry,
  onDeleteClick,
  onUpdate,
  readOnly = false,
  clients = [],
  topics = [],
}: EntryRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convert entry to form data for editing
  const initialFormData = useMemo((): FormData => {
    const { hours, minutes } = toHoursAndMinutes(entry.hours);
    return {
      clientId: entry.clientId,
      subtopicId: entry.subtopicId || "",
      hours,
      minutes,
      description: entry.description,
    };
  }, [entry]);

  const [formData, setFormData] = useState<FormData>(initialFormData);

  const handleFormChange = (updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);

    const totalHours = formData.hours + formData.minutes / 60;

    try {
      const response = await fetch(`/api/timesheets/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: formData.clientId,
          subtopicId: formData.subtopicId || null,
          hours: totalHours,
          description: formData.description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update entry");
        return;
      }

      onUpdate?.(data);
      setIsEditing(false);
    } catch {
      setError("Failed to update entry");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData(initialFormData);
    setError(null);
    setIsEditing(false);
  };

  const handleEditClick = () => {
    setFormData(initialFormData);
    setIsEditing(true);
  };

  // Editing mode - show inline form
  if (isEditing) {
    return (
      <tr>
        <td colSpan={5} className="p-2">
          <EntryForm
            clients={clients}
            topics={topics}
            formData={formData}
            isLoading={isLoading}
            error={error}
            onFormChange={handleFormChange}
            onSubmit={handleSave}
            isEditMode
            onCancel={handleCancel}
          />
        </td>
      </tr>
    );
  }

  // Display mode
  return (
    <tr className="hover:bg-[var(--bg-hover)] transition-colors">
      <td
        className="px-4 py-3 text-[13px] text-[var(--text-secondary)] truncate max-w-[150px]"
        title={entry.client.name}
      >
        {entry.client.name}
      </td>
      <td
        className="px-4 py-3 text-[13px] text-[var(--text-secondary)] truncate max-w-[180px]"
        title={entry.topicName || undefined}
      >
        {entry.topicName || "—"}
      </td>
      <td className="px-4 py-3 text-[13px] text-[var(--text-secondary)] text-right whitespace-nowrap">
        {formatHours(entry.hours)}
      </td>
      <td className="px-4 py-3 text-[13px] text-[var(--text-secondary)]">
        {entry.description}
      </td>
      {!readOnly && (
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            {/* Edit Button */}
            <button
              onClick={handleEditClick}
              disabled={entry.isLocked}
              className={`
                p-1.5 rounded-sm transition-colors
                ${entry.isLocked
                  ? "text-[var(--text-muted)] opacity-50 cursor-not-allowed"
                  : "text-[var(--text-muted)] hover:text-[var(--accent-pink)] hover:bg-[var(--accent-pink-glow)]"
                }
              `}
              title={entry.isLocked ? "This entry has been billed and cannot be edited" : "Edit entry"}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            {/* Delete Button */}
            <button
              onClick={onDeleteClick}
              className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
              title="Delete entry"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}
```

**Step 3: Add toHoursAndMinutes to date-utils**

Check if it exists, if not add to `app/src/lib/date-utils.ts`:

```typescript
export function toHoursAndMinutes(decimalHours: number): { hours: number; minutes: number } {
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  return { hours, minutes };
}
```

**Step 4: Verify no type errors**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add app/src/components/timesheets/EntryRow.tsx app/src/lib/date-utils.ts
git commit -m "feat(EntryRow): add inline edit mode with EntryForm"
```

---

## Task 7: Pass clients/topics to EntriesList and Handle Updates

**Files:**
- Modify: `app/src/components/timesheets/EntriesList.tsx`

**Step 1: Extend props interface**

```typescript
interface EntriesListProps {
  entries: TimeEntry[];
  isLoadingEntries: boolean;
  onDeleteEntry?: (entryId: string) => void;
  onUpdateEntry?: (updatedEntry: TimeEntry) => void;
  readOnly?: boolean;
  clients?: Client[];
  topics?: Topic[];
}
```

**Step 2: Update component and pass props to EntryRow**

Add imports at top:

```typescript
import type { TimeEntry, Client, Topic } from "@/types";
```

Update component signature:

```typescript
export function EntriesList({
  entries,
  isLoadingEntries,
  onDeleteEntry,
  onUpdateEntry,
  readOnly = false,
  clients = [],
  topics = [],
}: EntriesListProps) {
```

Update EntryRow usage:

```typescript
{entries.map((entry) => (
  <EntryRow
    key={entry.id}
    entry={entry}
    onDeleteClick={readOnly ? undefined : () => setEntryToDelete(entry)}
    onUpdate={onUpdateEntry}
    readOnly={readOnly}
    clients={clients}
    topics={topics}
  />
))}
```

**Step 3: Verify no type errors**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add app/src/components/timesheets/EntriesList.tsx
git commit -m "feat(EntriesList): pass clients/topics for inline editing"
```

---

## Task 8: Wire Up Editing in TimesheetsContent

**Files:**
- Modify: `app/src/components/timesheets/TimesheetsContent.tsx`

**Step 1: Add updateEntry handler**

After the deleteEntry handler, add:

```typescript
const updateEntry = useCallback((updatedEntry: TimeEntry) => {
  setEntries((prev) =>
    prev.map((e) => (e.id === updatedEntry.id ? updatedEntry : e))
  );
}, []);
```

**Step 2: Pass props to EntriesList**

Update the EntriesList usage:

```typescript
<EntriesList
  entries={entries}
  isLoadingEntries={isLoadingEntries}
  onDeleteEntry={deleteEntry}
  onUpdateEntry={updateEntry}
  clients={clients}
  topics={topics}
/>
```

**Step 3: Verify no type errors**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add app/src/components/timesheets/TimesheetsContent.tsx
git commit -m "feat(TimesheetsContent): wire up entry editing"
```

---

## Task 9: Update CLAUDE.md Documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update the Time Entry Immutability section**

Replace the existing section with:

```markdown
### Time Entry Editing
Time entries can be edited by their owner via `PATCH /api/timesheets/[id]`. Editable fields: client, topic/subtopic, hours, description. Date cannot be changed.

**Billing Lock:** Entries linked to a finalized service description cannot be edited. The `isLocked` field in the GET response indicates this state.
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update Time Entry Immutability section for editing support"
```

---

## Task 10: Run Full Test Suite and Build

**Step 1: Run all tests**

Run: `cd app && npm run test -- --run`
Expected: All tests pass

**Step 2: Run build**

Run: `cd app && npm run build`
Expected: Build succeeds

**Step 3: Run lint**

Run: `cd app && npm run lint`
Expected: No errors

**Step 4: Final commit if any fixes needed**

If fixes were required, commit them with appropriate message.

---

## Summary

Total tasks: 10
Estimated commits: 10-11

Key changes:
1. Types: Add `isLocked` to TimeEntry
2. API: New PATCH endpoint + isLocked in GET response
3. Components: EntryForm edit mode, EntryRow inline editing, EntriesList/TimesheetsContent wiring
4. Docs: Update CLAUDE.md
