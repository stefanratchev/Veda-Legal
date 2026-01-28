# Leave Periods Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add leave period tracking so approved leave days are excluded from overdue timesheet calculations.

**Architecture:** New `leavePeriods` table with CRUD API at `/api/leave`. UI page at `/leave` for all users to request leave, with admin approval workflow. Modify `getOverdueDates()` to accept leave periods and exclude approved dates.

**Tech Stack:** Drizzle ORM, Next.js App Router, React, Tailwind CSS, Vitest

---

## Task 1: Add Database Schema

**Files:**
- Modify: `app/src/lib/schema.ts`

**Step 1: Add enums and table definition**

Add after the existing `topicType` enum (around line 13):

```typescript
export const leaveType = pgEnum("LeaveType", ['VACATION', 'SICK_LEAVE', 'MATERNITY_PATERNITY'])
export const leaveStatus = pgEnum("LeaveStatus", ['PENDING', 'APPROVED', 'REJECTED'])
```

Add the table definition after `timesheetSubmissions` table (around line 201):

```typescript
export const leavePeriods = pgTable("leave_periods", {
	id: text().primaryKey().notNull(),
	userId: text().notNull(),
	startDate: date().notNull(),
	endDate: date().notNull(),
	leaveType: leaveType().notNull(),
	status: leaveStatus().default('PENDING').notNull(),
	reason: text(),
	reviewedById: text(),
	reviewedAt: timestamp({ precision: 3, mode: 'string' }),
	rejectionReason: text(),
	createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
}, (table) => [
	index("leave_periods_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("leave_periods_status_idx").using("btree", table.status.asc().nullsLast().op("enum_ops")),
	index("leave_periods_startDate_idx").using("btree", table.startDate.asc().nullsLast().op("date_ops")),
	foreignKey({
		columns: [table.userId],
		foreignColumns: [users.id],
		name: "leave_periods_userId_fkey"
	}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
		columns: [table.reviewedById],
		foreignColumns: [users.id],
		name: "leave_periods_reviewedById_fkey"
	}).onUpdate("cascade").onDelete("set null"),
]);
```

**Step 2: Add relations**

Add after `timesheetSubmissionsRelations`:

```typescript
export const leavePeriodsRelations = relations(leavePeriods, ({ one }) => ({
  user: one(users, {
    fields: [leavePeriods.userId],
    references: [users.id],
  }),
  reviewedBy: one(users, {
    fields: [leavePeriods.reviewedById],
    references: [users.id],
    relationName: "reviewedLeave",
  }),
}));
```

Update `usersRelations` to include leave periods:

```typescript
export const usersRelations = relations(users, ({ many }) => ({
  timeEntries: many(timeEntries),
  finalizedServiceDescriptions: many(serviceDescriptions),
  timesheetSubmissions: many(timesheetSubmissions),
  leavePeriods: many(leavePeriods),
}));
```

**Step 3: Run migration**

```bash
cd app && npm run db:generate && npm run db:migrate
```

Expected: Migration file created in `app/drizzle/` and applied successfully.

**Step 4: Commit**

```bash
git add app/src/lib/schema.ts app/drizzle/
git commit -m "feat(schema): add leave_periods table for absence tracking"
```

---

## Task 2: Add TypeScript Types

**Files:**
- Modify: `app/src/types/index.ts`

**Step 1: Add leave period types**

Add at the end of the file (before the M365 re-exports):

```typescript
/**
 * Leave type for absence categorization.
 */
export type LeaveType = "VACATION" | "SICK_LEAVE" | "MATERNITY_PATERNITY";

/**
 * Leave request status.
 */
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

/**
 * Leave period for absence tracking.
 */
export interface LeavePeriod {
  id: string;
  userId: string;
  userName?: string;
  startDate: string;
  endDate: string;
  leaveType: LeaveType;
  status: LeaveStatus;
  reason: string | null;
  reviewedById: string | null;
  reviewedByName?: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

/**
 * Form data for creating/editing leave requests.
 */
export interface LeaveFormData {
  startDate: string;
  endDate: string;
  leaveType: LeaveType;
  reason: string;
}
```

**Step 2: Commit**

```bash
git add app/src/types/index.ts
git commit -m "feat(types): add LeavePeriod and LeaveFormData types"
```

---

## Task 3: Create Leave API - GET Endpoint

**Files:**
- Create: `app/src/app/api/leave/route.ts`
- Create: `app/src/app/api/leave/route.test.ts`

**Step 1: Write the failing test**

