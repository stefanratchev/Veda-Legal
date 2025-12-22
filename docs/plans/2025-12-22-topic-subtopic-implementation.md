# Topic/Subtopic Hierarchy Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform flat topics into a two-level Topic > Subtopic hierarchy with cascading selection, description pre-fill, and immutable time entries.

**Architecture:** Repurpose existing Topic table for categories, add new Subtopic table. TimeEntry stores denormalized topicName/subtopicName for immutability. New TopicCascadeSelect component replaces TopicSelect. Remove edit mode from EntryCard.

**Tech Stack:** Prisma 7, Next.js 16 App Router, TypeScript, Tailwind CSS v4

---

## Task 1: Update Prisma Schema

**Files:**
- Modify: `app/prisma/schema.prisma`

**Step 1: Modify Topic model and add Subtopic model**

Update `schema.prisma` - remove `code` field from Topic, add Subtopic model and SubtopicStatus enum:

```prisma
enum SubtopicStatus {
  ACTIVE
  INACTIVE
}

model Topic {
  id           String      @id @default(cuid())
  name         String
  displayOrder Int         @default(0)
  status       TopicStatus @default(ACTIVE)

  subtopics    Subtopic[]

  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@map("topics")
}

model Subtopic {
  id           String         @id @default(cuid())
  topicId      String
  topic        Topic          @relation(fields: [topicId], references: [id])
  name         String
  isPrefix     Boolean        @default(false)
  displayOrder Int            @default(0)
  status       SubtopicStatus @default(ACTIVE)

  timeEntries  TimeEntry[]

  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  @@index([topicId])
  @@map("subtopics")
}
```

**Step 2: Update TimeEntry model**

Replace `topicId`/`topic` with subtopic relation and denormalized fields:

```prisma
model TimeEntry {
  id            String    @id @default(cuid())
  date          DateTime  @db.Date
  hours         Decimal   @db.Decimal(4, 2)
  description   String

  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  clientId      String
  client        Client    @relation(fields: [clientId], references: [id], onDelete: Cascade)

  // New: Subtopic reference + denormalized names for immutability
  subtopicId    String?
  subtopic      Subtopic? @relation(fields: [subtopicId], references: [id])
  topicName     String    @default("")
  subtopicName  String    @default("")

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([userId])
  @@index([clientId])
  @@index([subtopicId])
  @@index([date])
  @@map("time_entries")
}
```

**Step 3: Generate Prisma client**

Run: `cd app && npm run db:generate`

Expected: Prisma client regenerated with new models

**Step 4: Create migration**

Run: `cd app && npx prisma migrate dev --name add-subtopics-hierarchy`

Expected: Migration created and applied. Note: This will prompt about the `code` column removal and `topicId` removal from TimeEntry. Accept the data loss since we're starting fresh.

**Step 5: Commit**

```bash
git add app/prisma/
git commit -m "feat(db): add subtopic hierarchy schema"
```

---

## Task 2: Create Seed Script for Topics and Subtopics

**Files:**
- Create: `app/prisma/seed-topics.ts`
- Modify: `app/package.json` (add seed script)

**Step 1: Create seed script**

