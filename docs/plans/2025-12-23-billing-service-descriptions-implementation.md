# Billing Service Descriptions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a monthly billing system for creating service descriptions from employee timesheet entries.

**Architecture:** Server components fetch data via Prisma, client components handle interactivity via API routes. Service descriptions are self-contained records that copy data from time entries (allowing adjustments without modifying originals).

**Tech Stack:** Next.js 16, Prisma 7, TypeScript, Tailwind CSS v4, @react-pdf/renderer

---

## Phase 1: Database Schema

### Task 1.1: Add Prisma Schema

**Files:**
- Modify: `app/prisma/schema.prisma`

**Step 1: Add new models and enums to schema.prisma**

Add after the TimeEntry model:

```prisma
// ============================================
// BILLING: Service Descriptions
// ============================================

enum ServiceDescriptionStatus {
  DRAFT
  FINALIZED
}

enum PricingMode {
  HOURLY
  FIXED
}

model ServiceDescription {
  id            String                    @id @default(cuid())
  clientId      String
  client        Client                    @relation(fields: [clientId], references: [id])
  periodStart   DateTime                  @db.Date
  periodEnd     DateTime                  @db.Date
  status        ServiceDescriptionStatus  @default(DRAFT)
  finalizedAt   DateTime?
  finalizedById String?
  finalizedBy   User?                     @relation("FinalizedServiceDescriptions", fields: [finalizedById], references: [id])

  topics        ServiceDescriptionTopic[]

  createdAt     DateTime                  @default(now())
  updatedAt     DateTime                  @updatedAt

  @@index([clientId])
  @@index([status])
  @@map("service_descriptions")
}

model ServiceDescriptionTopic {
  id                   String                       @id @default(cuid())
  serviceDescriptionId String
  serviceDescription   ServiceDescription           @relation(fields: [serviceDescriptionId], references: [id], onDelete: Cascade)
  topicName            String
  displayOrder         Int                          @default(0)
  pricingMode          PricingMode                  @default(HOURLY)
  hourlyRate           Decimal?                     @db.Decimal(10, 2)
  fixedFee             Decimal?                     @db.Decimal(10, 2)

  lineItems            ServiceDescriptionLineItem[]

  createdAt            DateTime                     @default(now())
  updatedAt            DateTime                     @updatedAt

  @@index([serviceDescriptionId])
  @@map("service_description_topics")
}

model ServiceDescriptionLineItem {
  id           String                  @id @default(cuid())
  topicId      String
  topic        ServiceDescriptionTopic @relation(fields: [topicId], references: [id], onDelete: Cascade)
  timeEntryId  String?
  timeEntry    TimeEntry?              @relation(fields: [timeEntryId], references: [id])
  date         DateTime?               @db.Date
  description  String
  hours        Decimal?                @db.Decimal(4, 2)
  fixedAmount  Decimal?                @db.Decimal(10, 2)
  displayOrder Int                     @default(0)

  createdAt    DateTime                @default(now())
  updatedAt    DateTime                @updatedAt

  @@index([topicId])
  @@index([timeEntryId])
  @@map("service_description_line_items")
}
```

**Step 2: Add relations to existing models**

Add to User model (after timeEntries relation):
```prisma
  finalizedServiceDescriptions ServiceDescription[] @relation("FinalizedServiceDescriptions")
```

Add to Client model (after timeEntries relation):
```prisma
  serviceDescriptions ServiceDescription[]
```

Add to TimeEntry model (after existing fields):
```prisma
  billingLineItems ServiceDescriptionLineItem[]
```

**Step 3: Generate and migrate**

```bash
cd app && npm run db:generate && npm run db:migrate
```

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(billing): add service description schema"
```

---

## Phase 2: TypeScript Types

### Task 2.1: Add Billing Types

**Files:**
- Modify: `app/src/types/index.ts`

**Step 1: Add billing types**

Add at end of file:

```typescript
/**
 * Service description status.
 */
export type ServiceDescriptionStatus = "DRAFT" | "FINALIZED";

/**
 * Pricing mode for a topic.
 */
export type PricingMode = "HOURLY" | "FIXED";

/**
 * Line item in a service description topic.
 */
export interface ServiceDescriptionLineItem {
  id: string;
  timeEntryId: string | null;
  date: string | null;
  description: string;
  hours: number | null;
  fixedAmount: number | null;
  displayOrder: number;
  // Original values from TimeEntry (for showing changes)
  originalDescription?: string;
  originalHours?: number;
}