Create `app/src/app/api/leave/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser } from "@/test/mocks/factories";

const { mockRequireAuth, mockGetUserFromSession, mockDb } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockGetUserFromSession: vi.fn(),
  mockDb: {
    query: {
      leavePeriods: {
        findMany: vi.fn(),
      },
    },
    insert: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...original,
    requireAuth: mockRequireAuth,
    getUserFromSession: mockGetUserFromSession,
  };
});

import { GET } from "./route";

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

describe("GET /api/leave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

    const request = createMockRequest({ method: "GET", url: "/api/leave" });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("returns own leave periods for regular user", async () => {
    const user = createMockUser({ position: "ASSOCIATE" });
    setupAuthenticatedUser(user);

    const mockLeave = [{
      id: "leave-1",
      userId: user.id,
      startDate: "2024-12-23",
      endDate: "2024-12-27",
      leaveType: "VACATION",
      status: "APPROVED",
      reason: "Holiday break",
      reviewedById: null,
      reviewedAt: null,
      rejectionReason: null,
      createdAt: "2024-12-01T10:00:00.000Z",
      user: { name: user.name },
      reviewedBy: null,
    }];
    mockDb.query.leavePeriods.findMany.mockResolvedValue(mockLeave);

    const request = createMockRequest({ method: "GET", url: "/api/leave" });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.leavePeriods).toHaveLength(1);
    expect(data.leavePeriods[0].id).toBe("leave-1");
  });

  it("returns all leave periods for admin", async () => {
    const user = createMockUser({ position: "ADMIN" });
    setupAuthenticatedUser(user);

    const mockLeave = [
      { id: "leave-1", userId: "user-1", user: { name: "User 1" }, reviewedBy: null },
      { id: "leave-2", userId: "user-2", user: { name: "User 2" }, reviewedBy: null },
    ];
    mockDb.query.leavePeriods.findMany.mockResolvedValue(mockLeave);

    const request = createMockRequest({ method: "GET", url: "/api/leave" });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.leavePeriods).toHaveLength(2);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd app && npm run test -- api/leave/route.test.ts --run
```

Expected: FAIL - Cannot find module './route'

**Step 3: Write the implementation**

Create `app/src/app/api/leave/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { leavePeriods } from "@/lib/schema";
import { requireAuth, getUserFromSession, errorResponse, hasAdminAccess, parseDate } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return errorResponse("User not found", 404);
  }

  const searchParams = request.nextUrl.searchParams;
  const statusFilter = searchParams.get("status");
  const userIdFilter = searchParams.get("userId");

  try {
    const isAdmin = hasAdminAccess(user.position);

    // Build where conditions based on role and filters
    const whereConditions = [];

    if (!isAdmin) {
      // Regular users can only see their own leave
      whereConditions.push(eq(leavePeriods.userId, user.id));
    } else if (userIdFilter) {
      // Admin filtering by specific user
      whereConditions.push(eq(leavePeriods.userId, userIdFilter));
    }

    if (statusFilter && ["PENDING", "APPROVED", "REJECTED"].includes(statusFilter)) {
      whereConditions.push(eq(leavePeriods.status, statusFilter as "PENDING" | "APPROVED" | "REJECTED"));
    }

    const results = await db.query.leavePeriods.findMany({
      where: whereConditions.length > 0
        ? whereConditions.length === 1
          ? whereConditions[0]
          : undefined // Will need AND for multiple - simplified for now
        : undefined,
      with: {
        user: { columns: { name: true } },
        reviewedBy: { columns: { name: true } },
      },
      orderBy: [desc(leavePeriods.createdAt)],
    });

    // Transform for response
    const leavePeriodsList = results.map((lp) => ({
      id: lp.id,
      userId: lp.userId,
      userName: lp.user?.name || null,
      startDate: lp.startDate,
      endDate: lp.endDate,
      leaveType: lp.leaveType,
      status: lp.status,
      reason: lp.reason,
      reviewedById: lp.reviewedById,
      reviewedByName: lp.reviewedBy?.name || null,
      reviewedAt: lp.reviewedAt,
      rejectionReason: lp.rejectionReason,
      createdAt: lp.createdAt,
    }));

    return NextResponse.json({ leavePeriods: leavePeriodsList });
  } catch (error) {
    console.error("Error fetching leave periods:", error);
    return errorResponse("Failed to fetch leave periods", 500);
  }
}
```

**Step 4: Run test to verify it passes**

```bash
cd app && npm run test -- api/leave/route.test.ts --run
```

Expected: PASS

**Step 5: Commit**

```bash
git add app/src/app/api/leave/
git commit -m "feat(api): add GET /api/leave endpoint"
```

---

## Task 4: Create Leave API - POST Endpoint

**Files:**
- Modify: `app/src/app/api/leave/route.ts`
- Modify: `app/src/app/api/leave/route.test.ts`

**Step 1: Add POST tests**

Append to `route.test.ts`:

```typescript
import { POST } from "./route";

describe("POST /api/leave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

    const request = createMockRequest({
      method: "POST",
      url: "/api/leave",
      body: { startDate: "2024-12-23", endDate: "2024-12-27", leaveType: "VACATION" },
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it("returns 400 when dates are missing", async () => {
    const user = createMockUser();
    setupAuthenticatedUser(user);

    const request = createMockRequest({
      method: "POST",
      url: "/api/leave",
      body: { leaveType: "VACATION" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("required");
  });

  it("returns 400 when startDate > endDate", async () => {
    const user = createMockUser();
    setupAuthenticatedUser(user);

    const request = createMockRequest({
      method: "POST",
      url: "/api/leave",
      body: { startDate: "2024-12-27", endDate: "2024-12-23", leaveType: "VACATION" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("before");
  });

  it("creates pending leave request for regular user", async () => {
    const user = createMockUser({ position: "ASSOCIATE" });
    setupAuthenticatedUser(user);

    mockDb.query.leavePeriods.findMany.mockResolvedValue([]);
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: "leave-new",
          userId: user.id,
          startDate: "2024-12-23",
          endDate: "2024-12-27",
          leaveType: "VACATION",
          status: "PENDING",
          reason: null,
          createdAt: "2024-12-01T10:00:00.000Z",
        }]),
      }),
    });

    const request = createMockRequest({
      method: "POST",
      url: "/api/leave",
      body: { startDate: "2024-12-23", endDate: "2024-12-27", leaveType: "VACATION" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.status).toBe("PENDING");
  });

  it("creates auto-approved leave when admin creates for another user", async () => {
    const admin = createMockUser({ position: "ADMIN" });
    setupAuthenticatedUser(admin);

    mockDb.query.leavePeriods.findMany.mockResolvedValue([]);
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: "leave-new",
          userId: "other-user-id",
          startDate: "2024-12-23",
          endDate: "2024-12-27",
          leaveType: "VACATION",
          status: "APPROVED",
          reviewedById: admin.id,
          createdAt: "2024-12-01T10:00:00.000Z",
        }]),
      }),
    });

    const request = createMockRequest({
      method: "POST",
      url: "/api/leave",
      body: {
        startDate: "2024-12-23",
        endDate: "2024-12-27",
        leaveType: "VACATION",
        userId: "other-user-id",
      },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.status).toBe("APPROVED");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd app && npm run test -- api/leave/route.test.ts --run
```

Expected: FAIL - POST is not exported

**Step 3: Add POST implementation**

Add to `route.ts`:

```typescript
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return errorResponse("User not found", 404);
  }

  let body: {
    startDate?: string;
    endDate?: string;
    leaveType?: string;
    reason?: string;
    userId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  // Validate required fields
  if (!body.startDate || !body.endDate) {
    return errorResponse("startDate and endDate are required", 400);
  }

  if (!body.leaveType || !["VACATION", "SICK_LEAVE", "MATERNITY_PATERNITY"].includes(body.leaveType)) {
    return errorResponse("Valid leaveType is required (VACATION, SICK_LEAVE, MATERNITY_PATERNITY)", 400);
  }

  // Validate dates
  const startDate = parseDate(body.startDate);
  const endDate = parseDate(body.endDate);

  if (!startDate || !endDate) {
    return errorResponse("Invalid date format", 400);
  }

  if (startDate > endDate) {
    return errorResponse("startDate must be before or equal to endDate", 400);
  }

  const isAdmin = hasAdminAccess(user.position);
  const targetUserId = (isAdmin && body.userId) ? body.userId : user.id;
  const isAutoApproved = isAdmin && body.userId && body.userId !== user.id;

  try {
    // Check for overlapping leave periods
    const existingLeave = await db.query.leavePeriods.findMany({
      where: eq(leavePeriods.userId, targetUserId),
    });

    const hasOverlap = existingLeave.some((lp) => {
      if (lp.status === "REJECTED") return false;
      const lpStart = new Date(lp.startDate);
      const lpEnd = new Date(lp.endDate);
      return startDate <= lpEnd && endDate >= lpStart;
    });

    if (hasOverlap) {
      return errorResponse("Leave period overlaps with existing leave", 400);
    }

    const now = new Date().toISOString();
    const [created] = await db
      .insert(leavePeriods)
      .values({
        id: createId(),
        userId: targetUserId,
        startDate: body.startDate,
        endDate: body.endDate,
        leaveType: body.leaveType as "VACATION" | "SICK_LEAVE" | "MATERNITY_PATERNITY",
        status: isAutoApproved ? "APPROVED" : "PENDING",
        reason: body.reason || null,
        reviewedById: isAutoApproved ? user.id : null,
        reviewedAt: isAutoApproved ? now : null,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Error creating leave period:", error);
    return errorResponse("Failed to create leave period", 500);
  }
}
```

**Step 4: Run tests**

```bash
cd app && npm run test -- api/leave/route.test.ts --run
```

Expected: PASS

**Step 5: Commit**

```bash
git add app/src/app/api/leave/
git commit -m "feat(api): add POST /api/leave endpoint"
```

---

## Task 5: Create Leave API - PATCH Endpoint

**Files:**
- Create: `app/src/app/api/leave/[id]/route.ts`
- Create: `app/src/app/api/leave/[id]/route.test.ts`

**Step 1: Write the failing test**

