# Timesheet Topics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add predefined work topics to timesheet entries with admin management, auto-cascade form flow, and Enter key submission.

**Architecture:** Database-managed topics with CRUD API, new TopicSelect component with ref-based auto-open, updated EntryForm with 4-field cascade (Client→Topic→Duration→Description), and dedicated admin page at /topics.

**Tech Stack:** Prisma 7 (PostgreSQL), Next.js 16 App Router, TypeScript, Tailwind CSS v4

---

## Task 1: Database Schema - Add Topic Model

**Files:**
- Modify: `app/prisma/schema.prisma`

**Step 1: Add TopicStatus enum and Topic model**

Add after the `ClientStatus` enum (around line 68):

```prisma
enum TopicStatus {
  ACTIVE
  INACTIVE
}

model Topic {
  id           String      @id @default(cuid())
  name         String
  code         String      @unique
  displayOrder Int         @default(0)
  status       TopicStatus @default(ACTIVE)

  timeEntries  TimeEntry[]

  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@map("topics")
}
```

**Step 2: Add topicId to TimeEntry model**

In the TimeEntry model (around line 84), add after `clientId`:

```prisma
  topicId       String?
  topic         Topic?    @relation(fields: [topicId], references: [id])
```

Add index after existing indexes:

```prisma
  @@index([topicId])
```

**Step 3: Generate Prisma client and create migration**

Run:
```bash
cd app && npm run db:generate
```
Expected: Prisma client generated successfully

Run:
```bash
cd app && npm run db:migrate -- --name add_topics
```
Expected: Migration created and applied

**Step 4: Commit**

```bash
git add app/prisma/
git commit -m "feat(db): add Topic model and topicId to TimeEntry"
```

---

## Task 2: Seed Initial Topics

**Files:**
- Create: `app/prisma/seed-topics.ts`

**Step 1: Create seed script**

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const topics = [
  { code: "ONB", name: "Onboarding & Intake", displayOrder: 1 },
  { code: "MTG", name: "Client Meetings/Calls", displayOrder: 2 },
  { code: "COM", name: "Client Emails & Messages", displayOrder: 3 },
  { code: "RES", name: "Legal Research", displayOrder: 4 },
  { code: "EMP", name: "Employment: Advisory & Docs", displayOrder: 5 },
];

async function main() {
  console.log("Seeding topics...");

  for (const topic of topics) {
    await prisma.topic.upsert({
      where: { code: topic.code },
      update: { name: topic.name, displayOrder: topic.displayOrder },
      create: topic,
    });
    console.log(`  ✓ ${topic.code}: ${topic.name}`);
  }

  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

**Step 2: Run seed script**

Run:
```bash
cd app && npx tsx prisma/seed-topics.ts
```
Expected: 5 topics created

**Step 3: Verify in database**

Run:
```bash
cd app && npx prisma studio
```
Expected: Topics table shows 5 entries

**Step 4: Commit**

```bash
git add app/prisma/seed-topics.ts
git commit -m "feat(db): add topic seed script with initial 5 topics"
```

---

## Task 3: Add Topic Type Definitions

**Files:**
- Modify: `app/src/types/index.ts`

**Step 1: Add Topic interface**

Add after Client interface:

```typescript
/**
 * Topic for categorizing time entries.
 */
export interface Topic {
  id: string;
  name: string;
  code: string;
}
```

**Step 2: Update TimeEntry interface**

Add `topic` field to TimeEntry (optional for legacy entries):

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
    timesheetCode: string;
  };
  topicId?: string | null;
  topic?: {
    id: string;
    name: string;
    code: string;
  } | null;
}
```

**Step 3: Update FormData interface**

Add `topicId` field:

```typescript
export interface FormData {
  clientId: string;
  topicId: string;
  hours: number;
  minutes: number;
  description: string;
}
```

**Step 4: Update initialFormData**

```typescript
export const initialFormData: FormData = {
  clientId: "",
  topicId: "",
  hours: 1,
  minutes: 0,
  description: "",
};
```

**Step 5: Commit**

```bash
git add app/src/types/index.ts
git commit -m "feat(types): add Topic interface and topicId to FormData"
```

---

## Task 4: Topics API - GET and POST

**Files:**
- Create: `app/src/app/api/topics/route.ts`

**Step 1: Create topics API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireWriteAccess, errorResponse } from "@/lib/api-utils";

// GET /api/topics - List topics
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  try {
    const topics = await db.topic.findMany({
      where: includeInactive ? {} : { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        code: true,
        displayOrder: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json(
      topics.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Database error fetching topics:", error);
    return errorResponse("Failed to fetch topics", 500);
  }
}

// POST /api/topics - Create topic (admin only)
export async function POST(request: NextRequest) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { name, code } = body;

  // Validate name
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return errorResponse("Name is required", 400);
  }
  if (name.trim().length > 100) {
    return errorResponse("Name must be 100 characters or less", 400);
  }

  // Validate code
  if (!code || typeof code !== "string" || code.trim().length === 0) {
    return errorResponse("Code is required", 400);
  }
  if (code.trim().length > 10) {
    return errorResponse("Code must be 10 characters or less", 400);
  }
  if (!/^[A-Z0-9]+$/.test(code.trim())) {
    return errorResponse("Code must be uppercase letters and numbers only", 400);
  }

  // Check for duplicate code
  const existing = await db.topic.findUnique({
    where: { code: code.trim() },
  });
  if (existing) {
    return errorResponse("A topic with this code already exists", 400);
  }

  // Get next display order
  const maxOrder = await db.topic.aggregate({
    _max: { displayOrder: true },
  });
  const nextOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  try {
    const topic = await db.topic.create({
      data: {
        name: name.trim(),
        code: code.trim(),
        displayOrder: nextOrder,
      },
      select: {
        id: true,
        name: true,
        code: true,
        displayOrder: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ...topic,
      createdAt: topic.createdAt.toISOString(),
      updatedAt: topic.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Database error creating topic:", error);
    return errorResponse("Failed to create topic", 500);
  }
}
```