Create `app/prisma/seed-topics.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface SubtopicData {
  name: string;
}

interface TopicData {
  name: string;
  subtopics: SubtopicData[];
}

const TOPICS: TopicData[] = [
  {
    name: "Internal",
    subtopics: [
      { name: "Onboarding" },
      { name: "AML/ KYC" },
      { name: "Admin:" },
      { name: "Meeting:" },
      { name: "Marketing:" },
      { name: "Research:" },
      { name: "Other:" },
    ],
  },
  {
    name: "Company Incorporation",
    subtopics: [
      { name: "Drafting incorporation documents" },
      { name: "Revising incorporation documents" },
      { name: "Modifications to standard documents" },
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Commercial Register filing: preparation for filing" },
      { name: "Commercial Register filing: submission of application" },
      { name: "Commercial Register filing: additional requests" },
      { name: "VAT registration: document preparation" },
      { name: "VAT registration: NRA correspondence" },
      { name: "Other:" },
    ],
  },
  {
    name: "UBO Disclosure",
    subtopics: [
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Drafting UBO declaration" },
      { name: "Revising UBO declaration" },
      { name: "Commercial Register filing: preparation for filing" },
      { name: "Commercial Register filing: submission of application" },
      { name: "Commercial Register filing: additional requests" },
    ],
  },
  {
    name: "Corporate Changes",
    subtopics: [
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Drafting documents:" },
      { name: "Revising documents:" },
      { name: "Strategic consideration:" },
      { name: "Legal Research:" },
      { name: "Commercial Register filing: preparation for filing" },
      { name: "Commercial Register filing: submission of application" },
      { name: "Commercial Register filing: additional requests" },
      { name: "Other:" },
    ],
  },
  {
    name: "Bank Account",
    subtopics: [
      { name: "Correspondence with the bank" },
      { name: "Research and summary of bank requirements" },
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Drafting documents:" },
      { name: "Revising documents:" },
      { name: "Bank visit: opening account" },
      { name: "Internal: Case Management" },
    ],
  },
  {
    name: "Employment Agreement",
    subtopics: [
      { name: "Drafting employment agreement" },
      { name: "Revising employment agreement" },
      { name: "Reflecting client comments in employment agreement" },
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Other:" },
    ],
  },
  {
    name: "Employment Internal Rules",
    subtopics: [
      { name: "Drafting Internal Labour Rules" },
      { name: "Revising Internal Labour Rules" },
      { name: "Drafting Internal Remuneration Rules" },
      { name: "Revising Internal Remuneration Rules" },
      { name: "Reflecting client comments in Internal Rules" },
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Other:" },
    ],
  },
  {
    name: "Employment Advisory",
    subtopics: [
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Drafting documents:" },
      { name: "Revising documents:" },
      { name: "Other:" },
    ],
  },
  {
    name: "Intercompany Agreement",
    subtopics: [
      { name: "Drafting Intercompany Agreement" },
      { name: "Revising Intercompany Agreement" },
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Other:" },
    ],
  },
  {
    name: "Contracts",
    subtopics: [
      { name: "Drafting contract:" },
      { name: "Revising contract:" },
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Other:" },
    ],
  },
  {
    name: "Terms & Conditions",
    subtopics: [
      { name: "Drafting T&C:" },
      { name: "Revising T&C:" },
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Other:" },
    ],
  },
  {
    name: "Data Protection",
    subtopics: [
      { name: "Drafting a Privacy Policy" },
      { name: "Revision a Privacy Policy" },
      { name: "Drafting Data Protection Instruction" },
      { name: "Revising Data Protection Instruction" },
      { name: "Drafting Cookies Policy" },
      { name: "Revising Cookies Policy" },
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Other:" },
    ],
  },
  {
    name: "Legal Advisory",
    subtopics: [
      { name: "Drafting:" },
      { name: "Revising:" },
      { name: "Client correspondence:" },
      { name: "Client meeting:" },
      { name: "Strategic consideration:" },
      { name: "Legal research:" },
      { name: "Other:" },
    ],
  },
];

async function main() {
  console.log("Deleting existing topics and subtopics...");
  await prisma.subtopic.deleteMany();
  await prisma.topic.deleteMany();

  console.log("Seeding topics and subtopics...");

  for (let topicOrder = 0; topicOrder < TOPICS.length; topicOrder++) {
    const topicData = TOPICS[topicOrder];

    const topic = await prisma.topic.create({
      data: {
        name: topicData.name,
        displayOrder: topicOrder,
        status: "ACTIVE",
      },
    });

    console.log(`Created topic: ${topic.name}`);

    for (let subtopicOrder = 0; subtopicOrder < topicData.subtopics.length; subtopicOrder++) {
      const subtopicData = topicData.subtopics[subtopicOrder];
      const isPrefix = subtopicData.name.endsWith(":");

      await prisma.subtopic.create({
        data: {
          topicId: topic.id,
          name: subtopicData.name,
          isPrefix,
          displayOrder: subtopicOrder,
          status: "ACTIVE",
        },
      });
    }

    console.log(`  Created ${topicData.subtopics.length} subtopics`);
  }

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Step 2: Add seed script to package.json**

Add to `app/package.json` scripts:

```json
"db:seed-topics": "npx tsx prisma/seed-topics.ts"
```

**Step 3: Run seed script**

Run: `cd app && npm run db:seed-topics`

Expected: Topics and subtopics seeded (13 topics, ~120 subtopics)

**Step 4: Verify in Prisma Studio**

Run: `cd app && npm run db:studio`

Expected: See 13 topics, each with their subtopics

**Step 5: Commit**

```bash
git add app/prisma/seed-topics.ts app/package.json
git commit -m "feat(db): add topic/subtopic seed script"
```

---

## Task 3: Update Type Definitions

**Files:**
- Modify: `app/src/types/index.ts`

**Step 1: Update types**

Replace Topic interface and update TimeEntry to use new structure:

```typescript
/**
 * Shared type definitions for the Veda Legal Timesheets application.
 */