Create `app/src/app/api/leave/[id]/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser } from "@/test/mocks/factories";

const { mockRequireAuth, mockGetUserFromSession, mockDb } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockGetUserFromSession: vi.fn(),
  mockDb: {
    query: {
      leavePeriods: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...original,
    requireAuth: mockRequireAuth,
    getUserFromSession: mockGetUserFromSession,
  };
});

import { PATCH, DELETE } from "./route";

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

describe("PATCH /api/leave/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when leave period not found", async () => {
    const user = createMockUser({ position: "ADMIN" });
    setupAuthenticatedUser(user);
    mockDb.query.leavePeriods.findFirst.mockResolvedValue(null);

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/leave/nonexistent",
      body: { status: "APPROVED" },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(response.status).toBe(404);
  });

  it("allows admin to approve pending leave", async () => {
    const admin = createMockUser({ position: "ADMIN" });
    setupAuthenticatedUser(admin);

    const pendingLeave = {
      id: "leave-1",
      userId: "other-user",
      status: "PENDING",
      startDate: "2024-12-23",
      endDate: "2024-12-27",
    };
    mockDb.query.leavePeriods.findFirst.mockResolvedValue(pendingLeave);
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...pendingLeave, status: "APPROVED", reviewedById: admin.id }]),
        }),
      }),
    });

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/leave/leave-1",
      body: { status: "APPROVED" },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "leave-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("APPROVED");
  });

  it("allows user to edit their own pending leave", async () => {
    const user = createMockUser({ position: "ASSOCIATE" });
    setupAuthenticatedUser(user);

    const pendingLeave = {
      id: "leave-1",
      userId: user.id,
      status: "PENDING",
      startDate: "2024-12-23",
      endDate: "2024-12-27",
      reason: "Old reason",
    };
    mockDb.query.leavePeriods.findFirst.mockResolvedValue(pendingLeave);
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...pendingLeave, reason: "New reason" }]),
        }),
      }),
    });

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/leave/leave-1",
      body: { reason: "New reason" },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "leave-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reason).toBe("New reason");
  });

  it("prevents user from editing non-pending leave", async () => {
    const user = createMockUser({ position: "ASSOCIATE" });
    setupAuthenticatedUser(user);

    const approvedLeave = {
      id: "leave-1",
      userId: user.id,
      status: "APPROVED",
    };
    mockDb.query.leavePeriods.findFirst.mockResolvedValue(approvedLeave);

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/leave/leave-1",
      body: { reason: "New reason" },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "leave-1" }) });

    expect(response.status).toBe(403);
  });
});

describe("DELETE /api/leave/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows user to delete their own pending leave", async () => {
    const user = createMockUser({ position: "ASSOCIATE" });
    setupAuthenticatedUser(user);

    const pendingLeave = {
      id: "leave-1",
      userId: user.id,
      status: "PENDING",
    };
    mockDb.query.leavePeriods.findFirst.mockResolvedValue(pendingLeave);
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowCount: 1 }),
    });

    const request = createMockRequest({
      method: "DELETE",
      url: "/api/leave/leave-1",
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: "leave-1" }) });

    expect(response.status).toBe(204);
  });

  it("allows admin to delete any leave", async () => {
    const admin = createMockUser({ position: "ADMIN" });
    setupAuthenticatedUser(admin);

    const approvedLeave = {
      id: "leave-1",
      userId: "other-user",
      status: "APPROVED",
    };
    mockDb.query.leavePeriods.findFirst.mockResolvedValue(approvedLeave);
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowCount: 1 }),
    });

    const request = createMockRequest({
      method: "DELETE",
      url: "/api/leave/leave-1",
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: "leave-1" }) });

    expect(response.status).toBe(204);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd app && npm run test -- "api/leave/\\[id\\]/route.test.ts" --run
```

Expected: FAIL - Cannot find module './route'

**Step 3: Write the implementation**

