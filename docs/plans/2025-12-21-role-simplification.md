# Role Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the role system from 5 roles (ADMIN, PARTNER, ASSOCIATE, PARALEGAL, EMPLOYEE) to 2 roles (ADMIN, EMPLOYEE) with clear access boundaries.

**Architecture:** Create a centralized authorization module (`lib/auth-utils.ts`) with role-checking helpers. Update Sidebar to filter nav items by role. Modify API routes to use the new authorization helpers and add user-scoped filtering for timesheets.

**Tech Stack:** Next.js 16, Prisma 7, PostgreSQL, TypeScript

---

## Task 1: Create Authorization Utility Module

**Files:**
- Create: `app/src/lib/auth-utils.ts`

**Step 1: Create the authorization helpers**

```typescript
/**
 * Centralized authorization utilities for role-based access control.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";

export type AuthSession = {
  user: {
    name?: string | null;
    email?: string | null;
  };
};

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

export type AuthResult =
  | { session: AuthSession; user: AuthUser }
  | { error: string; status: number };

/**
 * Require authentication and fetch user from database.
 * Returns user with id, email, and role.
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  // Try getServerSession first
  const session = await getServerSession(authOptions);
  let email: string | null | undefined = session?.user?.email;

  // Fallback: check JWT token directly (works better with chunked cookies)
  if (!email) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    email = token?.email;
  }

  if (!email) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    return { error: "User not found. Contact administrator.", status: 403 };
  }

  return {
    session: { user: { name: session?.user?.name, email } },
    user: { id: user.id, email: user.email, role: user.role },
  };
}

/**
 * Require ADMIN role.
 * Returns 403 if user is EMPLOYEE.
 */
export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const auth = await requireAuth(request);
  if ("error" in auth) return auth;

  if (auth.user.role !== "ADMIN") {
    return { error: "Admin access required", status: 403 };
  }

  return auth;
}

/**
 * Check if user is admin.
 */
export function isAdmin(role: UserRole): boolean {
  return role === "ADMIN";
}

/**
 * Create a JSON error response.
 */
export function errorResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

/**
 * Create a JSON success response.
 */
export function successResponse<T>(data: T): NextResponse {
  return NextResponse.json(data);
}
```

**Step 2: Verify the file compiles**

Run: `cd app && npx tsc --noEmit src/lib/auth-utils.ts 2>&1 | head -20`

Expected: No errors (or only errors about missing Prisma types if schema not yet migrated)

**Step 3: Commit**

```bash
git add src/lib/auth-utils.ts
git commit -m "feat: add centralized authorization utilities"
```

---

## Task 2: Update Prisma Schema and Migrate

**Files:**
- Modify: `app/prisma/schema.prisma:29-35`

**Step 1: Update the UserRole enum**

Change from:
```prisma
enum UserRole {
  ADMIN
  PARTNER
  ASSOCIATE
  PARALEGAL
  EMPLOYEE
}
```

To:
```prisma
enum UserRole {
  ADMIN
  EMPLOYEE
}
```

**Step 2: Create migration SQL**

Create file `app/prisma/migrations/YYYYMMDDHHMMSS_simplify_roles/migration.sql` with:

```sql
-- Map existing roles to new simplified roles
UPDATE users SET role = 'ADMIN' WHERE role IN ('PARTNER', 'ASSOCIATE');
UPDATE users SET role = 'EMPLOYEE' WHERE role IN ('PARALEGAL', 'EMPLOYEE');

-- Update the enum (PostgreSQL specific)
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EMPLOYEE');
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
ALTER TABLE users ALTER COLUMN role TYPE "UserRole" USING role::text::"UserRole";
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'EMPLOYEE';
DROP TYPE "UserRole_old";
```

**Step 3: Apply migration**

Run: `cd app && npx prisma migrate dev --name simplify_roles`

Expected: Migration applied successfully

**Step 4: Regenerate Prisma client**

Run: `cd app && npm run db:generate`

Expected: Prisma client generated

**Step 5: Commit**