/**
 * Topic section in a service description.
 */
export interface ServiceDescriptionTopic {
  id: string;
  topicName: string;
  displayOrder: number;
  pricingMode: PricingMode;
  hourlyRate: number | null;
  fixedFee: number | null;
  lineItems: ServiceDescriptionLineItem[];
}

/**
 * Service description for billing.
 */
export interface ServiceDescription {
  id: string;
  clientId: string;
  client: {
    id: string;
    name: string;
    invoicedName: string | null;
    invoiceAttn: string | null;
    hourlyRate: number | null;
  };
  periodStart: string;
  periodEnd: string;
  status: ServiceDescriptionStatus;
  finalizedAt: string | null;
  topics: ServiceDescriptionTopic[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Service description list item (without nested topics).
 */
export interface ServiceDescriptionListItem {
  id: string;
  clientId: string;
  clientName: string;
  periodStart: string;
  periodEnd: string;
  status: ServiceDescriptionStatus;
  totalAmount: number;
  updatedAt: string;
}
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(billing): add service description types"
```

---

## Phase 3: API Routes

### Task 3.1: GET/POST /api/billing

**Files:**
- Create: `app/src/app/api/billing/route.ts`

**Step 1: Create the route file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  requireAuth,
  requireWriteAccess,
  serializeDecimal,
  errorResponse,
} from "@/lib/api-utils";

// GET /api/billing - List all service descriptions
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const serviceDescriptions = await db.serviceDescription.findMany({
      select: {
        id: true,
        clientId: true,
        client: { select: { name: true } },
        periodStart: true,
        periodEnd: true,
        status: true,
        updatedAt: true,
        topics: {
          select: {
            pricingMode: true,
            hourlyRate: true,
            fixedFee: true,
            lineItems: {
              select: { hours: true, fixedAmount: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Calculate total amount for each service description
    const result = serviceDescriptions.map((sd) => {
      let totalAmount = 0;
      for (const topic of sd.topics) {
        if (topic.pricingMode === "FIXED" && topic.fixedFee) {
          totalAmount += Number(topic.fixedFee);
        } else if (topic.pricingMode === "HOURLY" && topic.hourlyRate) {
          const totalHours = topic.lineItems.reduce(
            (sum, item) => sum + (item.hours ? Number(item.hours) : 0),
            0
          );
          totalAmount += totalHours * Number(topic.hourlyRate);
          // Add fixed amounts from line items
          totalAmount += topic.lineItems.reduce(
            (sum, item) => sum + (item.fixedAmount ? Number(item.fixedAmount) : 0),
            0
          );
        }
      }

      return {
        id: sd.id,
        clientId: sd.clientId,
        clientName: sd.client.name,
        periodStart: sd.periodStart.toISOString().split("T")[0],
        periodEnd: sd.periodEnd.toISOString().split("T")[0],
        status: sd.status,
        totalAmount: Math.round(totalAmount * 100) / 100,
        updatedAt: sd.updatedAt.toISOString(),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Database error fetching service descriptions:", error);
    return errorResponse("Failed to fetch service descriptions", 500);
  }
}

// POST /api/billing - Create new service description
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

  const { clientId, periodStart, periodEnd } = body;

  if (!clientId || typeof clientId !== "string") {
    return errorResponse("Client ID is required", 400);
  }

  if (!periodStart || !periodEnd) {
    return errorResponse("Period start and end dates are required", 400);
  }

  const startDate = new Date(periodStart);
  const endDate = new Date(periodEnd);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return errorResponse("Invalid date format", 400);
  }

  if (startDate > endDate) {
    return errorResponse("Period start must be before end", 400);
  }

  try {
    // Get client with hourly rate
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { id: true, hourlyRate: true },
    });

    if (!client) {
      return errorResponse("Client not found", 404);
    }

    // Get unbilled time entries for this client in the date range
    // Exclude entries that are in FINALIZED service descriptions
    const unbilledEntries = await db.timeEntry.findMany({
      where: {
        clientId,
        date: { gte: startDate, lte: endDate },
        billingLineItems: {
          none: {
            topic: {
              serviceDescription: { status: "FINALIZED" },
            },
          },
        },
      },
      select: {
        id: true,
        date: true,
        hours: true,
        description: true,
        topicName: true,
      },
      orderBy: [{ topicName: "asc" }, { date: "asc" }],
    });

    // Group entries by topic
    const entriesByTopic = new Map<string, typeof unbilledEntries>();
    for (const entry of unbilledEntries) {
      const topicName = entry.topicName || "Other";
      if (!entriesByTopic.has(topicName)) {
        entriesByTopic.set(topicName, []);
      }
      entriesByTopic.get(topicName)!.push(entry);
    }

    // Create service description with topics and line items
    const serviceDescription = await db.serviceDescription.create({
      data: {
        clientId,
        periodStart: startDate,
        periodEnd: endDate,
        status: "DRAFT",
        topics: {
          create: Array.from(entriesByTopic.entries()).map(
            ([topicName, entries], topicIndex) => ({
              topicName,
              displayOrder: topicIndex,
              pricingMode: "HOURLY",
              hourlyRate: client.hourlyRate,
              lineItems: {
                create: entries.map((entry, itemIndex) => ({
                  timeEntryId: entry.id,
                  date: entry.date,
                  description: entry.description,
                  hours: entry.hours,
                  displayOrder: itemIndex,
                })),
              },
            })
          ),
        },
      },
      select: { id: true },
    });

    return NextResponse.json({ id: serviceDescription.id });
  } catch (error) {
    console.error("Database error creating service description:", error);
    return errorResponse("Failed to create service description", 500);
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/billing/route.ts
git commit -m "feat(billing): add GET/POST /api/billing endpoints"
```

### Task 3.2: GET/PATCH/DELETE /api/billing/[id]

**Files:**
- Create: `app/src/app/api/billing/[id]/route.ts`

**Step 1: Create the route file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  requireAuth,
  requireWriteAccess,
  serializeDecimal,
  errorResponse,
  getUserFromSession,
} from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string }> };