Create `app/src/app/api/leave/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { leavePeriods } from "@/lib/schema";
import { requireAuth, getUserFromSession, errorResponse, hasAdminAccess, parseDate } from "@/lib/api-utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return errorResponse("User not found", 404);
  }

  const { id } = await context.params;

  let body: {
    startDate?: string;
    endDate?: string;
    leaveType?: string;
    reason?: string;
    status?: string;
    rejectionReason?: string;
  };

  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  try {
    const existing = await db.query.leavePeriods.findFirst({
      where: eq(leavePeriods.id, id),
    });

    if (!existing) {
      return errorResponse("Leave period not found", 404);
    }

    const isAdmin = hasAdminAccess(user.position);
    const isOwner = existing.userId === user.id;

    // Non-admin can only edit their own pending leave
    if (!isAdmin) {
      if (!isOwner) {
        return errorResponse("Cannot modify another user's leave", 403);
      }
      if (existing.status !== "PENDING") {
        return errorResponse("Can only edit pending leave requests", 403);
      }
      // Non-admin cannot change status
      if (body.status) {
        return errorResponse("Cannot change leave status", 403);
      }
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    // Handle status changes (admin only)
    if (body.status && isAdmin) {
      if (!["PENDING", "APPROVED", "REJECTED"].includes(body.status)) {
        return errorResponse("Invalid status", 400);
      }
      updates.status = body.status;
      updates.reviewedById = user.id;
      updates.reviewedAt = new Date().toISOString();

      if (body.status === "REJECTED" && body.rejectionReason) {
        updates.rejectionReason = body.rejectionReason;
      }
    }

    // Handle field updates (owner of pending, or admin)
    if (body.startDate) {
      const parsed = parseDate(body.startDate);
      if (!parsed) return errorResponse("Invalid startDate format", 400);
      updates.startDate = body.startDate;
    }

    if (body.endDate) {
      const parsed = parseDate(body.endDate);
      if (!parsed) return errorResponse("Invalid endDate format", 400);
      updates.endDate = body.endDate;
    }

    if (body.leaveType) {
      if (!["VACATION", "SICK_LEAVE", "MATERNITY_PATERNITY"].includes(body.leaveType)) {
        return errorResponse("Invalid leaveType", 400);
      }
      updates.leaveType = body.leaveType;
    }

    if (body.reason !== undefined) {
      updates.reason = body.reason || null;
    }

    const [updated] = await db
      .update(leavePeriods)
      .set(updates)
      .where(eq(leavePeriods.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating leave period:", error);
    return errorResponse("Failed to update leave period", 500);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return errorResponse("User not found", 404);
  }

  const { id } = await context.params;

  try {
    const existing = await db.query.leavePeriods.findFirst({
      where: eq(leavePeriods.id, id),
    });

    if (!existing) {
      return errorResponse("Leave period not found", 404);
    }

    const isAdmin = hasAdminAccess(user.position);
    const isOwner = existing.userId === user.id;

    // Non-admin can only delete their own pending leave
    if (!isAdmin) {
      if (!isOwner) {
        return errorResponse("Cannot delete another user's leave", 403);
      }
      if (existing.status !== "PENDING") {
        return errorResponse("Can only delete pending leave requests", 403);
      }
    }

    await db.delete(leavePeriods).where(eq(leavePeriods.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting leave period:", error);
    return errorResponse("Failed to delete leave period", 500);
  }
}
```

**Step 4: Run tests**

```bash
cd app && npm run test -- "api/leave/\\[id\\]/route.test.ts" --run
```

Expected: PASS

**Step 5: Commit**

```bash
git add app/src/app/api/leave/
git commit -m "feat(api): add PATCH and DELETE /api/leave/[id] endpoints"
```

---

## Task 6: Update Overdue Logic to Exclude Approved Leave

**Files:**
- Modify: `app/src/lib/submission-utils.ts`
- Modify: `app/src/lib/submission-utils.test.ts`

**Step 1: Write the failing test**

Add to `submission-utils.test.ts`:

```typescript
describe("getOverdueDates with leave periods", () => {
  it("excludes dates within approved leave periods", () => {
    // Monday Dec 23 2024 through Friday Dec 27 2024
    const now = new Date("2025-01-06T12:00:00Z"); // Well past deadlines
    const submittedDates = new Set<string>();
    const approvedLeave = [
      { startDate: "2024-12-23", endDate: "2024-12-27" },
    ];

    const overdue = getOverdueDates(now, submittedDates, 30, approvedLeave);

    // Dec 23-27 should NOT be in overdue (on leave)
    expect(overdue).not.toContain("2024-12-23");
    expect(overdue).not.toContain("2024-12-24");
    expect(overdue).not.toContain("2024-12-25");
    expect(overdue).not.toContain("2024-12-26");
    expect(overdue).not.toContain("2024-12-27");
  });

  it("includes dates outside leave periods", () => {
    const now = new Date("2025-01-06T12:00:00Z");
    const submittedDates = new Set<string>();
    const approvedLeave = [
      { startDate: "2024-12-23", endDate: "2024-12-24" },
    ];

    const overdue = getOverdueDates(now, submittedDates, 30, approvedLeave);

    // Dec 23-24 should NOT be overdue (on leave)
    expect(overdue).not.toContain("2024-12-23");
    expect(overdue).not.toContain("2024-12-24");

    // Dec 26-27 SHOULD be overdue (not on leave, not submitted, weekdays)
    expect(overdue).toContain("2024-12-26");
    expect(overdue).toContain("2024-12-27");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd app && npm run test -- submission-utils.test.ts --run
```

Expected: FAIL - getOverdueDates doesn't accept leave periods parameter

**Step 3: Update implementation**

Modify `getOverdueDates` in `submission-utils.ts`:

```typescript
/**
 * Leave period for overdue calculation.
 */
export interface LeavePeriodForOverdue {
  startDate: string;
  endDate: string;
}

/**
 * Check if a date falls within any approved leave period.
 */
export function isOnLeave(dateISO: string, leavePeriods: LeavePeriodForOverdue[]): boolean {
  for (const leave of leavePeriods) {
    if (dateISO >= leave.startDate && dateISO <= leave.endDate) {
      return true;
    }
  }
  return false;
}

/**
 * Get all overdue dates that haven't been submitted.
 * @param now Current date/time
 * @param submittedDates Set of already-submitted dates in ISO format (YYYY-MM-DD)
 * @param lookbackDays Number of days to look back (default: 30)
 * @param approvedLeave Array of approved leave periods to exclude
 * @returns Array of overdue date strings in ISO format
 */
export function getOverdueDates(
  now: Date,
  submittedDates: Set<string>,
  lookbackDays: number = DEFAULT_LOOKBACK_DAYS,
  approvedLeave: LeavePeriodForOverdue[] = []
): string[] {
  const overdueDates: string[] = [];

  // Start from lookbackDays ago and check each day
  for (let i = lookbackDays; i >= 0; i--) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() - i);

    const dateISO = formatDateISO(checkDate);

    // Skip if already submitted
    if (submittedDates.has(dateISO)) {
      continue;
    }

    // Skip if not a weekday
    if (!isWeekday(checkDate)) {
      continue;
    }

    // Skip if on approved leave
    if (isOnLeave(dateISO, approvedLeave)) {
      continue;
    }

    // Check if overdue
    if (isOverdue(checkDate, now)) {
      overdueDates.push(dateISO);
    }
  }

  return overdueDates;
}
```