```bash
git add prisma/
git commit -m "feat: simplify UserRole enum to ADMIN/EMPLOYEE"
```

---

## Task 3: Update Clients API Route

**Files:**
- Modify: `app/src/app/api/clients/route.ts`

**Step 1: Replace local auth functions with centralized utilities**

Replace the entire file with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireAdmin, errorResponse, successResponse } from "@/lib/auth-utils";

const CLIENT_SELECT = {
  id: true,
  name: true,
  timesheetCode: true,
  invoicedName: true,
  invoiceAttn: true,
  email: true,
  hourlyRate: true,
  status: true,
  createdAt: true,
} as const;

function serializeClient<T extends { hourlyRate: Prisma.Decimal | null }>(client: T) {
  return {
    ...client,
    hourlyRate: client.hourlyRate ? Number(client.hourlyRate) : null,
  };
}

// GET /api/clients - List all clients (ADMIN only)
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  try {
    const clients = await db.client.findMany({
      select: CLIENT_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return successResponse(clients.map(serializeClient));
  } catch (error) {
    console.error("Database error fetching clients:", error);
    return errorResponse("Failed to fetch clients", 500);
  }
}

// POST /api/clients - Create client (ADMIN only)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { name, timesheetCode, invoicedName, invoiceAttn, email, hourlyRate, status } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return errorResponse("Name is required", 400);
  }

  if (!timesheetCode || typeof timesheetCode !== "string" || timesheetCode.trim().length === 0) {
    return errorResponse("Timesheet code is required", 400);
  }

  const existingClient = await db.client.findUnique({
    where: { timesheetCode: timesheetCode.trim() },
  });
  if (existingClient) {
    return errorResponse("Timesheet code already exists", 400);
  }

  if (email && typeof email === "string" && email.length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse("Invalid email format", 400);
    }
  }

  if (hourlyRate !== undefined && hourlyRate !== null && hourlyRate !== "") {
    const rate = Number(hourlyRate);
    if (isNaN(rate) || rate < 0) {
      return errorResponse("Hourly rate must be a positive number", 400);
    }
  }

  try {
    const client = await db.client.create({
      data: {
        name: name.trim(),
        timesheetCode: timesheetCode.trim(),
        invoicedName: invoicedName?.trim() || null,
        invoiceAttn: invoiceAttn?.trim() || null,
        email: email?.trim() || null,
        hourlyRate: hourlyRate ? new Prisma.Decimal(hourlyRate) : null,
        status: status || "ACTIVE",
      },
      select: CLIENT_SELECT,
    });

    return successResponse(serializeClient(client));
  } catch (error) {
    console.error("Database error creating client:", error);
    return errorResponse("Failed to create client", 500);
  }
}

// PATCH /api/clients - Update client (ADMIN only)
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { id, name, timesheetCode, invoicedName, invoiceAttn, email, hourlyRate, status } = body;

  if (!id) {
    return errorResponse("Client ID is required", 400);
  }

  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    return errorResponse("Name cannot be empty", 400);
  }

  if (timesheetCode !== undefined && (typeof timesheetCode !== "string" || timesheetCode.trim().length === 0)) {
    return errorResponse("Timesheet code cannot be empty", 400);
  }

  if (timesheetCode !== undefined) {
    const existingClient = await db.client.findFirst({
      where: {
        timesheetCode: timesheetCode.trim(),
        NOT: { id },
      },
    });
    if (existingClient) {
      return errorResponse("Timesheet code already exists", 400);
    }
  }

  if (email && typeof email === "string" && email.length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse("Invalid email format", 400);
    }
  }

  if (hourlyRate !== undefined && hourlyRate !== null && hourlyRate !== "") {
    const rate = Number(hourlyRate);
    if (isNaN(rate) || rate < 0) {
      return errorResponse("Hourly rate must be a positive number", 400);
    }
  }

  const updateData: Prisma.ClientUpdateInput = {};
  if (name !== undefined) updateData.name = name.trim();
  if (timesheetCode !== undefined) updateData.timesheetCode = timesheetCode.trim();
  if (invoicedName !== undefined) updateData.invoicedName = invoicedName?.trim() || null;
  if (invoiceAttn !== undefined) updateData.invoiceAttn = invoiceAttn?.trim() || null;
  if (email !== undefined) updateData.email = email?.trim() || null;
  if (hourlyRate !== undefined) {
    updateData.hourlyRate = hourlyRate ? new Prisma.Decimal(hourlyRate) : null;
  }
  if (status !== undefined) updateData.status = status;

  try {
    const client = await db.client.update({
      where: { id },
      data: updateData,
      select: CLIENT_SELECT,
    });

    return successResponse(serializeClient(client));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return errorResponse("Client not found", 404);
    }
    console.error("Database error updating client:", error);
    return errorResponse("Failed to update client", 500);
  }
}