// Helper to serialize a full service description
function serializeServiceDescription(sd: any) {
  return {
    id: sd.id,
    clientId: sd.clientId,
    client: {
      id: sd.client.id,
      name: sd.client.name,
      invoicedName: sd.client.invoicedName,
      invoiceAttn: sd.client.invoiceAttn,
      hourlyRate: serializeDecimal(sd.client.hourlyRate),
    },
    periodStart: sd.periodStart.toISOString().split("T")[0],
    periodEnd: sd.periodEnd.toISOString().split("T")[0],
    status: sd.status,
    finalizedAt: sd.finalizedAt?.toISOString() || null,
    topics: sd.topics.map((topic: any) => ({
      id: topic.id,
      topicName: topic.topicName,
      displayOrder: topic.displayOrder,
      pricingMode: topic.pricingMode,
      hourlyRate: serializeDecimal(topic.hourlyRate),
      fixedFee: serializeDecimal(topic.fixedFee),
      lineItems: topic.lineItems.map((item: any) => ({
        id: item.id,
        timeEntryId: item.timeEntryId,
        date: item.date?.toISOString().split("T")[0] || null,
        description: item.description,
        hours: serializeDecimal(item.hours),
        fixedAmount: serializeDecimal(item.fixedAmount),
        displayOrder: item.displayOrder,
        originalDescription: item.timeEntry?.description,
        originalHours: item.timeEntry ? serializeDecimal(item.timeEntry.hours) : undefined,
      })),
    })),
    createdAt: sd.createdAt.toISOString(),
    updatedAt: sd.updatedAt.toISOString(),
  };
}

// GET /api/billing/[id] - Get service description with all details
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  try {
    const sd = await db.serviceDescription.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            invoicedName: true,
            invoiceAttn: true,
            hourlyRate: true,
          },
        },
        topics: {
          orderBy: { displayOrder: "asc" },
          include: {
            lineItems: {
              orderBy: { displayOrder: "asc" },
              include: {
                timeEntry: { select: { description: true, hours: true } },
              },
            },
          },
        },
      },
    });

    if (!sd) {
      return errorResponse("Service description not found", 404);
    }

    return NextResponse.json(serializeServiceDescription(sd));
  } catch (error) {
    console.error("Database error fetching service description:", error);
    return errorResponse("Failed to fetch service description", 500);
  }
}