**Step 4: Run tests**

```bash
cd app && npm run test -- submission-utils.test.ts --run
```

Expected: PASS

**Step 5: Commit**

```bash
git add app/src/lib/submission-utils.ts app/src/lib/submission-utils.test.ts
git commit -m "feat: update getOverdueDates to exclude approved leave periods"
```

---

## Task 7: Update Overdue API to Include Leave Periods

**Files:**
- Modify: `app/src/app/api/timesheets/overdue/route.ts`

**Step 1: Write the failing test**

Add test case to verify leave periods are considered (or create new test file if none exists):

```typescript
it("excludes approved leave dates from overdue calculation", async () => {
  // Test that when user has approved leave, those dates are excluded
  // Implementation details depend on existing test structure
});
```

**Step 2: Update implementation**

Modify `app/src/app/api/timesheets/overdue/route.ts` to fetch and pass approved leave periods:

Add import:
```typescript
import { leavePeriods } from "@/lib/schema";
```

For personal overdue (regular user), after getting user submissions, add:
```typescript
// Get user's approved leave periods
const userLeave = await db.query.leavePeriods.findMany({
  where: and(
    eq(leavePeriods.userId, user.id),
    eq(leavePeriods.status, "APPROVED")
  ),
  columns: { startDate: true, endDate: true },
});

const overdueDates = getOverdueDates(now, submittedDates, DEFAULT_LOOKBACK_DAYS, userLeave);
```

For team overdue (admin), add similar logic to fetch all approved leave and pass per-user:
```typescript
// Get all approved leave periods for relevant users
const allLeave = await db.query.leavePeriods.findMany({
  where: eq(leavePeriods.status, "APPROVED"),
  columns: { userId: true, startDate: true, endDate: true },
});

// Group leave by user
const leaveByUser = new Map<string, { startDate: string; endDate: string }[]>();
for (const leave of allLeave) {
  if (!leaveByUser.has(leave.userId)) {
    leaveByUser.set(leave.userId, []);
  }
  leaveByUser.get(leave.userId)!.push({ startDate: leave.startDate, endDate: leave.endDate });
}

// Update the loop to pass leave periods
for (const u of usersRequiringSubmission) {
  const userSubmissions = submissionsByUser.get(u.id) || new Set<string>();
  const userLeave = leaveByUser.get(u.id) || [];
  const overdueDates = getOverdueDates(now, userSubmissions, DEFAULT_LOOKBACK_DAYS, userLeave);
  // ...
}
```

**Step 3: Run tests**

```bash
cd app && npm run test -- overdue/route.test.ts --run
```

Expected: PASS

**Step 4: Commit**

```bash
git add app/src/app/api/timesheets/overdue/route.ts
git commit -m "feat(api): integrate approved leave into overdue calculations"
```

---

## Task 8: Add Leave Link to Sidebar

**Files:**
- Modify: `app/src/components/layout/Sidebar.tsx`

**Step 1: Add leave icon and nav item**

Add to Icons object:
```typescript
leave: (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
),
```

Add to "TIME RECORDING" section in navSections:
```typescript
{
  label: "TIME RECORDING",
  items: [
    { name: "Timesheets", href: "/timesheets", icon: Icons.timesheets },
    { name: "Leave", href: "/leave", icon: Icons.leave },
  ],
},
```

**Step 2: Commit**

```bash
git add app/src/components/layout/Sidebar.tsx
git commit -m "feat(ui): add Leave link to sidebar navigation"
```

---

## Task 9: Create Leave Page - Server Component

**Files:**
- Create: `app/src/app/(authenticated)/leave/page.tsx`

**Step 1: Create the page**