/**
 * Client for timesheet selection (minimal fields).
 */
export interface Client {
  id: string;
  name: string;
  timesheetCode: string;
}

/**
 * Subtopic within a topic category.
 */
export interface Subtopic {
  id: string;
  name: string;
  isPrefix: boolean;
  displayOrder: number;
  status: "ACTIVE" | "INACTIVE";
}

/**
 * Topic category containing subtopics.
 */
export interface Topic {
  id: string;
  name: string;
  displayOrder: number;
  status: "ACTIVE" | "INACTIVE";
  subtopics: Subtopic[];
}

/**
 * Time entry with client and topic information.
 * Note: topicName and subtopicName are denormalized for immutability.
 */
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
  subtopicId?: string | null;
  topicName: string;
  subtopicName: string;
}

/**
 * Form data for creating time entries.
 */
export interface FormData {
  clientId: string;
  subtopicId: string;
  hours: number;
  minutes: number;
  description: string;
}

/**
 * Initial form data state.
 */
export const initialFormData: FormData = {
  clientId: "",
  subtopicId: "",
  hours: 1,
  minutes: 0,
  description: "",
};
```

**Step 2: Commit**

```bash
git add app/src/types/index.ts
git commit -m "feat(types): update types for topic/subtopic hierarchy"
```

---

## Task 4: Update Topics API

**Files:**
- Modify: `app/src/app/api/topics/route.ts`
- Delete: `app/src/app/api/topics/[id]/route.ts`
- Delete: `app/src/app/api/topics/reorder/route.ts`

**Step 1: Rewrite topics route to include subtopics**

Replace `app/src/app/api/topics/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireWriteAccess, errorResponse } from "@/lib/api-utils";