// PATCH /api/billing/[id] - Update status (finalize/unlock)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { status } = body;

  if (!status || !["DRAFT", "FINALIZED"].includes(status)) {
    return errorResponse("Invalid status", 400);
  }

  try {
    const existing = await db.serviceDescription.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return errorResponse("Service description not found", 404);
    }

    const updateData: any = { status };

    if (status === "FINALIZED") {
      const user = await getUserFromSession(auth.session.user?.email);
      updateData.finalizedAt = new Date();
      updateData.finalizedById = user?.id || null;
    } else {
      // Unlocking - clear finalized info
      updateData.finalizedAt = null;
      updateData.finalizedById = null;
    }

    const updated = await db.serviceDescription.update({
      where: { id },
      data: updateData,
      select: { id: true, status: true, finalizedAt: true },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      finalizedAt: updated.finalizedAt?.toISOString() || null,
    });
  } catch (error) {
    console.error("Database error updating service description:", error);
    return errorResponse("Failed to update service description", 500);
  }
}

// DELETE /api/billing/[id] - Delete draft service description
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  try {
    const existing = await db.serviceDescription.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      return errorResponse("Service description not found", 404);
    }

    if (existing.status === "FINALIZED") {
      return errorResponse("Cannot delete finalized service description", 400);
    }

    await db.serviceDescription.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error deleting service description:", error);
    return errorResponse("Failed to delete service description", 500);
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/billing/[id]/route.ts
git commit -m "feat(billing): add GET/PATCH/DELETE /api/billing/[id] endpoints"
```

### Task 3.3: Topic API Routes

**Files:**
- Create: `app/src/app/api/billing/[id]/topics/route.ts`
- Create: `app/src/app/api/billing/[id]/topics/[topicId]/route.ts`

**Step 1: Create POST topics route**

```typescript
// app/src/app/api/billing/[id]/topics/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireWriteAccess, serializeDecimal, errorResponse } from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string }> };

// POST /api/billing/[id]/topics - Add topic
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { topicName, pricingMode, hourlyRate, fixedFee } = body;

  if (!topicName || typeof topicName !== "string" || topicName.trim().length === 0) {
    return errorResponse("Topic name is required", 400);
  }

  try {
    // Verify service description exists and is draft
    const sd = await db.serviceDescription.findUnique({
      where: { id },
      select: { status: true, topics: { select: { displayOrder: true } } },
    });

    if (!sd) {
      return errorResponse("Service description not found", 404);
    }

    if (sd.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    const maxOrder = Math.max(0, ...sd.topics.map((t) => t.displayOrder));

    const topic = await db.serviceDescriptionTopic.create({
      data: {
        serviceDescriptionId: id,
        topicName: topicName.trim(),
        displayOrder: maxOrder + 1,
        pricingMode: pricingMode || "HOURLY",
        hourlyRate: hourlyRate ? new Prisma.Decimal(hourlyRate) : null,
        fixedFee: fixedFee ? new Prisma.Decimal(fixedFee) : null,
      },
      select: {
        id: true,
        topicName: true,
        displayOrder: true,
        pricingMode: true,
        hourlyRate: true,
        fixedFee: true,
      },
    });

    return NextResponse.json({
      id: topic.id,
      topicName: topic.topicName,
      displayOrder: topic.displayOrder,
      pricingMode: topic.pricingMode,
      hourlyRate: serializeDecimal(topic.hourlyRate),
      fixedFee: serializeDecimal(topic.fixedFee),
      lineItems: [],
    });
  } catch (error) {
    console.error("Database error creating topic:", error);
    return errorResponse("Failed to create topic", 500);
  }
}
```

**Step 2: Create PATCH/DELETE topic route**

```typescript
// app/src/app/api/billing/[id]/topics/[topicId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireWriteAccess, serializeDecimal, errorResponse } from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string; topicId: string }> };