```typescript
import { desc, eq } from "drizzle-orm";
import { db, leavePeriods } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { LeaveContent } from "@/components/leave/LeaveContent";

export default async function LeavePage() {
  const user = await getCurrentUser();
  const isAdmin = ["ADMIN", "PARTNER"].includes(user.position);

  // Fetch leave periods based on role
  const leaveData = await db.query.leavePeriods.findMany({
    where: isAdmin ? undefined : eq(leavePeriods.userId, user.id),
    with: {
      user: { columns: { name: true } },
      reviewedBy: { columns: { name: true } },
    },
    orderBy: [desc(leavePeriods.createdAt)],
  });

  const serializedLeave = leaveData.map((lp) => ({
    id: lp.id,
    userId: lp.userId,
    userName: lp.user?.name || null,
    startDate: lp.startDate,
    endDate: lp.endDate,
    leaveType: lp.leaveType,
    status: lp.status,
    reason: lp.reason,
    reviewedById: lp.reviewedById,
    reviewedByName: lp.reviewedBy?.name || null,
    reviewedAt: lp.reviewedAt,
    rejectionReason: lp.rejectionReason,
    createdAt: lp.createdAt,
  }));

  return (
    <LeaveContent
      initialLeave={serializedLeave}
      currentUserId={user.id}
      isAdmin={isAdmin}
    />
  );
}
```

**Step 2: Commit**

```bash
git add app/src/app/\(authenticated\)/leave/
git commit -m "feat(ui): add Leave page server component"
```

---

## Task 10: Create Leave Page - Client Component