// DELETE /api/clients - Delete client (ADMIN only)
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return errorResponse("Client ID is required", 400);
  }

  try {
    await db.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id },
        include: { _count: { select: { timeEntries: true } } },
      });

      if (!client) {
        throw new Error("NOT_FOUND");
      }

      if (client._count.timeEntries > 0) {
        throw new Error("HAS_TIME_ENTRIES");
      }

      await tx.client.delete({ where: { id } });
    });

    return successResponse({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return errorResponse("Client not found", 404);
      }
      if (error.message === "HAS_TIME_ENTRIES") {
        return errorResponse("Cannot delete client with existing time entries", 400);
      }
    }
    console.error("Database error deleting client:", error);
    return errorResponse("Failed to delete client", 500);
  }
}
```

**Step 2: Run lint**

Run: `cd app && npm run lint -- --max-warnings=0 src/app/api/clients/route.ts`

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/clients/route.ts
git commit -m "refactor: use requireAdmin for clients API"
```

---

## Task 4: Update Timesheets API Route with Role-Based Filtering

**Files:**
- Modify: `app/src/app/api/timesheets/route.ts`

**Step 1: Update to use centralized auth and add admin bypass**

Replace the entire file with:

```typescript
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireAuth, isAdmin, errorResponse, successResponse } from "@/lib/auth-utils";

const TIMEENTRY_SELECT = {
  id: true,
  date: true,
  hours: true,
  description: true,
  clientId: true,
  userId: true,
  user: {
    select: {
      id: true,
      name: true,
    },
  },
  client: {
    select: {
      id: true,
      name: true,
      timesheetCode: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} as const;

function serializeTimeEntry<T extends { hours: Prisma.Decimal; date: Date }>(entry: T) {
  return {
    ...entry,
    hours: Number(entry.hours),
    date: entry.date.toISOString().split("T")[0],
  };
}

// GET /api/timesheets?date=YYYY-MM-DD - List entries for a date
// ADMIN: sees all entries, EMPLOYEE: sees only own entries
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  if (!dateParam) {
    return errorResponse("Date parameter is required", 400);
  }

  const date = new Date(dateParam);
  if (isNaN(date.getTime())) {
    return errorResponse("Invalid date format", 400);
  }

  try {
    // ADMIN sees all entries, EMPLOYEE sees only their own
    const whereClause: Prisma.TimeEntryWhereInput = { date };
    if (!isAdmin(auth.user.role)) {
      whereClause.userId = auth.user.id;
    }

    const entries = await db.timeEntry.findMany({
      where: whereClause,
      select: TIMEENTRY_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return successResponse(entries.map(serializeTimeEntry));
  } catch (error) {
    console.error("Database error fetching time entries:", error);
    return errorResponse("Failed to fetch time entries", 500);
  }
}

// POST /api/timesheets - Create time entry
// ADMIN: can create for any user (optional userId param), EMPLOYEE: creates for self only
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { date, clientId, hours, description, userId: targetUserId } = body;

  // Determine which user the entry is for
  let entryUserId = auth.user.id;
  if (targetUserId && isAdmin(auth.user.role)) {
    // Admin can create entries for other users
    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!targetUser) {
      return errorResponse("Target user not found", 404);
    }
    entryUserId = targetUserId;
  } else if (targetUserId && targetUserId !== auth.user.id) {
    // Non-admin trying to create for another user
    return errorResponse("You can only create entries for yourself", 403);
  }

  // Validate date
  if (!date) {
    return errorResponse("Date is required", 400);
  }
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return errorResponse("Invalid date format", 400);
  }

  // Don't allow future dates
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (parsedDate > today) {
    return errorResponse("Cannot log time for future dates", 400);
  }

  // Validate client
  if (!clientId) {
    return errorResponse("Client is required", 400);
  }
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, status: true },
  });
  if (!client) {
    return errorResponse("Client not found", 404);
  }
  if (client.status !== "ACTIVE") {
    return errorResponse("Cannot log time for inactive clients", 400);
  }

  // Validate hours
  if (hours === undefined || hours === null) {
    return errorResponse("Hours is required", 400);
  }
  const hoursNum = Number(hours);
  if (isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 12) {
    return errorResponse("Hours must be between 0 and 12", 400);
  }

  // Validate description
  if (!description || typeof description !== "string") {
    return errorResponse("Description is required", 400);
  }
  if (description.trim().length < 10) {
    return errorResponse("Description must be at least 10 characters", 400);
  }

  try {
    const entry = await db.timeEntry.create({
      data: {
        date: parsedDate,
        hours: new Prisma.Decimal(hoursNum),
        description: description.trim(),
        userId: entryUserId,
        clientId: clientId,
      },
      select: TIMEENTRY_SELECT,
    });

    return successResponse(serializeTimeEntry(entry));
  } catch (error) {
    console.error("Database error creating time entry:", error);
    return errorResponse("Failed to create time entry", 500);
  }
}

// PATCH /api/timesheets - Update time entry
// ADMIN: can update any entry, EMPLOYEE: can update only own entries
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { id, clientId, hours, description } = body;

  if (!id) {
    return errorResponse("Entry ID is required", 400);
  }

  // Verify the entry exists
  const existingEntry = await db.timeEntry.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!existingEntry) {
    return errorResponse("Entry not found", 404);
  }

  // Check ownership (ADMIN can edit any, EMPLOYEE only their own)
  if (!isAdmin(auth.user.role) && existingEntry.userId !== auth.user.id) {
    return errorResponse("You can only edit your own entries", 403);
  }

  // Build update data
  const updateData: Prisma.TimeEntryUpdateInput = {};

  if (clientId !== undefined) {
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { id: true, status: true },
    });
    if (!client) {
      return errorResponse("Client not found", 404);
    }
    if (client.status !== "ACTIVE") {
      return errorResponse("Cannot log time for inactive clients", 400);
    }
    updateData.client = { connect: { id: clientId } };
  }

  if (hours !== undefined) {
    const hoursNum = Number(hours);
    if (isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 12) {
      return errorResponse("Hours must be between 0 and 12", 400);
    }
    updateData.hours = new Prisma.Decimal(hoursNum);
  }

  if (description !== undefined) {
    if (typeof description !== "string" || description.trim().length < 10) {
      return errorResponse("Description must be at least 10 characters", 400);
    }
    updateData.description = description.trim();
  }

  try {
    const entry = await db.timeEntry.update({
      where: { id },
      data: updateData,
      select: TIMEENTRY_SELECT,
    });

    return successResponse(serializeTimeEntry(entry));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return errorResponse("Entry not found", 404);
    }
    console.error("Database error updating time entry:", error);
    return errorResponse("Failed to update time entry", 500);
  }
}

// DELETE /api/timesheets?id=xxx - Delete time entry
// ADMIN: can delete any entry, EMPLOYEE: can delete only own entries
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return errorResponse("Entry ID is required", 400);
  }

  try {
    await db.$transaction(async (tx) => {
      const existingEntry = await tx.timeEntry.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!existingEntry) {
        throw new Error("NOT_FOUND");
      }

      // Check ownership (ADMIN can delete any, EMPLOYEE only their own)
      if (!isAdmin(auth.user.role) && existingEntry.userId !== auth.user.id) {
        throw new Error("FORBIDDEN");
      }

      await tx.timeEntry.delete({ where: { id } });
    });

    return successResponse({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return errorResponse("Entry not found", 404);
      }
      if (error.message === "FORBIDDEN") {
        return errorResponse("You can only delete your own entries", 403);
      }
    }
    console.error("Database error deleting time entry:", error);
    return errorResponse("Failed to delete time entry", 500);
  }
}
```