// GET /api/topics - List topics with subtopics
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
      include: {
        subtopics: {
          where: includeInactive ? {} : { status: "ACTIVE" },
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            name: true,
            isPrefix: true,
            displayOrder: true,
            status: true,
          },
        },
      },
      orderBy: { displayOrder: "asc" },
    });

    return NextResponse.json(
      topics.map((t) => ({
        id: t.id,
        name: t.name,
        displayOrder: t.displayOrder,
        status: t.status,
        subtopics: t.subtopics,
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

  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return errorResponse("Name is required", 400);
  }
  if (name.trim().length > 100) {
    return errorResponse("Name must be 100 characters or less", 400);
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
        displayOrder: nextOrder,
      },
      include: {
        subtopics: {
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            name: true,
            isPrefix: true,
            displayOrder: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: topic.id,
      name: topic.name,
      displayOrder: topic.displayOrder,
      status: topic.status,
      subtopics: topic.subtopics,
    });
  } catch (error) {
    console.error("Database error creating topic:", error);
    return errorResponse("Failed to create topic", 500);
  }
}
```

**Step 2: Delete old route files**

Delete `app/src/app/api/topics/[id]/route.ts` and `app/src/app/api/topics/reorder/route.ts`.

**Step 3: Create new [id] route for topic CRUD**

Create `app/src/app/api/topics/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWriteAccess, errorResponse } from "@/lib/api-utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/topics/[id] - Update topic
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { name, displayOrder, status } = body;

  const updateData: { name?: string; displayOrder?: number; status?: "ACTIVE" | "INACTIVE" } = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return errorResponse("Name is required", 400);
    }
    if (name.trim().length > 100) {
      return errorResponse("Name must be 100 characters or less", 400);
    }
    updateData.name = name.trim();
  }

  if (displayOrder !== undefined) {
    if (typeof displayOrder !== "number" || displayOrder < 0) {
      return errorResponse("Invalid display order", 400);
    }
    updateData.displayOrder = displayOrder;
  }

  if (status !== undefined) {
    if (status !== "ACTIVE" && status !== "INACTIVE") {
      return errorResponse("Invalid status", 400);
    }
    updateData.status = status;
  }

  try {
    const topic = await db.topic.update({
      where: { id },
      data: updateData,
      include: {
        subtopics: {
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            name: true,
            isPrefix: true,
            displayOrder: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      id: topic.id,
      name: topic.name,
      displayOrder: topic.displayOrder,
      status: topic.status,
      subtopics: topic.subtopics,
    });
  } catch (error) {
    console.error("Database error updating topic:", error);
    return errorResponse("Failed to update topic", 500);
  }
}

// DELETE /api/topics/[id] - Delete topic (only if no subtopics)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;

  try {
    // Check if topic has subtopics
    const subtopicCount = await db.subtopic.count({
      where: { topicId: id },
    });

    if (subtopicCount > 0) {
      return errorResponse("Cannot delete topic with subtopics. Delete subtopics first.", 400);
    }

    await db.topic.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error deleting topic:", error);
    return errorResponse("Failed to delete topic", 500);
  }
}
```

**Step 4: Commit**

```bash
git add app/src/app/api/topics/
git commit -m "feat(api): update topics API for hierarchy"
```

---

## Task 5: Create Subtopics API

**Files:**
- Create: `app/src/app/api/topics/[id]/subtopics/route.ts`
- Create: `app/src/app/api/subtopics/[id]/route.ts`

**Step 1: Create subtopics nested route**

Create `app/src/app/api/topics/[id]/subtopics/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWriteAccess, errorResponse } from "@/lib/api-utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/topics/[id]/subtopics - Create subtopic
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: topicId } = await context.params;

  // Verify topic exists
  const topic = await db.topic.findUnique({ where: { id: topicId } });
  if (!topic) {
    return errorResponse("Topic not found", 404);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return errorResponse("Name is required", 400);
  }
  if (name.trim().length > 200) {
    return errorResponse("Name must be 200 characters or less", 400);
  }

  // Auto-detect isPrefix from name
  const isPrefix = name.trim().endsWith(":");

  // Get next display order within this topic
  const maxOrder = await db.subtopic.aggregate({
    where: { topicId },
    _max: { displayOrder: true },
  });
  const nextOrder = (maxOrder._max.displayOrder ?? 0) + 1;

  try {
    const subtopic = await db.subtopic.create({
      data: {
        topicId,
        name: name.trim(),
        isPrefix,
        displayOrder: nextOrder,
      },
      select: {
        id: true,
        name: true,
        isPrefix: true,
        displayOrder: true,
        status: true,
      },
    });

    return NextResponse.json(subtopic);
  } catch (error) {
    console.error("Database error creating subtopic:", error);
    return errorResponse("Failed to create subtopic", 500);
  }
}
```

**Step 2: Create subtopics CRUD route**

Create `app/src/app/api/subtopics/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWriteAccess, errorResponse } from "@/lib/api-utils";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/subtopics/[id] - Update subtopic
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { name, displayOrder, status } = body;

  const updateData: { name?: string; isPrefix?: boolean; displayOrder?: number; status?: "ACTIVE" | "INACTIVE" } = {};

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return errorResponse("Name is required", 400);
    }
    if (name.trim().length > 200) {
      return errorResponse("Name must be 200 characters or less", 400);
    }
    updateData.name = name.trim();
    updateData.isPrefix = name.trim().endsWith(":");
  }

  if (displayOrder !== undefined) {
    if (typeof displayOrder !== "number" || displayOrder < 0) {
      return errorResponse("Invalid display order", 400);
    }
    updateData.displayOrder = displayOrder;
  }

  if (status !== undefined) {
    if (status !== "ACTIVE" && status !== "INACTIVE") {
      return errorResponse("Invalid status", 400);
    }
    updateData.status = status;
  }

  try {
    const subtopic = await db.subtopic.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        isPrefix: true,
        displayOrder: true,
        status: true,
      },
    });

    return NextResponse.json(subtopic);
  } catch (error) {
    console.error("Database error updating subtopic:", error);
    return errorResponse("Failed to update subtopic", 500);
  }
}

// DELETE /api/subtopics/[id] - Delete subtopic (only if no entries reference it)
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;

  try {
    // Check if any time entries reference this subtopic
    const entryCount = await db.timeEntry.count({
      where: { subtopicId: id },
    });

    if (entryCount > 0) {
      return errorResponse("Cannot delete subtopic with time entries. Deactivate instead.", 400);
    }

    await db.subtopic.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error deleting subtopic:", error);
    return errorResponse("Failed to delete subtopic", 500);
  }
}
```

**Step 3: Commit**

```bash
git add app/src/app/api/topics/[id]/subtopics/ app/src/app/api/subtopics/
git commit -m "feat(api): add subtopics CRUD endpoints"
```

---

## Task 6: Update Timesheets API

**Files:**
- Modify: `app/src/app/api/timesheets/route.ts`

**Step 1: Update TIMEENTRY_SELECT**

Replace the select object and update POST handler:

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
  subtopicId: true,
  topicName: true,
  subtopicName: true,
  createdAt: true,
  updatedAt: true,
} as const;
```