// PATCH /api/billing/[id]/topics/[topicId] - Update topic
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, topicId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  try {
    // Verify service description is draft
    const sd = await db.serviceDescription.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!sd) {
      return errorResponse("Service description not found", 404);
    }

    if (sd.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    const updateData: Prisma.ServiceDescriptionTopicUpdateInput = {};

    if (body.topicName !== undefined) {
      updateData.topicName = body.topicName.trim();
    }
    if (body.pricingMode !== undefined) {
      updateData.pricingMode = body.pricingMode;
    }
    if (body.hourlyRate !== undefined) {
      updateData.hourlyRate = body.hourlyRate ? new Prisma.Decimal(body.hourlyRate) : null;
    }
    if (body.fixedFee !== undefined) {
      updateData.fixedFee = body.fixedFee ? new Prisma.Decimal(body.fixedFee) : null;
    }
    if (body.displayOrder !== undefined) {
      updateData.displayOrder = body.displayOrder;
    }

    const topic = await db.serviceDescriptionTopic.update({
      where: { id: topicId },
      data: updateData,
      select: {
        id: true,
        topicName: true,
        displayOrder: true,
        pricingMode: true,
        hourlyRate: true,
        fixedFee: true,
      },
    });

    return NextResponse.json({
      id: topic.id,
      topicName: topic.topicName,
      displayOrder: topic.displayOrder,
      pricingMode: topic.pricingMode,
      hourlyRate: serializeDecimal(topic.hourlyRate),
      fixedFee: serializeDecimal(topic.fixedFee),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return errorResponse("Topic not found", 404);
    }
    console.error("Database error updating topic:", error);
    return errorResponse("Failed to update topic", 500);
  }
}