**Step 2: Run lint**

Run: `cd app && npm run lint -- --max-warnings=0 src/app/api/timesheets/route.ts`

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/timesheets/route.ts
git commit -m "feat: add role-based filtering to timesheets API"
```

---

## Task 5: Update Timesheets Dates API Route

**Files:**
- Modify: `app/src/app/api/timesheets/dates/route.ts`

**Step 1: Update to use centralized auth and add admin bypass**

Replace the entire file with:

```typescript
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireAuth, isAdmin, errorResponse, successResponse } from "@/lib/auth-utils";

// GET /api/timesheets/dates?year=2024&month=12 - Get dates with entries for a month
// ADMIN: sees all dates with entries, EMPLOYEE: sees only dates with own entries
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  if (!yearParam || !monthParam) {
    return errorResponse("Year and month parameters are required", 400);
  }

  const year = parseInt(yearParam, 10);
  const month = parseInt(monthParam, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return errorResponse("Invalid year or month", 400);
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  try {
    // ADMIN sees all dates with entries, EMPLOYEE sees only their own
    const whereClause: Prisma.TimeEntryWhereInput = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };
    if (!isAdmin(auth.user.role)) {
      whereClause.userId = auth.user.id;
    }

    const entries = await db.timeEntry.findMany({
      where: whereClause,
      select: { date: true },
      distinct: ["date"],
    });

    const dates = entries.map((e) => e.date.toISOString().split("T")[0]);

    return successResponse(dates);
  } catch (error) {
    console.error("Database error fetching dates:", error);
    return errorResponse("Failed to fetch dates", 500);
  }
}
```

**Step 2: Run lint**

Run: `cd app && npm run lint -- --max-warnings=0 src/app/api/timesheets/dates/route.ts`

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/timesheets/dates/route.ts
git commit -m "feat: add role-based filtering to timesheets dates API"
```