**Step 2: Update POST handler**

In the POST function, replace topic validation with subtopic validation and store denormalized names:

```typescript
// Validate subtopic (required for new entries)
if (!subtopicId) {
  return errorResponse("Subtopic is required", 400);
}
const subtopic = await db.subtopic.findUnique({
  where: { id: subtopicId },
  include: {
    topic: {
      select: { name: true, status: true },
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

// ... in the create call:
const entry = await db.timeEntry.create({
  data: {
    date: parsedDate,
    hours: new Prisma.Decimal(hoursNum),
    description: (description || "").trim(),
    userId: user.id,
    clientId: clientId,
    subtopicId: subtopicId,
    topicName: subtopic.topic.name,
    subtopicName: subtopic.name,
  },
  select: TIMEENTRY_SELECT,
});
```

**Step 3: Remove PATCH handler**

Delete the entire PATCH function - entries are now immutable.

**Step 4: Commit**

```bash
git add app/src/app/api/timesheets/route.ts
git commit -m "feat(api): update timesheets for subtopic + immutability"
```

---

## Task 7: Create TopicCascadeSelect Component

**Files:**
- Create: `app/src/components/ui/TopicCascadeSelect.tsx`

**Step 1: Create the component**

Create `app/src/components/ui/TopicCascadeSelect.tsx`:

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
import type { Topic, Subtopic } from "@/types";