**Step 2: Verify route works**

Run dev server:
```bash
cd app && npm run dev
```

Test with curl (or browser):
```bash
curl http://localhost:3000/api/topics
```
Expected: JSON array of 5 topics

**Step 3: Commit**

```bash
git add app/src/app/api/topics/route.ts
git commit -m "feat(api): add GET and POST endpoints for topics"
```

---

## Task 5: Topics API - PATCH (Update/Deactivate)

**Files:**
- Create: `app/src/app/api/topics/[id]/route.ts`

**Step 1: Create topic update route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWriteAccess, errorResponse } from "@/lib/api-utils";
import { Prisma, TopicStatus } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/topics/[id] - Update topic
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  // Check topic exists
  const existing = await db.topic.findUnique({
    where: { id },
    select: { id: true, code: true },
  });
  if (!existing) {
    return errorResponse("Topic not found", 404);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { name, code, displayOrder, status } = body;
  const updateData: Prisma.TopicUpdateInput = {};

  // Validate and set name
  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return errorResponse("Name cannot be empty", 400);
    }
    if (name.trim().length > 100) {
      return errorResponse("Name must be 100 characters or less", 400);
    }
    updateData.name = name.trim();
  }

  // Validate and set code
  if (code !== undefined) {
    if (typeof code !== "string" || code.trim().length === 0) {
      return errorResponse("Code cannot be empty", 400);
    }
    if (code.trim().length > 10) {
      return errorResponse("Code must be 10 characters or less", 400);
    }
    if (!/^[A-Z0-9]+$/.test(code.trim())) {
      return errorResponse("Code must be uppercase letters and numbers only", 400);
    }
    // Check for duplicate code (excluding current topic)
    if (code.trim() !== existing.code) {
      const duplicate = await db.topic.findUnique({
        where: { code: code.trim() },
      });
      if (duplicate) {
        return errorResponse("A topic with this code already exists", 400);
      }
    }
    updateData.code = code.trim();
  }

  // Validate and set displayOrder
  if (displayOrder !== undefined) {
    if (typeof displayOrder !== "number" || displayOrder < 0) {
      return errorResponse("Display order must be a non-negative number", 400);
    }
    updateData.displayOrder = displayOrder;
  }

  // Validate and set status
  if (status !== undefined) {
    if (!["ACTIVE", "INACTIVE"].includes(status)) {
      return errorResponse("Status must be ACTIVE or INACTIVE", 400);
    }
    updateData.status = status as TopicStatus;
  }

  try {
    const topic = await db.topic.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        code: true,
        displayOrder: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      ...topic,
      createdAt: topic.createdAt.toISOString(),
      updatedAt: topic.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("Database error updating topic:", error);
    return errorResponse("Failed to update topic", 500);
  }
}
```

**Step 2: Commit**

```bash
git add app/src/app/api/topics/
git commit -m "feat(api): add PATCH endpoint for topic updates"
```

---

## Task 6: Topics API - Reorder Endpoint

**Files:**
- Create: `app/src/app/api/topics/reorder/route.ts`

**Step 1: Create reorder endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWriteAccess, errorResponse } from "@/lib/api-utils";

// POST /api/topics/reorder - Bulk update display order
export async function POST(request: NextRequest) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { order } = body;

  // Validate order array
  if (!Array.isArray(order)) {
    return errorResponse("Order must be an array of topic IDs", 400);
  }

  try {
    // Update each topic's displayOrder in a transaction
    await db.$transaction(
      order.map((id: string, index: number) =>
        db.topic.update({
          where: { id },
          data: { displayOrder: index + 1 },
        })
      )
    );

    // Return updated topics
    const topics = await db.topic.findMany({
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        displayOrder: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      topics.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("Database error reordering topics:", error);
    return errorResponse("Failed to reorder topics", 500);
  }
}
```

**Step 2: Commit**

```bash
git add app/src/app/api/topics/reorder/route.ts
git commit -m "feat(api): add topics reorder endpoint"
```

---

## Task 7: Update Timesheets API - Add topicId Support

**Files:**
- Modify: `app/src/app/api/timesheets/route.ts`

**Step 1: Update TIMEENTRY_SELECT to include topic**

At line ~15, update the select object:

```typescript
const TIMEENTRY_SELECT = {
  id: true,
  date: true,
  hours: true,
  description: true,
  clientId: true,
  client: {
    select: {
      id: true,
      name: true,
      timesheetCode: true,
    },
  },
  topicId: true,
  topic: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} as const;
```

**Step 2: Update POST handler to require topicId**

In the POST function, after client validation (around line 133), add topic validation:

```typescript
  // Validate topic (required for new entries)
  if (!topicId) {
    return errorResponse("Topic is required", 400);
  }
  const topic = await db.topic.findUnique({
    where: { id: topicId },
    select: { id: true, status: true },
  });
  if (!topic) {
    return errorResponse("Topic not found", 404);
  }
  if (topic.status !== "ACTIVE") {
    return errorResponse("Cannot log time with inactive topic", 400);
  }
```

Update the body destructuring at line ~104:
```typescript
  const { date, clientId, topicId, hours, description } = body;
```

Update the create data at line ~154:
```typescript
      data: {
        date: parsedDate,
        hours: new Prisma.Decimal(hoursNum),
        description: description.trim(),
        userId: user.id,
        clientId: clientId,
        topicId: topicId,
      },
```

**Step 3: Update PATCH handler to support optional topicId**

In the PATCH function, after the client validation block (around line 228), add:

```typescript
  // Validate topic if provided
  if (topicId !== undefined) {
    const topic = await db.topic.findUnique({
      where: { id: topicId },
      select: { id: true, status: true },
    });
    if (!topic) {
      return errorResponse("Topic not found", 404);
    }
    if (topic.status !== "ACTIVE") {
      return errorResponse("Cannot log time with inactive topic", 400);
    }
    updateData.topic = { connect: { id: topicId } };
  }
```

Update the body destructuring at line ~193:
```typescript
  const { id, clientId, topicId, hours, description } = body;
```

**Step 4: Remove description minimum length validation**

In POST handler, replace lines ~145-150:
```typescript
  // Validate description (no minimum length required)
  if (description !== undefined && typeof description !== "string") {
    return errorResponse("Description must be a string", 400);
  }
```

In PATCH handler, replace lines ~241-244:
```typescript
  // Validate description if provided (no minimum length required)
  if (description !== undefined) {
    if (typeof description !== "string") {
      return errorResponse("Description must be a string", 400);
    }
    updateData.description = description.trim();
  }
```

**Step 5: Run tests**

Run:
```bash
cd app && npm run test -- --run
```
Expected: All tests pass

**Step 6: Commit**

```bash
git add app/src/app/api/timesheets/route.ts
git commit -m "feat(api): add topicId support to timesheets, remove description min length"
```

---

## Task 8: Create TopicSelect Component

**Files:**
- Create: `app/src/components/ui/TopicSelect.tsx`

**Step 1: Create TopicSelect component with ref support**