---

## Task 6: Update Sidebar with Role-Based Navigation

**Files:**
- Modify: `app/src/components/layout/Sidebar.tsx`

**Step 1: Replace entire Sidebar component with role-aware version**

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

// Icons as constants to avoid repetition
const Icons = {
  clients: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  employees: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  timesheets: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  billing: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  reports: (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
};

const navItems: NavItem[] = [
  { name: "Clients", href: "/clients", icon: Icons.clients, adminOnly: true },
  { name: "Employees", href: "/employees", icon: Icons.employees },
  { name: "Timesheets", href: "/timesheets", icon: Icons.timesheets },
  { name: "Billing", href: "/billing", icon: Icons.billing, adminOnly: true },
  { name: "Reports", href: "/reports", icon: Icons.reports, adminOnly: true },
];

interface SidebarProps {
  user?: {
    name: string;
    role: string;
    initials: string;
  };
  className?: string;
}

export function Sidebar({ user, className }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = user?.role === "ADMIN";

  // Filter nav items based on role
  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const NavItemComponent = ({ item }: { item: NavItem }) => {
    const isActive = pathname === item.href;

    return (
      <Link
        href={item.href}
        className={`
          relative flex items-center gap-2.5 px-3 py-2 rounded
          text-[13px] font-medium transition-all duration-200
          ${isActive
            ? "text-[var(--text-primary)] bg-gradient-to-r from-[var(--accent-pink-glow)] to-transparent"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          }
          before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2
          before:w-[2px] before:rounded-r-sm before:bg-[var(--accent-pink)]
          before:transition-all before:duration-200
          ${isActive ? "before:h-6" : "before:h-0 hover:before:h-5"}
        `}
      >
        <span className={`flex-shrink-0 ${isActive ? "text-[var(--accent-pink)]" : ""}`}>{item.icon}</span>
        <span className="truncate">{item.name}</span>
      </Link>
    );
  };

  return (
    <aside className={`fixed left-0 top-0 h-screen w-[240px] bg-[var(--bg-elevated)] border-r border-[var(--border-subtle)] flex flex-col ${className || ""}`}>
      {/* Logo */}
      <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
        <h1 className="font-heading text-[22px] font-semibold tracking-tight">
          <span className="text-[var(--accent-pink)]">Veda</span>{" "}
          <span className="text-[var(--text-primary)]">Legal</span>
        </h1>
        <p className="text-[10px] text-[var(--text-muted)] mt-0.5 tracking-wider uppercase">
          Practice Management
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-1">
          {visibleNavItems.map((item) => (
            <NavItemComponent key={item.name} item={item} />
          ))}
        </div>
      </nav>

      {/* User Profile Footer */}
      {user && (
        <div className="p-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--accent-pink)] to-[var(--accent-pink-dim)] flex items-center justify-center text-[var(--bg-deep)] font-heading font-semibold text-xs">
              {user.initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--text-primary)] truncate leading-tight">
                {user.name}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] leading-tight">{user.role}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
```

**Step 2: Run lint**

Run: `cd app && npm run lint -- --max-warnings=0 src/components/layout/Sidebar.tsx`

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: add role-based navigation filtering to Sidebar"
```

---

## Task 7: Add Route Protection for Admin-Only Pages

**Files:**
- Modify: `app/src/app/(authenticated)/clients/page.tsx`

**Step 1: Add role check and redirect for non-admins**

Replace the file with:

```typescript
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { ClientsContent } from "@/components/clients/ClientsContent";

export default async function ClientsPage() {
  const user = await getCurrentUser();

  // Only ADMIN can access clients page
  if (user.role !== "ADMIN") {
    redirect("/timesheets");
  }

  const clients = await db.client.findMany({
    select: {
      id: true,
      name: true,
      timesheetCode: true,
      invoicedName: true,
      invoiceAttn: true,
      email: true,
      hourlyRate: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const serializedClients = clients.map((client) => ({
    ...client,
    hourlyRate: client.hourlyRate ? Number(client.hourlyRate) : null,
    createdAt: client.createdAt.toISOString(),
  }));

  return <ClientsContent initialClients={serializedClients} />;
}
```

**Step 2: Run lint**

Run: `cd app && npm run lint -- --max-warnings=0 src/app/\\(authenticated\\)/clients/page.tsx`

Expected: No errors

**Step 3: Commit**

```bash
git add "src/app/(authenticated)/clients/page.tsx"
git commit -m "feat: add admin-only protection to clients page"
```

---

## Task 8: Create Placeholder Pages for Billing and Reports

**Files:**
- Create: `app/src/app/(authenticated)/billing/page.tsx`
- Create: `app/src/app/(authenticated)/reports/page.tsx`

**Step 1: Create billing page with admin protection**

```typescript
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";

export default async function BillingPage() {
  const user = await getCurrentUser();

  if (user.role !== "ADMIN") {
    redirect("/timesheets");
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
        Billing
      </h1>
      <p className="text-[var(--text-secondary)]">
        Billing features coming soon.
      </p>
    </div>
  );
}
```

**Step 2: Create reports page with admin protection**

```typescript
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";

export default async function ReportsPage() {
  const user = await getCurrentUser();

  if (user.role !== "ADMIN") {
    redirect("/timesheets");
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
        Reports
      </h1>
      <p className="text-[var(--text-secondary)]">
        Reporting features coming soon.
      </p>
    </div>
  );
}
```

**Step 3: Run lint**

Run: `cd app && npm run lint -- --max-warnings=0 "src/app/(authenticated)/billing/page.tsx" "src/app/(authenticated)/reports/page.tsx"`

Expected: No errors

**Step 4: Commit**

```bash
git add "src/app/(authenticated)/billing/page.tsx" "src/app/(authenticated)/reports/page.tsx"
git commit -m "feat: add admin-protected placeholder pages for billing and reports"
```

---

## Task 9: Update Employees Page with Read-Only for Non-Admins

**Files:**
- Modify: `app/src/app/(authenticated)/employees/page.tsx` (if exists)

**Step 1: Check if employees page exists and update**

If the page exists, update it to pass a `readOnly` prop when user is not admin. The component should hide edit/delete buttons when `readOnly` is true.

```typescript
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { EmployeesContent } from "@/components/employees/EmployeesContent";

export default async function EmployeesPage() {
  const user = await getCurrentUser();
  const isAdmin = user.role === "ADMIN";

  const employees = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      hourlyRate: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const serializedEmployees = employees.map((emp) => ({
    ...emp,
    hourlyRate: emp.hourlyRate ? Number(emp.hourlyRate) : null,
    createdAt: emp.createdAt.toISOString(),
  }));

  return <EmployeesContent initialEmployees={serializedEmployees} readOnly={!isAdmin} />;
}
```

**Step 2: Update EmployeesContent component to respect readOnly prop**

Add `readOnly?: boolean` prop and conditionally hide mutation buttons.

**Step 3: Run lint**

Run: `cd app && npm run lint`

Expected: No errors

**Step 4: Commit**

```bash
git add "src/app/(authenticated)/employees/"
git commit -m "feat: add read-only mode for employees page for non-admins"
```

---

## Task 10: Update Employees API Route

**Files:**
- Modify: `app/src/app/api/employees/route.ts` (if exists)

**Step 1: Update to use requireAuth for GET, requireAdmin for mutations**

The pattern should be:
- GET: `requireAuth` (both roles can view)
- POST/PATCH/DELETE: `requireAdmin` (only admin can modify)

**Step 2: Run lint**

Run: `cd app && npm run lint`

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/employees/
git commit -m "feat: add role-based access control to employees API"
```

---

## Task 11: Update Default Redirect

**Files:**
- Modify: `app/src/app/(authenticated)/page.tsx`

**Step 1: Change dashboard to redirect to timesheets**

Since dashboard is removed, the root authenticated page should redirect:

```typescript
import { redirect } from "next/navigation";

export default function DashboardPage() {
  redirect("/timesheets");
}
```

**Step 2: Commit**

```bash
git add "src/app/(authenticated)/page.tsx"
git commit -m "refactor: redirect dashboard to timesheets"
```

---

## Task 12: Run Full Build and Verify

**Step 1: Run lint**

Run: `cd app && npm run lint`

Expected: No errors

**Step 2: Run build**

Run: `cd app && npm run build`

Expected: Build succeeds

**Step 3: Manual verification checklist**

- [ ] EMPLOYEE can only see Employees, Timesheets in sidebar
- [ ] EMPLOYEE can only see/edit their own timesheet entries
- [ ] EMPLOYEE cannot access /clients, /billing, /reports (redirects to /timesheets)
- [ ] ADMIN sees all nav items: Clients, Employees, Timesheets, Billing, Reports
- [ ] ADMIN can see all timesheet entries
- [ ] ADMIN can access all pages

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: complete role simplification implementation"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Create centralized auth-utils module |
| 2 | Update Prisma schema and migrate roles |
| 3 | Update clients API to admin-only |
| 4 | Add role-based filtering to timesheets API |
| 5 | Add role-based filtering to timesheets dates API |
| 6 | Update Sidebar with role-based navigation |
| 7 | Add route protection to clients page |
| 8 | Create admin-protected billing/reports placeholders |
| 9 | Add read-only mode for employees page |
| 10 | Update employees API with role-based access |
| 11 | Redirect dashboard to timesheets |
| 12 | Run full build and verify |