interface TopicCascadeSelectProps {
  topics: Topic[];
  value: string; // subtopicId
  onChange: (subtopicId: string, subtopic: Subtopic, topic: Topic) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export interface TopicCascadeSelectRef {
  open: () => void;
}

export const TopicCascadeSelect = forwardRef<TopicCascadeSelectRef, TopicCascadeSelectProps>(
  function TopicCascadeSelect(
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
    const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
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
            setSelectedTopicId(null);
            setSearch("");
          }
        },
      }),
      [disabled]
    );

    // Find selected subtopic and its topic
    const selectedData = useMemo(() => {
      for (const topic of topics) {
        const subtopic = topic.subtopics.find((s) => s.id === value);
        if (subtopic) {
          return { topic, subtopic };
        }
      }
      return null;
    }, [topics, value]);

    // Get current topic (when drilling into subtopics)
    const currentTopic = useMemo(
      () => topics.find((t) => t.id === selectedTopicId),
      [topics, selectedTopicId]
    );

    // Filter items by search
    const filteredItems = useMemo(() => {
      const searchLower = search.toLowerCase().trim();
      if (!searchLower) {
        return currentTopic ? currentTopic.subtopics : topics;
      }
      if (currentTopic) {
        return currentTopic.subtopics.filter((s) =>
          s.name.toLowerCase().includes(searchLower)
        );
      }
      return topics.filter((t) => t.name.toLowerCase().includes(searchLower));
    }, [topics, currentTopic, search]);

    // Close dropdown on outside click
    const handleClickOutside = useCallback(() => {
      setIsOpen(false);
      setSelectedTopicId(null);
      setSearch("");
    }, []);
    useClickOutside(dropdownRef, handleClickOutside, isOpen);

    // Focus search input when opened or view changes
    useEffect(() => {
      if (isOpen && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, [isOpen, selectedTopicId]);

    const handleTopicClick = (topicId: string) => {
      setSelectedTopicId(topicId);
      setSearch("");
    };

    const handleSubtopicClick = (subtopic: Subtopic) => {
      if (!currentTopic) return;
      onChange(subtopic.id, subtopic, currentTopic);
      setIsOpen(false);
      setSelectedTopicId(null);
      setSearch("");
    };

    const handleBack = () => {
      setSelectedTopicId(null);
      setSearch("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedTopicId) {
          handleBack();
        } else {
          setIsOpen(false);
          setSearch("");
        }
      }
    };

    // Display text for button
    const displayText = selectedData
      ? `${selectedData.topic.name} > ${selectedData.subtopic.name}`
      : placeholder;

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
          title={selectedData ? `${selectedData.topic.name} > ${selectedData.subtopic.name}` : undefined}
        >
          <span
            className={`truncate ${selectedData ? "" : "text-[var(--text-muted)]"}`}
          >
            {displayText}
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
            className="absolute z-50 mt-1 left-0 min-w-full w-[320px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded shadow-xl overflow-hidden animate-fade-up"
            onKeyDown={handleKeyDown}
          >
            {/* Header with back button when viewing subtopics */}
            {currentTopic && (
              <div className="px-3 py-2 border-b border-[var(--border-subtle)] flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="p-1 rounded hover:bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {currentTopic.name}
                </span>
              </div>
            )}

            {/* Search Input */}
            <div className="p-2 border-b border-[var(--border-subtle)]">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={currentTopic ? "Search subtopics..." : "Search topics..."}
                className="
                  w-full px-3 py-2 rounded-sm text-sm
                  bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                  text-[var(--text-primary)] placeholder-[var(--text-muted)]
                  focus:border-[var(--border-accent)] focus:outline-none
                  transition-all duration-200
                "
              />
            </div>

            {/* List */}
            <div className="max-h-56 overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="px-3 py-2 text-[13px] text-[var(--text-muted)]">
                  {currentTopic ? "No subtopics found" : "No topics found"}
                </div>
              ) : currentTopic ? (
                // Subtopic list
                (filteredItems as Subtopic[]).map((subtopic) => (
                  <button
                    key={subtopic.id}
                    type="button"
                    onClick={() => handleSubtopicClick(subtopic)}
                    className={`
                      w-full px-3 py-2 text-left text-sm
                      hover:bg-[var(--bg-surface)] transition-colors
                      flex items-center gap-2
                      ${value === subtopic.id ? "bg-[var(--bg-surface)]" : ""}
                    `}
                  >
                    <span className="text-[var(--text-primary)]">
                      {subtopic.name}
                    </span>
                    {subtopic.isPrefix && (
                      <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded">
                        +details
                      </span>
                    )}
                  </button>
                ))
              ) : (
                // Topic list
                (filteredItems as Topic[]).map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => handleTopicClick(topic.id)}
                    className="
                      w-full px-3 py-2 text-left text-sm
                      hover:bg-[var(--bg-surface)] transition-colors
                      flex items-center justify-between
                    "
                  >
                    <span className="text-[var(--text-primary)]">
                      {topic.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {topic.subtopics.length}
                      </span>
                      <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
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
git add app/src/components/ui/TopicCascadeSelect.tsx
git commit -m "feat(ui): add TopicCascadeSelect component"
```

---

## Task 8: Update EntryForm Component

**Files:**
- Modify: `app/src/components/timesheets/EntryForm.tsx`

**Step 1: Update imports and types**

Replace TopicSelect with TopicCascadeSelect and update the component:

```typescript
"use client";

import { useRef, useState, useEffect } from "react";
import { ClientSelect } from "@/components/ui/ClientSelect";
import { TopicCascadeSelect, TopicCascadeSelectRef } from "@/components/ui/TopicCascadeSelect";
import { DurationPicker, DurationPickerRef } from "@/components/ui/DurationPicker";
import type { Client, Topic, Subtopic, FormData } from "@/types";

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
  const topicSelectRef = useRef<TopicCascadeSelectRef>(null);
  const durationPickerRef = useRef<DurationPickerRef>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);
  const [highlightDescription, setHighlightDescription] = useState(false);

  const canSubmit =
    formData.clientId &&
    formData.subtopicId &&
    (formData.hours > 0 || formData.minutes > 0);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && canSubmit && !isLoading) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleSubtopicSelect = (subtopicId: string, subtopic: Subtopic, topic: Topic) => {
    // Pre-fill description
    let newDescription = subtopic.name;
    if (subtopic.isPrefix) {
      newDescription = subtopic.name + " ";
    }

    // Check if we should prompt about replacing
    if (formData.description.trim() && formData.description !== newDescription) {
      // For now, always replace - could add confirmation dialog later
    }

    onFormChange({
      subtopicId,
      description: newDescription,
    });

    // If prefix subtopic, highlight the description field
    if (subtopic.isPrefix) {
      setHighlightDescription(true);
      setTimeout(() => {
        descriptionInputRef.current?.focus();
        // Position cursor at end
        const input = descriptionInputRef.current;
        if (input) {
          input.setSelectionRange(input.value.length, input.value.length);
        }
      }, 0);
    } else {
      // Auto-open duration picker for non-prefix subtopics
      setTimeout(() => durationPickerRef.current?.open(), 0);
    }
  };

  // Clear highlight after timeout or typing
  useEffect(() => {
    if (highlightDescription) {
      const timer = setTimeout(() => setHighlightDescription(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [highlightDescription]);

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFormChange({ description: e.target.value });
    if (highlightDescription) {
      setHighlightDescription(false);
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
          className="w-[180px] flex-shrink-0"
        />

        {/* Topic/Subtopic Cascade Selector */}
        <TopicCascadeSelect
          ref={topicSelectRef}
          topics={topics}
          value={formData.subtopicId}
          onChange={handleSubtopicSelect}
          placeholder="Select topic..."
          className="w-[280px] flex-shrink-0"
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
          onChange={handleDescriptionChange}
          onKeyDown={handleKeyDown}
          placeholder="What did you work on?"
          className={`
            flex-1 min-w-[200px] px-3 py-2 rounded text-sm
            bg-[var(--bg-surface)] border
            text-[var(--text-primary)] placeholder-[var(--text-muted)]
            focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
            focus:outline-none transition-all duration-200
            ${highlightDescription
              ? "border-[var(--accent-pink)] ring-[2px] ring-[var(--accent-pink-glow)] animate-pulse"
              : "border-[var(--border-subtle)]"
            }
          `}
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
git commit -m "feat(ui): update EntryForm for cascade select + pre-fill"
```

---

## Task 9: Simplify EntryCard (Remove Edit Mode)

**Files:**
- Modify: `app/src/components/timesheets/EntryCard.tsx`

**Step 1: Rewrite EntryCard as display-only**

Replace the entire file with a simplified version:

```typescript
"use client";

import { useState } from "react";
import { formatHours } from "@/lib/date-utils";
import type { TimeEntry } from "@/types";

interface EntryCardProps {
  entry: TimeEntry;
  onDelete: () => void;
}

export function EntryCard({ entry, onDelete }: EntryCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDeleteClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmDelete = () => {
    onDelete();
    setShowConfirm(false);
  };

  const handleCancelDelete = () => {
    setShowConfirm(false);
  };

  // Truncate subtopic name for display
  const displaySubtopic = entry.subtopicName.length > 30
    ? entry.subtopicName.slice(0, 30) + "..."
    : entry.subtopicName;

  const fullTopicPath = entry.topicName && entry.subtopicName
    ? `${entry.topicName} > ${entry.subtopicName}`
    : null;

  return (
    <div className="p-4 hover:bg-[var(--bg-hover)] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[var(--accent-pink)] font-mono text-[11px] bg-[var(--accent-pink-glow)] px-1.5 py-0.5 rounded">
              {entry.client.timesheetCode}
            </span>
            {entry.subtopicName && (
              <span
                className="text-[var(--text-muted)] text-[11px] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded truncate max-w-[200px]"
                title={fullTopicPath || undefined}
              >
                {displaySubtopic}
              </span>
            )}
            <span className="text-[13px] text-[var(--text-muted)]">
              {formatHours(entry.hours)}
            </span>
          </div>
          <p className="text-[var(--text-secondary)] text-[13px]">
            {entry.description}
          </p>
        </div>

        {/* Delete Button */}
        <div className="flex items-center">
          {showConfirm ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleConfirmDelete}
                className="px-2 py-1 text-xs font-medium text-white bg-[var(--danger)] rounded hover:opacity-80 transition-opacity"
              >
                Delete
              </button>
              <button
                onClick={handleCancelDelete}
                className="px-2 py-1 text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded hover:border-[var(--border-accent)] transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleDeleteClick}
              className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
              title="Delete entry"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/src/components/timesheets/EntryCard.tsx
git commit -m "feat(ui): simplify EntryCard to display-only with delete"
```

---

## Task 10: Update EntriesList and TimesheetsContent

**Files:**
- Modify: `app/src/components/timesheets/EntriesList.tsx`
- Modify: `app/src/components/timesheets/TimesheetsContent.tsx`

**Step 1: Simplify EntriesList**

Update to remove edit-related props and logic. The EntryCard now only needs entry and onDelete.

**Step 2: Update TimesheetsContent**

Update to:
- Remove edit state management
- Update form data to use `subtopicId` instead of `topicId`
- Update API calls for the new structure

**Step 3: Commit**

```bash
git add app/src/components/timesheets/EntriesList.tsx app/src/components/timesheets/TimesheetsContent.tsx
git commit -m "feat(ui): update timesheets components for new structure"
```

---

## Task 11: Update Topics Admin Page

**Files:**
- Modify: `app/src/components/topics/TopicsContent.tsx`
- Modify: `app/src/components/topics/TopicModal.tsx`
- Create: `app/src/components/topics/SubtopicModal.tsx`

**Step 1: Rewrite TopicsContent with two-panel layout**

Create a new two-panel layout showing topics on left, subtopics on right.

**Step 2: Update TopicModal**

Remove code field, just name now.

**Step 3: Create SubtopicModal**

Similar to TopicModal but for subtopics, with hint about prefix behavior.

**Step 4: Commit**

```bash
git add app/src/components/topics/
git commit -m "feat(admin): two-panel topics management with subtopics"
```

---

## Task 12: Update Timesheets Page Server Component

**Files:**
- Modify: `app/src/app/(authenticated)/timesheets/page.tsx`

**Step 1: Update data fetching**

Update to fetch topics with subtopics included:

```typescript
const topics = await db.topic.findMany({
  where: { status: "ACTIVE" },
  include: {
    subtopics: {
      where: { status: "ACTIVE" },
      orderBy: { displayOrder: "asc" },
    },
  },
  orderBy: { displayOrder: "asc" },
});
```

**Step 2: Commit**

```bash
git add app/src/app/(authenticated)/timesheets/page.tsx
git commit -m "feat: update timesheets page to fetch topic hierarchy"
```

---

## Task 13: Delete Old TopicSelect Component

**Files:**
- Delete: `app/src/components/ui/TopicSelect.tsx`

**Step 1: Delete the file**

Remove the old TopicSelect component as it's replaced by TopicCascadeSelect.

**Step 2: Commit**

```bash
git rm app/src/components/ui/TopicSelect.tsx
git commit -m "chore: remove old TopicSelect component"
```

---

## Task 14: Run Tests and Fix Issues

**Step 1: Run the test suite**

Run: `cd app && npm run test -- --run`

**Step 2: Fix any failing tests**

Update tests that reference old Topic/FormData types.

**Step 3: Run lint**

Run: `cd app && npm run lint`

**Step 4: Fix any lint errors**

**Step 5: Run build**

Run: `cd app && npm run build`

**Step 6: Fix any build errors**

**Step 7: Commit fixes**

```bash
git add .
git commit -m "fix: update tests and fix lint/build errors"
```

---

## Task 15: Manual Testing

**Step 1: Start dev server**

Run: `cd app && npm run dev`

**Step 2: Test the flow**

1. Navigate to /timesheets
2. Select a client
3. Verify cascade dropdown shows topics
4. Select a topic, verify subtopics appear
5. Select a subtopic, verify description pre-fills
6. For prefix subtopics, verify description field highlights
7. Complete the form and submit
8. Verify entry appears in list with correct display
9. Verify delete works with confirmation
10. Navigate to /topics admin
11. Verify two-panel layout works
12. Test adding/editing topics and subtopics

**Step 3: Final commit if any manual fixes needed**

```bash
git add .
git commit -m "fix: manual testing fixes"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Update Prisma schema | `schema.prisma` |
| 2 | Create seed script | `seed-topics.ts` |
| 3 | Update types | `types/index.ts` |
| 4 | Update Topics API | `api/topics/route.ts` |
| 5 | Create Subtopics API | `api/subtopics/[id]/route.ts` |
| 6 | Update Timesheets API | `api/timesheets/route.ts` |
| 7 | Create TopicCascadeSelect | `TopicCascadeSelect.tsx` |
| 8 | Update EntryForm | `EntryForm.tsx` |
| 9 | Simplify EntryCard | `EntryCard.tsx` |
| 10 | Update list components | `EntriesList.tsx`, `TimesheetsContent.tsx` |
| 11 | Update admin page | `TopicsContent.tsx` |
| 12 | Update page data fetch | `timesheets/page.tsx` |
| 13 | Delete old component | `TopicSelect.tsx` |
| 14 | Run tests/lint/build | - |
| 15 | Manual testing | - |