// DELETE /api/billing/[id]/topics/[topicId] - Delete topic
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, topicId } = await params;

  try {
    const sd = await db.serviceDescription.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!sd) {
      return errorResponse("Service description not found", 404);
    }

    if (sd.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    await db.serviceDescriptionTopic.delete({ where: { id: topicId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return errorResponse("Topic not found", 404);
    }
    console.error("Database error deleting topic:", error);
    return errorResponse("Failed to delete topic", 500);
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/billing/[id]/topics/
git commit -m "feat(billing): add topic CRUD endpoints"
```

### Task 3.4: Line Item API Routes

**Files:**
- Create: `app/src/app/api/billing/[id]/topics/[topicId]/items/route.ts`
- Create: `app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.ts`

**Step 1: Create POST items route**

```typescript
// app/src/app/api/billing/[id]/topics/[topicId]/items/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireWriteAccess, serializeDecimal, errorResponse } from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string; topicId: string }> };

// POST - Add line item
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, topicId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { date, description, hours, fixedAmount } = body;

  if (!description || typeof description !== "string" || description.trim().length === 0) {
    return errorResponse("Description is required", 400);
  }

  try {
    // Verify topic exists and service description is draft
    const topic = await db.serviceDescriptionTopic.findUnique({
      where: { id: topicId },
      select: {
        serviceDescription: { select: { id: true, status: true } },
        lineItems: { select: { displayOrder: true } },
      },
    });

    if (!topic || topic.serviceDescription.id !== id) {
      return errorResponse("Topic not found", 404);
    }

    if (topic.serviceDescription.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    const maxOrder = Math.max(0, ...topic.lineItems.map((i) => i.displayOrder));

    const item = await db.serviceDescriptionLineItem.create({
      data: {
        topicId,
        date: date ? new Date(date) : null,
        description: description.trim(),
        hours: hours ? new Prisma.Decimal(hours) : null,
        fixedAmount: fixedAmount ? new Prisma.Decimal(fixedAmount) : null,
        displayOrder: maxOrder + 1,
      },
      select: {
        id: true,
        timeEntryId: true,
        date: true,
        description: true,
        hours: true,
        fixedAmount: true,
        displayOrder: true,
      },
    });

    return NextResponse.json({
      id: item.id,
      timeEntryId: item.timeEntryId,
      date: item.date?.toISOString().split("T")[0] || null,
      description: item.description,
      hours: serializeDecimal(item.hours),
      fixedAmount: serializeDecimal(item.fixedAmount),
      displayOrder: item.displayOrder,
    });
  } catch (error) {
    console.error("Database error creating line item:", error);
    return errorResponse("Failed to create line item", 500);
  }
}
```

**Step 2: Create PATCH/DELETE item route**

```typescript
// app/src/app/api/billing/[id]/topics/[topicId]/items/[itemId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireWriteAccess, serializeDecimal, errorResponse } from "@/lib/api-utils";

type RouteParams = { params: Promise<{ id: string; topicId: string; itemId: string }> };

// PATCH - Update line item
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, topicId, itemId } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  try {
    // Verify hierarchy and draft status
    const item = await db.serviceDescriptionLineItem.findUnique({
      where: { id: itemId },
      select: {
        topic: {
          select: {
            id: true,
            serviceDescription: { select: { id: true, status: true } },
          },
        },
      },
    });

    if (!item || item.topic.id !== topicId || item.topic.serviceDescription.id !== id) {
      return errorResponse("Line item not found", 404);
    }

    if (item.topic.serviceDescription.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    const updateData: Prisma.ServiceDescriptionLineItemUpdateInput = {};

    if (body.date !== undefined) {
      updateData.date = body.date ? new Date(body.date) : null;
    }
    if (body.description !== undefined) {
      updateData.description = body.description.trim();
    }
    if (body.hours !== undefined) {
      updateData.hours = body.hours ? new Prisma.Decimal(body.hours) : null;
    }
    if (body.fixedAmount !== undefined) {
      updateData.fixedAmount = body.fixedAmount ? new Prisma.Decimal(body.fixedAmount) : null;
    }
    if (body.displayOrder !== undefined) {
      updateData.displayOrder = body.displayOrder;
    }

    const updated = await db.serviceDescriptionLineItem.update({
      where: { id: itemId },
      data: updateData,
      select: {
        id: true,
        timeEntryId: true,
        date: true,
        description: true,
        hours: true,
        fixedAmount: true,
        displayOrder: true,
        timeEntry: { select: { description: true, hours: true } },
      },
    });

    return NextResponse.json({
      id: updated.id,
      timeEntryId: updated.timeEntryId,
      date: updated.date?.toISOString().split("T")[0] || null,
      description: updated.description,
      hours: serializeDecimal(updated.hours),
      fixedAmount: serializeDecimal(updated.fixedAmount),
      displayOrder: updated.displayOrder,
      originalDescription: updated.timeEntry?.description,
      originalHours: updated.timeEntry ? serializeDecimal(updated.timeEntry.hours) : undefined,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return errorResponse("Line item not found", 404);
    }
    console.error("Database error updating line item:", error);
    return errorResponse("Failed to update line item", 500);
  }
}

// DELETE - Delete line item
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id, topicId, itemId } = await params;

  try {
    const item = await db.serviceDescriptionLineItem.findUnique({
      where: { id: itemId },
      select: {
        topic: {
          select: {
            id: true,
            serviceDescription: { select: { id: true, status: true } },
          },
        },
      },
    });

    if (!item || item.topic.id !== topicId || item.topic.serviceDescription.id !== id) {
      return errorResponse("Line item not found", 404);
    }

    if (item.topic.serviceDescription.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    await db.serviceDescriptionLineItem.delete({ where: { id: itemId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error deleting line item:", error);
    return errorResponse("Failed to delete line item", 500);
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/billing/[id]/topics/[topicId]/items/
git commit -m "feat(billing): add line item CRUD endpoints"
```

---

## Phase 4: UI Components

### Task 4.1: Billing List Page

**Files:**
- Modify: `app/src/app/(authenticated)/billing/page.tsx`
- Create: `app/src/components/billing/BillingContent.tsx`
- Create: `app/src/components/billing/CreateServiceDescriptionModal.tsx`

See separate implementation file for UI components (split due to size).

### Task 4.2: Service Description Detail Page

**Files:**
- Create: `app/src/app/(authenticated)/billing/[id]/page.tsx`
- Create: `app/src/components/billing/ServiceDescriptionDetail.tsx`
- Create: `app/src/components/billing/TopicSection.tsx`
- Create: `app/src/components/billing/LineItemRow.tsx`
- Create: `app/src/components/billing/AddLineItemModal.tsx`
- Create: `app/src/components/billing/AddTopicModal.tsx`

See separate implementation file for UI components (split due to size).

---

## Phase 5: PDF Export

### Task 5.1: Install react-pdf

**Step 1: Install dependency**

```bash
cd app && npm install @react-pdf/renderer
```

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @react-pdf/renderer for PDF export"
```

### Task 5.2: Create PDF Template and Route

**Files:**
- Create: `app/src/app/api/billing/[id]/pdf/route.ts`
- Create: `app/src/lib/billing-pdf.tsx`

See separate implementation file for PDF generation (split due to size).

---

## Execution Order Summary

1. **Phase 1**: Database schema (Task 1.1)
2. **Phase 2**: TypeScript types (Task 2.1)
3. **Phase 3**: API routes (Tasks 3.1-3.4)
4. **Phase 4**: UI components (Tasks 4.1-4.2)
5. **Phase 5**: PDF export (Tasks 5.1-5.2)

Each phase builds on the previous. Run tests and verify after each task before proceeding.