```typescript
"use client";

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useClickOutside } from "@/hooks/useClickOutside";

interface Topic {
  id: string;
  name: string;
  code: string;
}

interface TopicSelectProps {
  topics: Topic[];
  value: string;
  onChange: (topicId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export interface TopicSelectRef {
  open: () => void;
}

export const TopicSelect = forwardRef<TopicSelectRef, TopicSelectProps>(
  function TopicSelect(
    {
      topics,
      value,
      onChange,
      placeholder = "Select topic...",
      disabled = false,
      className = "",
    },
    ref
  ) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Expose open() method to parent
    useImperativeHandle(
      ref,
      () => ({
        open: () => {
          if (!disabled) {
            setIsOpen(true);
          }
        },
      }),
      [disabled]
    );

    // Find selected topic
    const selectedTopic = useMemo(
      () => topics.find((t) => t.id === value),
      [topics, value]
    );

    // Filter topics by search
    const filteredTopics = useMemo(() => {
      if (!search.trim()) return topics;
      const searchLower = search.toLowerCase();
      return topics.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.code.toLowerCase().includes(searchLower)
      );
    }, [topics, search]);

    // Close dropdown on outside click
    const handleClickOutside = useCallback(() => {
      setIsOpen(false);
      setSearch("");
    }, []);
    useClickOutside(dropdownRef, handleClickOutside, isOpen);

    // Focus search input when opened
    useEffect(() => {
      if (isOpen && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, [isOpen]);

    const handleSelect = (topicId: string) => {
      onChange(topicId);
      setIsOpen(false);
      setSearch("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearch("");
      }
    };

    return (
      <div ref={dropdownRef} className={`relative ${className}`}>
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            w-full px-3 py-2 rounded text-left text-sm
            bg-[var(--bg-surface)] border border-[var(--border-subtle)]
            text-[var(--text-primary)]
            focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
            focus:outline-none transition-all duration-200
            flex items-center justify-between gap-2
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <span
            className={`truncate ${selectedTopic ? "" : "text-[var(--text-muted)]"}`}
          >
            {selectedTopic
              ? `${selectedTopic.code} — ${selectedTopic.name}`
              : placeholder}
          </span>
          <svg
            className={`w-4 h-4 flex-shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        {/* Dropdown Panel */}
        {isOpen && (
          <div
            className="absolute z-50 mt-1 left-0 min-w-full w-[280px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded shadow-xl overflow-hidden animate-fade-up"
            onKeyDown={handleKeyDown}
          >
            {/* Search Input */}
            <div className="p-2 border-b border-[var(--border-subtle)]">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search topics..."
                className="
                  w-full px-3 py-2 rounded-sm text-sm
                  bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                  text-[var(--text-primary)] placeholder-[var(--text-muted)]
                  focus:border-[var(--border-accent)] focus:outline-none
                  transition-all duration-200
                "
              />
            </div>

            {/* Topic List */}
            <div className="max-h-56 overflow-y-auto">
              {filteredTopics.length === 0 ? (
                <div className="px-3 py-2 text-[13px] text-[var(--text-muted)]">
                  No topics found
                </div>
              ) : (
                filteredTopics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => handleSelect(topic.id)}
                    className={`
                      w-full px-3 py-2 text-left text-sm
                      hover:bg-[var(--bg-surface)] transition-colors
                      flex items-center gap-2
                      ${value === topic.id ? "bg-[var(--bg-surface)]" : ""}
                    `}
                  >
                    <span className="text-[var(--accent-pink)] font-mono text-xs">
                      {topic.code}
                    </span>
                    <span className="text-[var(--text-primary)] truncate">
                      {topic.name}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);
```

**Step 2: Commit**

```bash
git add app/src/components/ui/TopicSelect.tsx
git commit -m "feat(ui): add TopicSelect component with ref-based open()"
```

---

## Task 9: Update EntryForm - Add Topic and Auto-Cascade

**Files:**
- Modify: `app/src/components/timesheets/EntryForm.tsx`

**Step 1: Update imports and interfaces**

Replace the entire file with:

```typescript
"use client";

import { useRef } from "react";
import { ClientSelect } from "@/components/ui/ClientSelect";
import { TopicSelect, TopicSelectRef } from "@/components/ui/TopicSelect";
import { DurationPicker, DurationPickerRef } from "@/components/ui/DurationPicker";

interface Client {
  id: string;
  name: string;
  timesheetCode: string;
}

interface Topic {
  id: string;
  name: string;
  code: string;
}

interface FormData {
  clientId: string;
  topicId: string;
  hours: number;
  minutes: number;
  description: string;
}

interface EntryFormProps {
  clients: Client[];
  topics: Topic[];
  formData: FormData;
  isLoading: boolean;
  error: string | null;
  onFormChange: (updates: Partial<FormData>) => void;
  onSubmit: () => void;
}

export function EntryForm({
  clients,
  topics,
  formData,
  isLoading,
  error,
  onFormChange,
  onSubmit,
}: EntryFormProps) {
  const topicSelectRef = useRef<TopicSelectRef>(null);
  const durationPickerRef = useRef<DurationPickerRef>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  const canSubmit =
    formData.clientId &&
    formData.topicId &&
    (formData.hours > 0 || formData.minutes > 0);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canSubmit && !isLoading) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
      <div className="flex items-center gap-3">
        {/* Client Selector */}
        <ClientSelect
          clients={clients}
          value={formData.clientId}
          onChange={(clientId) => {
            onFormChange({ clientId });
            // Auto-open topic picker after client selection
            setTimeout(() => topicSelectRef.current?.open(), 0);
          }}
          placeholder="Select client..."
          className="w-[220px] flex-shrink-0"
        />

        {/* Topic Selector */}
        <TopicSelect
          ref={topicSelectRef}
          topics={topics}
          value={formData.topicId}
          onChange={(topicId) => {
            onFormChange({ topicId });
            // Auto-open duration picker after topic selection
            setTimeout(() => durationPickerRef.current?.open(), 0);
          }}
          placeholder="Select topic..."
          className="w-[220px] flex-shrink-0"
        />

        {/* Duration Picker */}
        <DurationPicker
          ref={durationPickerRef}
          hours={formData.hours}
          minutes={formData.minutes}
          onChange={(hours, minutes) => {
            onFormChange({ hours, minutes });
            // Auto-focus description after duration selection
            setTimeout(() => descriptionInputRef.current?.focus(), 0);
          }}
          className="w-[120px] flex-shrink-0"
        />

        {/* Description */}
        <input
          ref={descriptionInputRef}
          type="text"
          value={formData.description}
          onChange={(e) => onFormChange({ description: e.target.value })}
          onKeyDown={handleKeyDown}
          placeholder="What did you work on?"
          className="
            flex-1 min-w-[200px] px-3 py-2 rounded text-sm
            bg-[var(--bg-surface)] border border-[var(--border-subtle)]
            text-[var(--text-primary)] placeholder-[var(--text-muted)]
            focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
            focus:outline-none transition-all duration-200
          "
        />

        {/* Submit Button */}
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
          {isLoading ? "..." : "Log"}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 px-3 py-2 rounded bg-[var(--danger-bg)] text-[var(--danger)] text-[13px]">
          {error}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/src/components/timesheets/EntryForm.tsx
git commit -m "feat(ui): update EntryForm with topic selector and auto-cascade flow"
```

---

## Task 10: Update TimesheetsContent - Pass Topics

**Files:**
- Modify: `app/src/components/timesheets/TimesheetsContent.tsx`

**Step 1: Update props interface**

Add Topic import and update props:

```typescript
import type { Client, Topic, TimeEntry, FormData } from "@/types";
```

Update interface:

```typescript
interface TimesheetsContentProps {
  clients: Client[];
  topics: Topic[];
}
```

Update function signature:

```typescript
export function TimesheetsContent({ clients, topics }: TimesheetsContentProps) {
```

**Step 2: Update handleSubmit to include topicId**

In handleSubmit, update the body:

```typescript
        body: JSON.stringify({
          date: formatDateISO(selectedDate),
          clientId: formData.clientId,
          topicId: formData.topicId,
          hours: totalHours,
          description: formData.description.trim(),
        }),
```

**Step 3: Update saveEdit to include topicId**

In saveEdit, update the body:

```typescript
        body: JSON.stringify({
          id: entryId,
          clientId: editFormData.clientId,
          topicId: editFormData.topicId,
          hours: totalHours,
          description: editFormData.description.trim(),
        }),
```

**Step 4: Update form reset to preserve topicId**

In handleSubmit success callback, update:

```typescript
      setFormData((prev) => ({
        ...initialFormData,
        clientId: prev.clientId,
        topicId: prev.topicId,
      }));
```

**Step 5: Update validation checks**

In handleSubmit, update validation:

```typescript
    if (!formData.clientId || !formData.topicId) return;
    if (formData.hours === 0 && formData.minutes === 0) return;
```

In saveEdit, update validation:

```typescript
    if (editFormData.hours === 0 && editFormData.minutes === 0) return;
```

**Step 6: Pass topics to EntryForm and EntriesList**

Update EntryForm call:

```typescript
      <EntryForm
        clients={clients}
        topics={topics}
        formData={formData}
        isLoading={isLoading}
        error={error}
        onFormChange={handleFormChange}
        onSubmit={handleSubmit}
      />
```

Update EntriesList call (add topics prop):

```typescript
      <EntriesList
        entries={entries}
        clients={clients}
        topics={topics}
        isLoadingEntries={isLoadingEntries}
        isToday={isSameDay(selectedDate, today)}
        editingId={editingId}
        editFormData={editFormData}
        isLoading={isLoading}
        onStartEdit={startEdit}
        onCancelEdit={cancelEdit}
        onSaveEdit={saveEdit}
        onDelete={deleteEntry}
        onEditFormChange={handleEditFormChange}
      />
```

**Step 7: Commit**

```bash
git add app/src/components/timesheets/TimesheetsContent.tsx
git commit -m "feat(ui): update TimesheetsContent to pass topics and include topicId"
```

---

## Task 11: Update Timesheets Page - Fetch Topics

**Files:**
- Modify: `app/src/app/(authenticated)/timesheets/page.tsx`

**Step 1: Update to fetch topics**

```typescript
import { db } from "@/lib/db";
import { TimesheetsContent } from "@/components/timesheets/TimesheetsContent";

export default async function TimesheetsPage() {
  // Fetch active clients for the dropdown
  const clients = await db.client.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      timesheetCode: true,
    },
    orderBy: { name: "asc" },
  });

  // Fetch active topics for the dropdown
  const topics = await db.topic.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: { displayOrder: "asc" },
  });

  return <TimesheetsContent clients={clients} topics={topics} />;
}
```

**Step 2: Commit**

```bash
git add app/src/app/\(authenticated\)/timesheets/page.tsx
git commit -m "feat(page): fetch topics in timesheets page"
```

---

## Task 12: Update EntryCard - Show Topic Code

**Files:**
- Modify: `app/src/components/timesheets/EntryCard.tsx`

**Step 1: Update TimeEntry interface**

Update the TimeEntry interface to include topic:

```typescript
interface TimeEntry {
  id: string;
  date: string;
  hours: number;
  description: string;
  clientId: string;
  client: {
    id: string;
    name: string;
    timesheetCode: string;
  };
  topicId?: string | null;
  topic?: {
    id: string;
    name: string;
    code: string;
  } | null;
}
```

**Step 2: Update display in view mode**

Replace the view mode section (lines ~206-219) with:

```typescript
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[var(--accent-pink)] font-mono text-[11px] bg-[var(--accent-pink-glow)] px-1.5 py-0.5 rounded">
              {entry.client.timesheetCode}
            </span>
            {entry.topic && (
              <span className="text-[var(--text-muted)] font-mono text-[11px] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded">
                {entry.topic.code}
              </span>
            )}
            <span className="text-[13px] text-[var(--text-muted)]">
              {formatHours(entry.hours)}
            </span>
          </div>