**Files:**
- Create: `app/src/components/leave/LeaveContent.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import { LeavePeriod, LeaveType, LeaveStatus } from "@/types";
import { LeaveModal } from "./LeaveModal";

interface LeaveContentProps {
  initialLeave: LeavePeriod[];
  currentUserId: string;
  isAdmin: boolean;
}

const statusColors: Record<LeaveStatus, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-500",
  APPROVED: "bg-green-500/20 text-green-500",
  REJECTED: "bg-red-500/20 text-red-500",
};

const leaveTypeLabels: Record<LeaveType, string> = {
  VACATION: "Vacation",
  SICK_LEAVE: "Sick Leave",
  MATERNITY_PATERNITY: "Maternity/Paternity",
};

export function LeaveContent({ initialLeave, currentUserId, isAdmin }: LeaveContentProps) {
  const [leavePeriods, setLeavePeriods] = useState<LeavePeriod[]>(initialLeave);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLeave, setEditingLeave] = useState<LeavePeriod | null>(null);

  const pendingApprovals = leavePeriods.filter(
    (lp) => lp.status === "PENDING" && lp.userId !== currentUserId
  );

  const myLeave = leavePeriods.filter((lp) => lp.userId === currentUserId);
  const allLeave = isAdmin ? leavePeriods : myLeave;

  const handleApprove = async (id: string) => {
    const res = await fetch(`/api/leave/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLeavePeriods((prev) =>
        prev.map((lp) => (lp.id === id ? { ...lp, ...updated } : lp))
      );
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    const res = await fetch(`/api/leave/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REJECTED", rejectionReason: reason }),
    });
    if (res.ok) {
      const updated = await res.json();
      setLeavePeriods((prev) =>
        prev.map((lp) => (lp.id === id ? { ...lp, ...updated } : lp))
      );
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/leave/${id}`, { method: "DELETE" });
    if (res.ok) {
      setLeavePeriods((prev) => prev.filter((lp) => lp.id !== id));
    }
  };

  const handleSave = async (data: { startDate: string; endDate: string; leaveType: LeaveType; reason: string }) => {
    if (editingLeave) {
      const res = await fetch(`/api/leave/${editingLeave.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setLeavePeriods((prev) =>
          prev.map((lp) => (lp.id === editingLeave.id ? { ...lp, ...updated } : lp))
        );
      }
    } else {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const created = await res.json();
        setLeavePeriods((prev) => [{ ...created, userName: null, reviewedByName: null }, ...prev]);
      }
    }
    setIsModalOpen(false);
    setEditingLeave(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-semibold text-[var(--text-primary)]">
          Leave
        </h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-[var(--accent-pink)] text-[var(--bg-deep)] rounded font-medium hover:opacity-90 transition-opacity"
        >
          Request Leave
        </button>
      </div>

      {/* Pending Approvals (Admin only) */}
      {isAdmin && pendingApprovals.length > 0 && (
        <div className="bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)] p-4">
          <h2 className="text-lg font-heading font-medium text-[var(--text-primary)] mb-4">
            Pending Approvals
          </h2>
          <div className="space-y-3">
            {pendingApprovals.map((lp) => (
              <div
                key={lp.id}
                className="flex items-center justify-between p-3 bg-[var(--bg-surface)] rounded"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {lp.userName}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {leaveTypeLabels[lp.leaveType]} · {lp.startDate} to {lp.endDate}
                  </p>
                  {lp.reason && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">{lp.reason}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(lp.id)}
                    className="px-3 py-1 text-sm bg-green-500/20 text-green-500 rounded hover:bg-green-500/30"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(lp.id)}
                    className="px-3 py-1 text-sm bg-red-500/20 text-red-500 rounded hover:bg-red-500/30"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leave List */}
      <div className="bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)]">
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-lg font-heading font-medium text-[var(--text-primary)]">
            {isAdmin ? "All Leave Requests" : "My Leave Requests"}
          </h2>
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {allLeave.length === 0 ? (
            <p className="p-4 text-sm text-[var(--text-muted)]">No leave requests yet.</p>
          ) : (
            allLeave.map((lp) => (
              <div key={lp.id} className="p-4 flex items-center justify-between">
                <div>
                  {isAdmin && lp.userId !== currentUserId && (
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {lp.userName}
                    </p>
                  )}
                  <p className="text-sm text-[var(--text-secondary)]">
                    {leaveTypeLabels[lp.leaveType]} · {lp.startDate} to {lp.endDate}
                  </p>
                  {lp.reason && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">{lp.reason}</p>
                  )}
                  {lp.rejectionReason && (
                    <p className="text-xs text-red-400 mt-1">
                      Rejected: {lp.rejectionReason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${statusColors[lp.status]}`}>
                    {lp.status}
                  </span>
                  {(lp.userId === currentUserId && lp.status === "PENDING") && (
                    <>
                      <button
                        onClick={() => {
                          setEditingLeave(lp);
                          setIsModalOpen(true);
                        }}
                        className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(lp.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {isAdmin && lp.userId !== currentUserId && (
                    <button
                      onClick={() => handleDelete(lp.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <LeaveModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingLeave(null);
          }}
          onSave={handleSave}
          initialData={editingLeave}
        />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/src/components/leave/
git commit -m "feat(ui): add LeaveContent client component"
```

---

## Task 11: Create Leave Modal Component

**Files:**
- Create: `app/src/components/leave/LeaveModal.tsx`

**Step 1: Create the modal**

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import { LeavePeriod, LeaveType } from "@/types";
import { useClickOutside } from "@/hooks/useClickOutside";

interface LeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { startDate: string; endDate: string; leaveType: LeaveType; reason: string }) => void;
  initialData?: LeavePeriod | null;
}

const leaveTypes: { value: LeaveType; label: string }[] = [
  { value: "VACATION", label: "Vacation" },
  { value: "SICK_LEAVE", label: "Sick Leave" },
  { value: "MATERNITY_PATERNITY", label: "Maternity/Paternity" },
];

export function LeaveModal({ isOpen, onClose, onSave, initialData }: LeaveModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [startDate, setStartDate] = useState(initialData?.startDate || "");
  const [endDate, setEndDate] = useState(initialData?.endDate || "");
  const [leaveType, setLeaveType] = useState<LeaveType>(initialData?.leaveType || "VACATION");
  const [reason, setReason] = useState(initialData?.reason || "");
  const [error, setError] = useState("");

  useClickOutside(modalRef, onClose, isOpen);

  useEffect(() => {
    if (initialData) {
      setStartDate(initialData.startDate);
      setEndDate(initialData.endDate);
      setLeaveType(initialData.leaveType);
      setReason(initialData.reason || "");
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!startDate || !endDate) {
      setError("Please select both start and end dates");
      return;
    }

    if (startDate > endDate) {
      setError("Start date must be before or equal to end date");
      return;
    }

    onSave({ startDate, endDate, leaveType, reason });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-[var(--bg-elevated)] rounded-lg border border-[var(--border-subtle)] p-6 w-full max-w-md animate-fade-up"
      >
        <h2 className="text-lg font-heading font-semibold text-[var(--text-primary)] mb-4">
          {initialData ? "Edit Leave Request" : "Request Leave"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 p-2 rounded">{error}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
              />
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">
              Leave Type
            </label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)]"
            >
              {leaveTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-pink)] resize-none"
              placeholder="Optional note about your leave..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-[var(--bg-surface)] text-[var(--text-secondary)] rounded hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-[var(--accent-pink)] text-[var(--bg-deep)] rounded font-medium hover:opacity-90 transition-opacity"
            >
              {initialData ? "Save Changes" : "Submit Request"}
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
git add app/src/components/leave/LeaveModal.tsx
git commit -m "feat(ui): add LeaveModal component for creating/editing leave requests"
```

---

## Task 12: Run Full Test Suite and Verify

**Step 1: Run all tests**

```bash
cd app && npm run test -- --run
```

Expected: All tests pass

**Step 2: Run lint**

```bash
cd app && npm run lint
```

Expected: No errors

**Step 3: Test manually**

```bash
cd app && npm run dev
```

Verify:
1. Leave link appears in sidebar for all users
2. Can create leave request
3. Admin can see pending approvals
4. Admin can approve/reject
5. Approved leave excludes dates from overdue banner

**Step 4: Commit any fixes**

If there are any issues, fix and commit.

---

## Task 13: Final Commit and Cleanup

**Step 1: Review all changes**

```bash
git status
git diff --stat main
```

**Step 2: Ensure no uncommitted changes**

If any remaining changes, commit them.

**Step 3: Push branch**

```bash
git push origin feature/leave-requests
```

---

## Summary

This plan implements:
1. **Database:** `leave_periods` table with enums
2. **API:** Full CRUD at `/api/leave` and `/api/leave/[id]`
3. **Overdue Integration:** `getOverdueDates()` excludes approved leave
4. **UI:** `/leave` page with request form, approval workflow, and list view
5. **Navigation:** Leave link in sidebar

The implementation follows existing codebase patterns for schema, API routes, and UI components.