```

**Step 3: Remove client name from display**

The display now shows: `VED001 · MTG · 2h 30m` format (client code, topic code, duration).

**Step 4: Commit**

```bash
git add app/src/components/timesheets/EntryCard.tsx
git commit -m "feat(ui): show topic code in EntryCard display"
```

---

## Task 13: Update EntriesList - Pass Topics to EntryCard

**Files:**
- Modify: `app/src/components/timesheets/EntriesList.tsx`

**Step 1: Update props interface**

Add Topic type and topics prop to the interface:

```typescript
interface Topic {
  id: string;
  name: string;
  code: string;
}

interface EntriesListProps {
  entries: TimeEntry[];
  clients: Client[];
  topics: Topic[];
  isLoadingEntries: boolean;
  isToday: boolean;
  editingId: string | null;
  editFormData: FormData;
  isLoading: boolean;
  onStartEdit: (entry: TimeEntry) => void;
  onCancelEdit: () => void;
  onSaveEdit: (entryId: string) => void;
  onDelete: (entryId: string) => void;
  onEditFormChange: (updates: Partial<FormData>) => void;
}
```

Update function signature:

```typescript
export function EntriesList({
  entries,
  clients,
  topics,
  isLoadingEntries,
  isToday,
  editingId,
  editFormData,
  isLoading,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onEditFormChange,
}: EntriesListProps) {
```

**Step 2: Pass topics to EntryCard**

Update EntryCard call to include topics:

```typescript
            <EntryCard
              key={entry.id}
              entry={entry}
              clients={clients}
              topics={topics}
              isEditing={editingId === entry.id}
              editFormData={editFormData}
              isLoading={isLoading}
              onStartEdit={() => onStartEdit(entry)}
              onCancelEdit={onCancelEdit}
              onSaveEdit={() => onSaveEdit(entry.id)}
              onDelete={() => onDelete(entry.id)}
              onEditFormChange={onEditFormChange}
            />
```

**Step 3: Commit**

```bash
git add app/src/components/timesheets/EntriesList.tsx
git commit -m "feat(ui): pass topics to EntriesList and EntryCard"
```

---

## Task 14: Update EntryCard Edit Mode - Add TopicSelect

**Files:**
- Modify: `app/src/components/timesheets/EntryCard.tsx`

**Step 1: Update imports and props**

Add TopicSelect import and Topic interface, update props:

```typescript
import { TopicSelect } from "@/components/ui/TopicSelect";

interface Topic {
  id: string;
  name: string;
  code: string;
}

interface FormData {
  clientId: string;
  topicId: string;
  hours: number;
  minutes: number;
  description: string;
}

interface EntryCardProps {
  entry: TimeEntry;
  clients: Client[];
  topics: Topic[];
  isEditing: boolean;
  editFormData: FormData;
  isLoading: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onEditFormChange: (updates: Partial<FormData>) => void;
}
```

Update function signature:

```typescript
export function EntryCard({
  entry,
  clients,
  topics,
  isEditing,
  editFormData,
  isLoading,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onEditFormChange,
}: EntryCardProps) {
```

**Step 2: Update canSave validation**

```typescript
  const canSave =
    editFormData.topicId &&
    (editFormData.hours > 0 || editFormData.minutes > 0);
```

**Step 3: Add TopicSelect in edit mode**

After the Client select div in edit mode, add:

```typescript
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
              Topic
            </label>
            <TopicSelect
              topics={topics}
              value={editFormData.topicId}
              onChange={(topicId) => onEditFormChange({ topicId })}
              className="w-full"
            />
          </div>
```

**Step 4: Commit**

```bash
git add app/src/components/timesheets/EntryCard.tsx
git commit -m "feat(ui): add TopicSelect to EntryCard edit mode"
```

---

## Task 15: Create Topics Admin Page

**Files:**
- Create: `app/src/app/(authenticated)/topics/page.tsx`

**Step 1: Create topics page**

```typescript
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { redirect } from "next/navigation";
import { TopicsContent } from "@/components/topics/TopicsContent";

export default async function TopicsPage() {
  // Get current user for role-based access
  const user = await getCurrentUser();

  // Only admins can access topics management
  if (user.role !== "ADMIN") {
    redirect("/timesheets");
  }

  // Fetch all topics including inactive
  const topics = await db.topic.findMany({
    select: {
      id: true,
      name: true,
      code: true,
      displayOrder: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { displayOrder: "asc" },
  });

  // Convert for client component
  const serializedTopics = topics.map((topic) => ({
    ...topic,
    createdAt: topic.createdAt.toISOString(),
    updatedAt: topic.updatedAt.toISOString(),
  }));

  return <TopicsContent initialTopics={serializedTopics} />;
}
```

**Step 2: Commit**

```bash
git add app/src/app/\(authenticated\)/topics/page.tsx
git commit -m "feat(page): add topics admin page"
```

---

## Task 16: Create TopicsContent Component

**Files:**
- Create: `app/src/components/topics/TopicsContent.tsx`

**Step 1: Create TopicsContent component**

```typescript
"use client";

import { useState, useCallback, useMemo } from "react";
import { TopicStatus } from "@prisma/client";
import { DataTable } from "@/components/ui/DataTable";
import { ColumnDef } from "@/components/ui/table-types";
import { TopicModal } from "./TopicModal";

interface Topic {
  id: string;
  name: string;
  code: string;
  displayOrder: number;
  status: TopicStatus;
  createdAt: string;
  updatedAt: string;
}

interface TopicsContentProps {
  initialTopics: Topic[];
}

type ModalMode = "create" | "edit" | null;

interface FormData {
  name: string;
  code: string;
}

const statusStyles: Record<
  TopicStatus,
  { bgColor: string; textColor: string; label: string }
> = {
  ACTIVE: {
    bgColor: "rgba(34, 197, 94, 0.15)",
    textColor: "#22c55e",
    label: "Active",
  },
  INACTIVE: {
    bgColor: "rgba(107, 114, 128, 0.15)",
    textColor: "#6b7280",
    label: "Inactive",
  },
};

export function TopicsContent({ initialTopics }: TopicsContentProps) {
  const [topics, setTopics] = useState<Topic[]>(initialTopics);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [formData, setFormData] = useState<FormData>({ name: "", code: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Filtered topics
  const filteredTopics = useMemo(() => {
    return topics.filter((topic) => {
      // Status filter
      if (statusFilter !== "ALL" && topic.status !== statusFilter) {
        return false;
      }
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = topic.name.toLowerCase().includes(query);
        const matchesCode = topic.code.toLowerCase().includes(query);
        return matchesName || matchesCode;
      }
      return true;
    });
  }, [topics, searchQuery, statusFilter]);

  // Modal handlers
  const openCreateModal = useCallback(() => {
    setFormData({ name: "", code: "" });
    setSelectedTopic(null);
    setError(null);
    setModalMode("create");
  }, []);

  const openEditModal = useCallback((topic: Topic) => {
    setFormData({ name: topic.name, code: topic.code });
    setSelectedTopic(topic);
    setError(null);
    setModalMode("edit");
  }, []);

  const closeModal = useCallback(() => {
    setModalMode(null);
    setSelectedTopic(null);
    setError(null);
  }, []);

  const handleFormChange = useCallback((updates: Partial<FormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Create handler
  const handleCreate = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create topic");
        return;
      }

      setTopics((prev) => [...prev, data].sort((a, b) => a.displayOrder - b.displayOrder));
      closeModal();
    } catch {
      setError("Failed to create topic");
    } finally {
      setIsLoading(false);
    }
  }, [formData, closeModal]);

  // Update handler
  const handleUpdate = useCallback(async () => {
    if (!selectedTopic) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/topics/${selectedTopic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update topic");
        return;
      }

      setTopics((prev) =>
        prev.map((t) => (t.id === selectedTopic.id ? data : t))
      );
      closeModal();
    } catch {
      setError("Failed to update topic");
    } finally {
      setIsLoading(false);
    }
  }, [selectedTopic, formData, closeModal]);

  // Deactivate handler
  const handleDeactivate = useCallback(async (topic: Topic) => {
    if (!confirm(`Deactivate "${topic.name}"? It will be hidden from the timesheet form.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/topics/${topic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "INACTIVE" }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to deactivate topic");
        return;
      }

      const updated = await response.json();
      setTopics((prev) => prev.map((t) => (t.id === topic.id ? updated : t)));
    } catch {
      alert("Failed to deactivate topic");
    }
  }, []);

  // Reactivate handler
  const handleReactivate = useCallback(async (topic: Topic) => {
    try {
      const response = await fetch(`/api/topics/${topic.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to reactivate topic");
        return;
      }

      const updated = await response.json();
      setTopics((prev) => prev.map((t) => (t.id === topic.id ? updated : t)));
    } catch {
      alert("Failed to reactivate topic");
    }
  }, []);

  // Move up handler
  const handleMoveUp = useCallback(async (topic: Topic) => {
    const sortedTopics = [...topics].sort((a, b) => a.displayOrder - b.displayOrder);
    const currentIndex = sortedTopics.findIndex((t) => t.id === topic.id);
    if (currentIndex <= 0) return;

    const newOrder = sortedTopics.map((t) => t.id);
    [newOrder[currentIndex], newOrder[currentIndex - 1]] = [newOrder[currentIndex - 1], newOrder[currentIndex]];

    try {
      const response = await fetch("/api/topics/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: newOrder }),
      });

      if (response.ok) {
        const updated = await response.json();
        setTopics(updated);
      }
    } catch {
      alert("Failed to reorder topics");
    }
  }, [topics]);

  // Move down handler
  const handleMoveDown = useCallback(async (topic: Topic) => {
    const sortedTopics = [...topics].sort((a, b) => a.displayOrder - b.displayOrder);
    const currentIndex = sortedTopics.findIndex((t) => t.id === topic.id);
    if (currentIndex >= sortedTopics.length - 1) return;

    const newOrder = sortedTopics.map((t) => t.id);
    [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];

    try {
      const response = await fetch("/api/topics/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: newOrder }),
      });

      if (response.ok) {
        const updated = await response.json();
        setTopics(updated);
      }
    } catch {
      alert("Failed to reorder topics");
    }
  }, [topics]);

  // Column definitions
  const columns: ColumnDef<Topic>[] = useMemo(
    () => [
      {
        id: "displayOrder",
        header: "#",
        accessor: (topic) => topic.displayOrder,
        cell: (topic) => (
          <span className="text-[13px] text-[var(--text-muted)] font-mono">
            {topic.displayOrder}
          </span>
        ),
      },
      {
        id: "code",
        header: "Code",
        accessor: (topic) => topic.code,
        cell: (topic) => (
          <span className="text-[var(--accent-pink)] font-mono text-[13px]">
            {topic.code}
          </span>
        ),
      },
      {
        id: "name",
        header: "Name",
        accessor: (topic) => topic.name,
        cell: (topic) => (
          <span className="font-medium text-[13px] text-[var(--text-primary)]">
            {topic.name}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessor: (topic) => topic.status,
        cell: (topic) => {
          const style = statusStyles[topic.status];
          return (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium"
              style={{ backgroundColor: style.bgColor, color: style.textColor }}
            >
              {style.label}
            </span>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        accessor: () => null,
        sortable: false,
        align: "right",
        cell: (topic) => {
          const isInactive = topic.status === "INACTIVE";
          const sortedTopics = [...topics].sort((a, b) => a.displayOrder - b.displayOrder);
          const currentIndex = sortedTopics.findIndex((t) => t.id === topic.id);
          const isFirst = currentIndex === 0;
          const isLast = currentIndex === sortedTopics.length - 1;

          return (
            <div className="flex items-center justify-end gap-1">
              {/* Move Up */}
              <button
                onClick={() => handleMoveUp(topic)}
                disabled={isFirst}
                className={`p-1.5 rounded-sm transition-colors ${
                  isFirst
                    ? "text-[var(--text-muted)] opacity-30 cursor-not-allowed"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                }`}
                title="Move up"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              {/* Move Down */}
              <button
                onClick={() => handleMoveDown(topic)}
                disabled={isLast}
                className={`p-1.5 rounded-sm transition-colors ${
                  isLast
                    ? "text-[var(--text-muted)] opacity-30 cursor-not-allowed"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                }`}
                title="Move down"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {/* Edit */}
              <button
                onClick={() => openEditModal(topic)}
                className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                title="Edit topic"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              {/* Deactivate/Reactivate */}
              {isInactive ? (
                <button
                  onClick={() => handleReactivate(topic)}
                  className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-green-400 hover:bg-[var(--bg-surface)] transition-colors"
                  title="Reactivate topic"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={() => handleDeactivate(topic)}
                  className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-red-400 hover:bg-[var(--bg-surface)] transition-colors"
                  title="Deactivate topic"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [topics, openEditModal, handleDeactivate, handleReactivate, handleMoveUp, handleMoveDown]
  );

  // Empty state icon
  const emptyIcon = (
    <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
            Topics
          </h1>
          <p className="text-[var(--text-muted)] text-[13px] mt-0.5">
            Manage work categories for timesheet entries
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--accent-pink)] text-[var(--bg-deep)] text-[13px] font-medium hover:bg-[var(--accent-pink-dim)] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          Add Topic
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        {/* Search Input */}
        <div className="flex-1 max-w-md relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or code..."
            className="
              w-full pl-10 pr-3 py-2 rounded text-[13px]
              bg-[var(--bg-surface)] border border-[var(--border-subtle)]
              text-[var(--text-primary)] placeholder-[var(--text-muted)]
              focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
              focus:outline-none transition-all duration-200
            "
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="
            px-3 py-2 rounded text-[13px]
            bg-[var(--bg-surface)] border border-[var(--border-subtle)]
            text-[var(--text-primary)]
            focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
            focus:outline-none transition-all duration-200
            cursor-pointer
          "
        >
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active Only</option>
          <option value="INACTIVE">Inactive Only</option>
        </select>

        {/* Result Count */}
        <div className="text-[13px] text-[var(--text-muted)]">
          {filteredTopics.length} {filteredTopics.length === 1 ? "topic" : "topics"}
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={filteredTopics}
        columns={columns}
        getRowKey={(topic) => topic.id}
        pageSize={25}
        emptyMessage={topics.length === 0 ? "No topics yet" : "No matching topics"}
        emptyIcon={emptyIcon}
      />

      {/* Modal */}
      {modalMode && (
        <TopicModal
          mode={modalMode}
          formData={formData}
          selectedTopicName={selectedTopic?.name}
          isLoading={isLoading}
          error={error}
          onFormChange={handleFormChange}
          onSubmit={modalMode === "create" ? handleCreate : handleUpdate}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/src/components/topics/TopicsContent.tsx
git commit -m "feat(ui): add TopicsContent component with CRUD and reordering"
```

---

## Task 17: Create TopicModal Component

**Files:**
- Create: `app/src/components/topics/TopicModal.tsx`

**Step 1: Create TopicModal component**

```typescript
"use client";

import { useEffect, useRef } from "react";

interface FormData {
  name: string;
  code: string;
}

interface TopicModalProps {
  mode: "create" | "edit";
  formData: FormData;
  selectedTopicName?: string;
  isLoading: boolean;
  error: string | null;
  onFormChange: (updates: Partial<FormData>) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function TopicModal({
  mode,
  formData,
  selectedTopicName,
  isLoading,
  error,
  onFormChange,
  onSubmit,
  onClose,
}: TopicModalProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus name input on mount
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const canSubmit = formData.name.trim().length > 0 && formData.code.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg shadow-2xl animate-fade-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
            {mode === "create" ? "Add Topic" : `Edit ${selectedTopicName}`}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Name Input */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">
              Name
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={formData.name}
              onChange={(e) => onFormChange({ name: e.target.value })}
              placeholder="e.g., Legal Research"
              className="
                w-full px-3 py-2 rounded text-sm
                bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                text-[var(--text-primary)] placeholder-[var(--text-muted)]
                focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                focus:outline-none transition-all duration-200
              "
            />
          </div>

          {/* Code Input */}
          <div>
            <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1.5">
              Code
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => onFormChange({ code: e.target.value.toUpperCase() })}
              placeholder="e.g., RES"
              maxLength={10}
              className="
                w-full px-3 py-2 rounded text-sm font-mono
                bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                text-[var(--text-primary)] placeholder-[var(--text-muted)]
                focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
                focus:outline-none transition-all duration-200
                uppercase
              "
            />
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              Short code shown in timesheets (uppercase, max 10 chars)
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-3 py-2 rounded bg-[var(--danger-bg)] text-[var(--danger)] text-[13px]">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isLoading}
              className="
                px-4 py-2 rounded text-[13px] font-medium
                bg-[var(--accent-pink)] text-[var(--bg-deep)]
                hover:bg-[var(--accent-pink-dim)]
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
            >
              {isLoading ? "Saving..." : mode === "create" ? "Create" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/src/components/topics/TopicModal.tsx
git commit -m "feat(ui): add TopicModal component"
```

---

## Task 18: Update Sidebar - Add Topics Nav Item

**Files:**
- Modify: `app/src/components/layout/Sidebar.tsx`

**Step 1: Add topics icon**

Add after `employees` icon in the Icons object:

```typescript
  topics: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  ),
```

**Step 2: Add topics nav item**

Update navItems array to include Topics after Employees:

```typescript
const navItems: NavItem[] = [
  { name: "Clients", href: "/clients", icon: Icons.clients, adminOnly: true },
  { name: "Employees", href: "/employees", icon: Icons.employees },
  { name: "Topics", href: "/topics", icon: Icons.topics, adminOnly: true },
  { name: "Timesheets", href: "/timesheets", icon: Icons.timesheets },
  { name: "Billing", href: "/billing", icon: Icons.billing, adminOnly: true },
  { name: "Reports", href: "/reports", icon: Icons.reports, adminOnly: true },
];
```

**Step 3: Commit**

```bash
git add app/src/components/layout/Sidebar.tsx
git commit -m "feat(ui): add Topics nav item to sidebar"
```

---

## Task 19: Run Full Test Suite and Build

**Files:**
- None (verification only)

**Step 1: Run tests**

Run:
```bash
cd app && npm run test -- --run
```
Expected: All tests pass

**Step 2: Run linter**

Run:
```bash
cd app && npm run lint
```
Expected: No errors

**Step 3: Run build**

Run:
```bash
cd app && npm run build
```
Expected: Build succeeds

**Step 4: Manual verification**

1. Start dev server: `npm run dev`
2. Log in as admin
3. Navigate to /topics - should see 5 seeded topics
4. Create a new topic, edit, reorder, deactivate/reactivate
5. Navigate to /timesheets
6. Create a time entry: select client → topic auto-opens → select topic → duration auto-opens → select duration → description auto-focuses → press Enter → entry created
7. Verify entry card shows: `VED001 · MTG · 2h 30m`

**Step 5: Commit verification**

```bash
git add -A
git commit -m "chore: verify build and tests pass"
```

---

## Task 20: Final Commit and Summary

**Step 1: Review all changes**

Run:
```bash
git log --oneline -20
```

**Step 2: Create summary commit if needed**

All implementation is complete. The feature includes:

- **Database:** Topic model with code, name, displayOrder, status; nullable topicId on TimeEntry
- **API:** Full CRUD for topics + reorder endpoint; updated timesheets to require topicId
- **UI:** TopicSelect with ref-based auto-open, TopicsContent admin page, TopicModal
- **Form Flow:** Client → Topic → Duration → Description with auto-cascade and Enter submission
- **Display:** EntryCard shows `{clientCode} · {topicCode} · {duration}` format

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Database schema - Topic model + topicId on TimeEntry |
| 2 | Seed initial 5 topics |
| 3 | Add Topic type definitions |
| 4 | Topics API - GET and POST |
| 5 | Topics API - PATCH |
| 6 | Topics API - Reorder |
| 7 | Update Timesheets API with topicId |
| 8 | Create TopicSelect component |
| 9 | Update EntryForm with auto-cascade |
| 10 | Update TimesheetsContent |
| 11 | Update Timesheets page to fetch topics |
| 12 | Update EntryCard display |
| 13 | Update EntriesList |
| 14 | Update EntryCard edit mode |
| 15 | Create Topics admin page |
| 16 | Create TopicsContent component |
| 17 | Create TopicModal component |
| 18 | Update Sidebar with Topics nav |
| 19 | Run tests and build |
| 20 | Final verification |

**Estimated commits:** 18
**Files created:** 9
**Files modified:** 11
