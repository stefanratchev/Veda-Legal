# Timesheet Submissions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce daily timesheet submission with 8-hour minimum, deadlines, and global overdue banners.

**Architecture:** New `timesheetSubmissions` table tracks submissions. API endpoints handle submit/revoke logic. Global banner component polls for overdue status. WeekStrip shows submission status icons.

**Tech Stack:** Drizzle ORM, Next.js API routes, React components with Tailwind CSS

---

## Task 1: Add timesheetSubmissions Table to Schema

**Files:**
- Modify: `app/src/lib/schema.ts`

**Step 1: Write the table definition**

Add after the `timeEntries` table definition (around line 178):

```typescript
export const timesheetSubmissions = pgTable("timesheet_submissions", {
  id: text().primaryKey().notNull(),
  userId: text().notNull(),
  date: date().notNull(),
  submittedAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index("timesheet_submissions_userId_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
  index("timesheet_submissions_date_idx").using("btree", table.date.asc().nullsLast().op("date_ops")),
  uniqueIndex("timesheet_submissions_userId_date_key").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.date.asc().nullsLast().op("date_ops")),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [users.id],
    name: "timesheet_submissions_userId_fkey"
  }).onUpdate("cascade").onDelete("cascade"),
]);
```

**Step 2: Add relations**

Add after `timeEntriesRelations` (around line 217):

```typescript
export const timesheetSubmissionsRelations = relations(timesheetSubmissions, ({ one }) => ({
  user: one(users, {
    fields: [timesheetSubmissions.userId],
    references: [users.id],
  }),
}));
```

Update `usersRelations` to include submissions:

```typescript
export const usersRelations = relations(users, ({ many }) => ({
  timeEntries: many(timeEntries),
  finalizedServiceDescriptions: many(serviceDescriptions),
  timesheetSubmissions: many(timesheetSubmissions),
}));
```

**Step 3: Generate and apply migration**

Run:
```bash
cd app && npm run db:generate
```

Expected: Migration file created in `drizzle/` folder.

Run:
```bash
npm run db:migrate
```

Expected: Migration applied successfully.

**Step 4: Commit**

```bash
git add app/src/lib/schema.ts app/drizzle/
git commit -m "feat(schema): add timesheetSubmissions table for submission tracking"
```

---

## Task 2: Add Deadline Utility Functions

**Files:**
- Create: `app/src/lib/submission-utils.ts`
- Create: `app/src/lib/submission-utils.test.ts`

**Step 1: Write the failing tests**

Create `app/src/lib/submission-utils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  getSubmissionDeadline,
  isOverdue,
  getOverdueDates,
  isWeekday,
} from "./submission-utils";

describe("isWeekday", () => {
  it("returns true for Monday", () => {
    const monday = new Date("2026-01-26"); // Monday
    expect(isWeekday(monday)).toBe(true);
  });

  it("returns true for Friday", () => {
    const friday = new Date("2026-01-30"); // Friday
    expect(isWeekday(friday)).toBe(true);
  });

  it("returns false for Saturday", () => {
    const saturday = new Date("2026-01-31"); // Saturday
    expect(isWeekday(saturday)).toBe(false);
  });

  it("returns false for Sunday", () => {
    const sunday = new Date("2026-02-01"); // Sunday
    expect(isWeekday(sunday)).toBe(false);
  });
});

describe("getSubmissionDeadline", () => {
  it("returns next day 10am for Monday", () => {
    const monday = new Date("2026-01-26"); // Monday
    const deadline = getSubmissionDeadline(monday);
    expect(deadline.toISOString()).toBe("2026-01-27T10:00:00.000Z");
  });

  it("returns next day 10am for Thursday", () => {
    const thursday = new Date("2026-01-29"); // Thursday
    const deadline = getSubmissionDeadline(thursday);
    expect(deadline.toISOString()).toBe("2026-01-30T10:00:00.000Z");
  });

  it("returns Monday 10am for Friday", () => {
    const friday = new Date("2026-01-30"); // Friday
    const deadline = getSubmissionDeadline(friday);
    expect(deadline.toISOString()).toBe("2026-02-02T10:00:00.000Z"); // Monday
  });
});

describe("isOverdue", () => {
  it("returns false if before deadline", () => {
    const workday = new Date("2026-01-26"); // Monday
    const now = new Date("2026-01-27T09:00:00.000Z"); // Tuesday 9am
    expect(isOverdue(workday, now)).toBe(false);
  });

  it("returns true if after deadline", () => {
    const workday = new Date("2026-01-26"); // Monday
    const now = new Date("2026-01-27T11:00:00.000Z"); // Tuesday 11am
    expect(isOverdue(workday, now)).toBe(true);
  });

  it("returns true exactly at deadline", () => {
    const workday = new Date("2026-01-26"); // Monday
    const now = new Date("2026-01-27T10:00:00.000Z"); // Tuesday 10am exactly
    expect(isOverdue(workday, now)).toBe(true);
  });

  it("returns false for weekend days", () => {
    const saturday = new Date("2026-01-31"); // Saturday
    const now = new Date("2026-02-03T11:00:00.000Z"); // Tuesday after
    expect(isOverdue(saturday, now)).toBe(false);
  });

  it("returns false for future dates", () => {
    const futureDate = new Date("2026-02-05"); // Future Thursday
    const now = new Date("2026-01-27T11:00:00.000Z");
    expect(isOverdue(futureDate, now)).toBe(false);
  });
});

describe("getOverdueDates", () => {
  it("returns empty array when all dates are submitted", () => {
    const now = new Date("2026-01-28T11:00:00.000Z"); // Wednesday 11am
    const submittedDates = new Set(["2026-01-26", "2026-01-27"]); // Mon, Tue
    const result = getOverdueDates(now, submittedDates, 7);
    expect(result).toEqual([]);
  });

  it("returns overdue dates not in submitted set", () => {
    const now = new Date("2026-01-28T11:00:00.000Z"); // Wednesday 11am
    const submittedDates = new Set(["2026-01-26"]); // Only Monday
    const result = getOverdueDates(now, submittedDates, 7);
    expect(result).toContain("2026-01-27"); // Tuesday is overdue
  });

  it("excludes weekends", () => {
    const now = new Date("2026-02-02T11:00:00.000Z"); // Monday 11am
    const submittedDates = new Set<string>([]);
    const result = getOverdueDates(now, submittedDates, 10);
    expect(result).not.toContain("2026-01-31"); // Saturday
    expect(result).not.toContain("2026-02-01"); // Sunday
  });

  it("respects lookback limit", () => {
    const now = new Date("2026-01-28T11:00:00.000Z");
    const submittedDates = new Set<string>([]);
    const result = getOverdueDates(now, submittedDates, 2);
    // Should only look back 2 days, not find older overdue dates
    expect(result.length).toBeLessThanOrEqual(2);
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd app && npm run test -- submission-utils --run
```

Expected: FAIL - module not found.

**Step 3: Write the implementation**

Create `app/src/lib/submission-utils.ts`:

```typescript
/**
 * Utility functions for timesheet submission deadlines.
 */

import { formatDateISO } from "./date-utils";

/** Minimum hours required for submission */
export const MIN_SUBMISSION_HOURS = 8;

/** Default lookback period in days for overdue check */
export const DEFAULT_LOOKBACK_DAYS = 30;

/**
 * Check if a date is a weekday (Monday-Friday).
 */
export function isWeekday(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5; // Monday = 1, Friday = 5
}

/**
 * Get the submission deadline for a workday.
 * - Monday-Thursday: Next day at 10:00 AM UTC
 * - Friday: Monday at 10:00 AM UTC
 */
export function getSubmissionDeadline(workday: Date): Date {
  const deadline = new Date(workday);
  const dayOfWeek = workday.getDay();

  if (dayOfWeek === 5) {
    // Friday -> Monday
    deadline.setDate(deadline.getDate() + 3);
  } else {
    // Mon-Thu -> Next day
    deadline.setDate(deadline.getDate() + 1);
  }

  deadline.setUTCHours(10, 0, 0, 0);
  return deadline;
}

/**
 * Check if a workday's timesheet is overdue.
 * Returns false for weekends or future dates.
 */
export function isOverdue(workday: Date, now: Date = new Date()): boolean {
  // Weekends are never overdue
  if (!isWeekday(workday)) {
    return false;
  }

  // Future dates are never overdue
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  const workdayStart = new Date(workday);
  workdayStart.setUTCHours(0, 0, 0, 0);
  if (workdayStart >= today) {
    return false;
  }

  const deadline = getSubmissionDeadline(workday);
  return now >= deadline;
}

/**
 * Get all overdue dates within the lookback period.
 * @param now - Current time
 * @param submittedDates - Set of date strings (YYYY-MM-DD) that have been submitted
 * @param lookbackDays - Number of days to look back
 */
export function getOverdueDates(
  now: Date,
  submittedDates: Set<string>,
  lookbackDays: number = DEFAULT_LOOKBACK_DAYS
): string[] {
  const overdue: string[] = [];

  for (let i = 1; i <= lookbackDays; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = formatDateISO(date);

    if (isWeekday(date) && isOverdue(date, now) && !submittedDates.has(dateStr)) {
      overdue.push(dateStr);
    }
  }

  return overdue.sort(); // Oldest first
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd app && npm run test -- submission-utils --run
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add app/src/lib/submission-utils.ts app/src/lib/submission-utils.test.ts
git commit -m "feat(lib): add submission deadline utility functions with tests"
```

---

## Task 3: Create Submit API Endpoint

**Files:**
- Create: `app/src/app/api/timesheets/submit/route.ts`
- Create: `app/src/app/api/timesheets/submit/route.test.ts`

**Step 1: Write the failing tests**

Create `app/src/app/api/timesheets/submit/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser } from "@/test/mocks/factories";

const { mockRequireAuth, mockGetUserFromSession, mockDb } = vi.hoisted(() => {
  return {
    mockRequireAuth: vi.fn(),
    mockGetUserFromSession: vi.fn(),
    mockDb: {
      query: {
        timesheetSubmissions: {
          findFirst: vi.fn(),
        },
      },
      select: vi.fn(),
      insert: vi.fn(),
    },
  };
});

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

import { POST } from "./route";

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

describe("POST /api/timesheets/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets/submit",
        body: { date: "2026-01-26" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("Validation", () => {
    it("returns 400 when date is missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets/submit",
        body: {},
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Date is required");
    });

    it("returns 400 when date format is invalid", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets/submit",
        body: { date: "invalid-date" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid date format");
    });

    it("returns 400 when hours are less than 8", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      // Mock: user has 5 hours for this date
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ totalHours: "5.0" }]),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets/submit",
        body: { date: "2026-01-26" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Minimum 8 hours required to submit (currently 5 hours)");
    });

    it("returns 400 when already submitted", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      // Mock: 8 hours logged
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ totalHours: "8.0" }]),
        }),
      });

      // Mock: already submitted
      mockDb.query.timesheetSubmissions.findFirst.mockResolvedValue({
        id: "sub-1",
        userId: user.id,
        date: "2026-01-26",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets/submit",
        body: { date: "2026-01-26" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Timesheet already submitted for this date");
    });
  });

  describe("Happy Path", () => {
    it("creates submission and returns success", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      // Mock: 8 hours logged
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ totalHours: "8.5" }]),
        }),
      });

      // Mock: not already submitted
      mockDb.query.timesheetSubmissions.findFirst.mockResolvedValue(null);

      // Mock: insert succeeds
      const createdSubmission = {
        id: "sub-123",
        userId: user.id,
        date: "2026-01-26",
        submittedAt: "2026-01-26T15:00:00.000Z",
      };
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdSubmission]),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets/submit",
        body: { date: "2026-01-26" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe("sub-123");
      expect(data.date).toBe("2026-01-26");
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd app && npm run test -- submit/route --run
```

Expected: FAIL - module not found.

**Step 3: Write the implementation**

Create `app/src/app/api/timesheets/submit/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { timeEntries, timesheetSubmissions } from "@/lib/schema";
import { requireAuth, getUserFromSession, errorResponse } from "@/lib/api-utils";
import { MIN_SUBMISSION_HOURS } from "@/lib/submission-utils";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { date } = body;

  // Validate date
  if (!date) {
    return errorResponse("Date is required", 400);
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return errorResponse("Invalid date format", 400);
  }

  const dateStr = parsedDate.toISOString().split("T")[0];

  try {
    // Get total hours for this date
    const [hoursResult] = await db
      .select({
        totalHours: sql<string>`COALESCE(SUM(CAST(${timeEntries.hours} AS DECIMAL)), 0)`,
      })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, user.id),
          eq(timeEntries.date, dateStr)
        )
      );

    const totalHours = Number(hoursResult?.totalHours || 0);

    if (totalHours < MIN_SUBMISSION_HOURS) {
      return errorResponse(
        `Minimum ${MIN_SUBMISSION_HOURS} hours required to submit (currently ${totalHours} hours)`,
        400
      );
    }

    // Check if already submitted
    const existingSubmission = await db.query.timesheetSubmissions.findFirst({
      where: and(
        eq(timesheetSubmissions.userId, user.id),
        eq(timesheetSubmissions.date, dateStr)
      ),
    });

    if (existingSubmission) {
      return errorResponse("Timesheet already submitted for this date", 400);
    }

    // Create submission
    const [submission] = await db.insert(timesheetSubmissions).values({
      id: createId(),
      userId: user.id,
      date: dateStr,
    }).returning();

    return NextResponse.json(submission, { status: 201 });
  } catch (error) {
    console.error("Database error creating submission:", error);
    return NextResponse.json(
      { error: "Failed to submit timesheet" },
      { status: 500 }
    );
  }
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd app && npm run test -- submit/route --run
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add app/src/app/api/timesheets/submit/
git commit -m "feat(api): add POST /api/timesheets/submit endpoint"
```

---

## Task 4: Create Overdue API Endpoint

**Files:**
- Create: `app/src/app/api/timesheets/overdue/route.ts`
- Create: `app/src/app/api/timesheets/overdue/route.test.ts`

**Step 1: Write the failing tests**

Create `app/src/app/api/timesheets/overdue/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser } from "@/test/mocks/factories";

const { mockRequireAuth, mockGetUserFromSession, mockHasAdminAccess, mockDb } = vi.hoisted(() => {
  return {
    mockRequireAuth: vi.fn(),
    mockGetUserFromSession: vi.fn(),
    mockHasAdminAccess: vi.fn(),
    mockDb: {
      query: {
        timesheetSubmissions: {
          findMany: vi.fn(),
        },
        users: {
          findMany: vi.fn(),
        },
      },
    },
  };
});

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...original,
    requireAuth: mockRequireAuth,
    getUserFromSession: mockGetUserFromSession,
    hasAdminAccess: mockHasAdminAccess,
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
  mockHasAdminAccess.mockImplementation((position: string) =>
    ["ADMIN", "PARTNER"].includes(position)
  );
}

describe("GET /api/timesheets/overdue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock current date for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-28T11:00:00.000Z")); // Wednesday 11am
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/overdue",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("Regular User", () => {
    it("returns own overdue dates only", async () => {
      const user = createMockUser({ position: "ASSOCIATE" });
      setupAuthenticatedUser(user);

      // User submitted Monday only
      mockDb.query.timesheetSubmissions.findMany.mockResolvedValue([
        { date: "2026-01-26" }, // Monday
      ]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/overdue",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.overdue).toContain("2026-01-27"); // Tuesday is overdue
      expect(data.overdue).not.toContain("2026-01-26"); // Monday was submitted
    });

    it("returns empty array when all submitted", async () => {
      const user = createMockUser({ position: "ASSOCIATE" });
      setupAuthenticatedUser(user);

      // All days submitted
      mockDb.query.timesheetSubmissions.findMany.mockResolvedValue([
        { date: "2026-01-26" },
        { date: "2026-01-27" },
      ]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/overdue",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.overdue).toEqual([]);
    });
  });

  describe("Admin/Partner", () => {
    it("returns all employees overdue dates", async () => {
      const admin = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(admin);

      // Mock all active users
      mockDb.query.users.findMany.mockResolvedValue([
        { id: "user-1", name: "John Doe" },
        { id: "user-2", name: "Jane Smith" },
      ]);

      // Mock submissions - user-1 submitted Monday, user-2 has none
      mockDb.query.timesheetSubmissions.findMany.mockResolvedValue([
        { userId: "user-1", date: "2026-01-26" },
        { userId: "user-1", date: "2026-01-27" },
      ]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/overdue",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.overdue)).toBe(true);

      // user-1 should have no overdue (both submitted)
      const user1 = data.overdue.find((u: { userId: string }) => u.userId === "user-1");
      expect(user1).toBeUndefined();

      // user-2 should have overdue dates
      const user2 = data.overdue.find((u: { userId: string }) => u.userId === "user-2");
      expect(user2).toBeDefined();
      expect(user2.dates).toContain("2026-01-26");
      expect(user2.dates).toContain("2026-01-27");
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run:
```bash
cd app && npm run test -- overdue/route --run
```

Expected: FAIL - module not found.

**Step 3: Write the implementation**

Create `app/src/app/api/timesheets/overdue/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { timesheetSubmissions, users } from "@/lib/schema";
import { requireAuth, getUserFromSession, hasAdminAccess } from "@/lib/api-utils";
import { getOverdueDates, DEFAULT_LOOKBACK_DAYS } from "@/lib/submission-utils";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const now = new Date();

  try {
    if (hasAdminAccess(user.position)) {
      // Admin: get all active users and their submissions
      const activeUsers = await db.query.users.findMany({
        where: eq(users.status, "ACTIVE"),
        columns: { id: true, name: true },
      });

      const allSubmissions = await db.query.timesheetSubmissions.findMany({
        columns: { userId: true, date: true },
      });

      // Group submissions by user
      const submissionsByUser = new Map<string, Set<string>>();
      for (const submission of allSubmissions) {
        if (!submissionsByUser.has(submission.userId)) {
          submissionsByUser.set(submission.userId, new Set());
        }
        submissionsByUser.get(submission.userId)!.add(submission.date);
      }

      // Calculate overdue for each user
      const overdue: { userId: string; name: string; dates: string[] }[] = [];
      for (const activeUser of activeUsers) {
        const userSubmissions = submissionsByUser.get(activeUser.id) || new Set();
        const userOverdue = getOverdueDates(now, userSubmissions, DEFAULT_LOOKBACK_DAYS);
        if (userOverdue.length > 0) {
          overdue.push({
            userId: activeUser.id,
            name: activeUser.name || "Unknown",
            dates: userOverdue,
          });
        }
      }

      return NextResponse.json({ overdue });
    } else {
      // Regular user: get own submissions only
      const submissions = await db.query.timesheetSubmissions.findMany({
        where: eq(timesheetSubmissions.userId, user.id),
        columns: { date: true },
      });

      const submittedDates = new Set(submissions.map((s) => s.date));
      const overdue = getOverdueDates(now, submittedDates, DEFAULT_LOOKBACK_DAYS);

      return NextResponse.json({ overdue });
    }
  } catch (error) {
    console.error("Database error fetching overdue:", error);
    return NextResponse.json(
      { error: "Failed to fetch overdue timesheets" },
      { status: 500 }
    );
  }
}
```

**Step 4: Run tests to verify they pass**

Run:
```bash
cd app && npm run test -- overdue/route --run
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
git add app/src/app/api/timesheets/overdue/
git commit -m "feat(api): add GET /api/timesheets/overdue endpoint"
```

---

## Task 5: Add Submission Revocation to Entry Delete/Update

**Files:**
- Modify: `app/src/app/api/timesheets/route.ts`
- Modify: `app/src/app/api/timesheets/[id]/route.ts`

**Step 1: Modify DELETE handler to check for revocation**

In `app/src/app/api/timesheets/route.ts`, update the DELETE function.

Add import at top:
```typescript
import { timesheetSubmissions } from "@/lib/schema";
import { MIN_SUBMISSION_HOURS } from "@/lib/submission-utils";
```

Update DELETE handler (after successful delete, add revocation logic):

```typescript
// DELETE /api/timesheets?id=xxx - Delete time entry
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Entry ID is required" }, { status: 400 });
  }

  try {
    // First check if entry exists and belongs to user
    const existingEntry = await db.query.timeEntries.findFirst({
      where: eq(timeEntries.id, id),
      columns: { userId: true, date: true },
    });

    if (!existingEntry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    if (existingEntry.userId !== user.id) {
      return NextResponse.json({ error: "You can only delete your own entries" }, { status: 403 });
    }

    const entryDate = existingEntry.date;

    await db.delete(timeEntries).where(eq(timeEntries.id, id));

    // Check if we need to revoke submission
    let submissionRevoked = false;
    const [hoursResult] = await db
      .select({
        totalHours: sql<string>`COALESCE(SUM(CAST(${timeEntries.hours} AS DECIMAL)), 0)`,
      })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, user.id),
          eq(timeEntries.date, entryDate)
        )
      );

    const remainingHours = Number(hoursResult?.totalHours || 0);

    if (remainingHours < MIN_SUBMISSION_HOURS) {
      // Check if there was a submission to revoke
      const existingSubmission = await db.query.timesheetSubmissions.findFirst({
        where: and(
          eq(timesheetSubmissions.userId, user.id),
          eq(timesheetSubmissions.date, entryDate)
        ),
      });

      if (existingSubmission) {
        await db.delete(timesheetSubmissions).where(
          eq(timesheetSubmissions.id, existingSubmission.id)
        );
        submissionRevoked = true;
      }
    }

    return NextResponse.json({
      success: true,
      submissionRevoked,
      remainingHours: submissionRevoked ? remainingHours : undefined,
    });
  } catch (error) {
    console.error("Database error deleting time entry:", error);
    return NextResponse.json(
      { error: "Failed to delete time entry" },
      { status: 500 }
    );
  }
}
```

**Step 2: Modify PATCH handler similarly**

In `app/src/app/api/timesheets/[id]/route.ts`, add similar revocation logic after updating hours.

Add imports:
```typescript
import { timesheetSubmissions } from "@/lib/schema";
import { MIN_SUBMISSION_HOURS } from "@/lib/submission-utils";
```

At the end of successful PATCH, add revocation check (similar pattern to DELETE).

**Step 3: Run existing tests to ensure no regression**

Run:
```bash
cd app && npm run test -- route.test --run
```

Expected: Existing tests still PASS.

**Step 4: Commit**

```bash
git add app/src/app/api/timesheets/route.ts app/src/app/api/timesheets/[id]/route.ts
git commit -m "feat(api): add submission revocation on entry delete/update"
```

---

## Task 6: Add Submission Status to GET /api/timesheets

**Files:**
- Modify: `app/src/app/api/timesheets/route.ts`

**Step 1: Update GET handler to include submission status**

In `app/src/app/api/timesheets/route.ts`, update the GET function to return submission info.

Add at the end of the try block (before returning):

```typescript
// Check submission status for this date
const submission = await db.query.timesheetSubmissions.findFirst({
  where: and(
    eq(timesheetSubmissions.userId, user.id),
    eq(timesheetSubmissions.date, dateStr)
  ),
  columns: { submittedAt: true },
});

// Calculate total hours
const totalHours = entries.reduce((sum, e) => sum + Number(e.hours), 0);
```

Update the return statements to include:

For regular users:
```typescript
return NextResponse.json({
  entries: serializedEntries,
  totalHours,
  isSubmitted: !!submission,
  submittedAt: submission?.submittedAt || null,
});
```

For admins (include in existing response):
```typescript
return NextResponse.json({
  entries: serializedEntries,
  teamSummaries: teamSummaries.map(...),
  totalHours,
  isSubmitted: !!submission,
  submittedAt: submission?.submittedAt || null,
});
```

**Step 2: Update tests**

Update `app/src/app/api/timesheets/route.test.ts` to expect new response shape.

**Step 3: Run tests**

Run:
```bash
cd app && npm run test -- timesheets/route --run
```

Expected: Tests PASS.

**Step 4: Commit**

```bash
git add app/src/app/api/timesheets/route.ts app/src/app/api/timesheets/route.test.ts
git commit -m "feat(api): include submission status in GET /api/timesheets response"
```

---

## Task 7: Create OverdueBanner Component

**Files:**
- Create: `app/src/components/layout/OverdueBanner.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface OverdueData {
  // For regular users
  overdue?: string[];
  // For admins
  overdue?: { userId: string; name: string; dates: string[] }[];
}

interface OverdueBannerProps {
  isAdmin: boolean;
}

export function OverdueBanner({ isAdmin }: OverdueBannerProps) {
  const [overdueData, setOverdueData] = useState<OverdueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOverdue = useCallback(async () => {
    try {
      const response = await fetch("/api/timesheets/overdue");
      if (response.ok) {
        const data = await response.json();
        setOverdueData(data);
      }
    } catch (error) {
      console.error("Failed to fetch overdue status:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverdue();
    // Poll every 5 minutes
    const interval = setInterval(fetchOverdue, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchOverdue]);

  if (isLoading || !overdueData) {
    return null;
  }

  const overdue = overdueData.overdue;

  // No overdue - don't show banner
  if (!overdue || overdue.length === 0) {
    return null;
  }

  // Format dates for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  };

  if (isAdmin && typeof overdue[0] === "object" && "userId" in overdue[0]) {
    // Admin view: show team overdue
    const teamOverdue = overdue as { userId: string; name: string; dates: string[] }[];
    const summaryText = teamOverdue
      .map((u) => `${u.name} (${u.dates.length} day${u.dates.length > 1 ? "s" : ""})`)
      .join(", ");

    return (
      <div className="bg-[var(--danger-bg)] border-b border-[var(--danger)] px-4 py-2">
        <p className="text-[var(--danger)] text-sm font-medium">
          Overdue timesheets: {summaryText}
        </p>
      </div>
    );
  }

  // Regular user view: show own overdue
  const userOverdue = overdue as string[];
  const datesText = userOverdue.map(formatDate).join(", ");

  return (
    <Link
      href="/timesheets"
      className="block bg-[var(--danger-bg)] border-b border-[var(--danger)] px-4 py-2 hover:bg-[var(--danger)]/20 transition-colors"
    >
      <p className="text-[var(--danger)] text-sm font-medium">
        You have overdue timesheets for: {datesText}
      </p>
    </Link>
  );
}
```

**Step 2: Commit**

```bash
git add app/src/components/layout/OverdueBanner.tsx
git commit -m "feat(ui): create OverdueBanner component"
```

---

## Task 8: Add OverdueBanner to Layout

**Files:**
- Modify: `app/src/app/(authenticated)/layout.tsx`
- Create: `app/src/lib/user.ts` (if needed for position check)

**Step 1: Update layout to include banner**

Modify `app/src/app/(authenticated)/layout.tsx`:

```typescript
import { getCurrentUser } from "@/lib/user";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainContent } from "@/components/layout/MainContent";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { MobileNavProvider } from "@/contexts/MobileNavContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { OverdueBanner } from "@/components/layout/OverdueBanner";
import { hasAdminAccess } from "@/lib/api-utils";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const isAdmin = hasAdminAccess(user.position);

  return (
    <MobileNavProvider>
      <SidebarProvider>
        <div className="flex min-h-screen">
          <Sidebar
            user={{
              name: user.name,
              position: user.position,
              initials: user.initials,
              image: user.image,
            }}
            className="animate-slide-in"
          />
          <MainContent>
            <OverdueBanner isAdmin={isAdmin} />
            <MobileHeader />
            <div className="px-3 py-4 md:px-4 lg:px-6 lg:py-5">{children}</div>
          </MainContent>
        </div>
      </SidebarProvider>
    </MobileNavProvider>
  );
}
```

**Step 2: Commit**

```bash
git add app/src/app/(authenticated)/layout.tsx
git commit -m "feat(ui): add OverdueBanner to authenticated layout"
```

---

## Task 9: Update WeekStrip with Submission Icons

**Files:**
- Modify: `app/src/components/timesheets/WeekStrip.tsx`

**Step 1: Update WeekStripProps interface**

```typescript
interface WeekStripProps {
  selectedDate: Date;
  today: Date;
  datesWithEntries: Set<string>;
  submittedDates: Set<string>;  // NEW
  overdueDates: Set<string>;    // NEW
  onSelectDate: (date: Date) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToToday: () => void;
  onFetchM365Activity: () => void;
  isM365Loading: boolean;
  isM365PanelOpen: boolean;
}
```

**Step 2: Add status icon helper**

```typescript
function getStatusIcon(date: Date, submittedDates: Set<string>, overdueDates: Set<string>) {
  const dateStr = formatDateISO(date);

  if (submittedDates.has(dateStr)) {
    // Green checkmark
    return (
      <svg className="w-4 h-4 text-[var(--success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
      </svg>
    );
  }

  if (overdueDates.has(dateStr)) {
    // Red clock
    return (
      <svg className="w-4 h-4 text-[var(--danger)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }

  return null;
}
```

**Step 3: Update day button rendering**

In the day button, add the status icon below the date number:

```typescript
{/* Status icon */}
{(() => {
  const icon = getStatusIcon(day, submittedDates, overdueDates);
  return icon ? (
    <span className="absolute -bottom-1">{icon}</span>
  ) : hasEntry ? (
    <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${selected ? "bg-[var(--bg-deep)]" : "bg-[var(--accent-pink)]"}`} />
  ) : null;
})()}
```

**Step 4: Commit**

```bash
git add app/src/components/timesheets/WeekStrip.tsx
git commit -m "feat(ui): add submission status icons to WeekStrip"
```

---

## Task 10: Update TimesheetsContent for Submission Flow

**Files:**
- Modify: `app/src/components/timesheets/TimesheetsContent.tsx`

**Step 1: Add submission state**

```typescript
const [isSubmitted, setIsSubmitted] = useState(false);
const [submittedDates, setSubmittedDates] = useState<Set<string>>(new Set());
const [overdueDates, setOverdueDates] = useState<Set<string>>(new Set());
const [totalHours, setTotalHours] = useState(0);
const [showSubmitPrompt, setShowSubmitPrompt] = useState(false);
```

**Step 2: Update fetchEntries to handle submission status**

```typescript
const fetchEntries = useCallback(async (date: Date) => {
  setIsLoadingEntries(true);
  try {
    const response = await fetch(`/api/timesheets?date=${formatDateISO(date)}`);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) {
        // Legacy response
        setEntries(data);
        setTeamSummaries([]);
        setTotalHours(data.reduce((sum: number, e: TimeEntry) => sum + e.hours, 0));
        setIsSubmitted(false);
      } else {
        setEntries(data.entries || []);
        setTeamSummaries(data.teamSummaries || []);
        setTotalHours(data.totalHours || 0);
        setIsSubmitted(data.isSubmitted || false);
      }
    }
  } catch (err) {
    console.error("Failed to fetch entries:", err);
  } finally {
    setIsLoadingEntries(false);
  }
}, []);
```

**Step 3: Add fetchOverdueStatus function**

```typescript
const fetchOverdueStatus = useCallback(async () => {
  try {
    const response = await fetch("/api/timesheets/overdue");
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.overdue)) {
        // String array for regular users
        if (typeof data.overdue[0] === "string" || data.overdue.length === 0) {
          setOverdueDates(new Set(data.overdue as string[]));
        }
      }
    }
  } catch (err) {
    console.error("Failed to fetch overdue status:", err);
  }
}, []);
```

**Step 4: Add submit handler**

```typescript
const handleSubmit = useCallback(async () => {
  try {
    const response = await fetch("/api/timesheets/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: formatDateISO(selectedDate) }),
    });

    if (response.ok) {
      setIsSubmitted(true);
      setSubmittedDates((prev) => new Set([...prev, formatDateISO(selectedDate)]));
      setOverdueDates((prev) => {
        const next = new Set(prev);
        next.delete(formatDateISO(selectedDate));
        return next;
      });
      setShowSubmitPrompt(false);
    }
  } catch (err) {
    console.error("Failed to submit timesheet:", err);
  }
}, [selectedDate]);
```

**Step 5: Check for auto-prompt after creating entry**

In handleSubmit (the entry creation one), after successfully creating entry:

```typescript
// Check if we hit 8 hours and should prompt
const newTotal = totalHours + toDecimalHours(formData.hours, formData.minutes);
if (newTotal >= 8 && !isSubmitted) {
  setShowSubmitPrompt(true);
}
```

**Step 6: Commit**

```bash
git add app/src/components/timesheets/TimesheetsContent.tsx
git commit -m "feat(ui): add submission flow to TimesheetsContent"
```

---

## Task 11: Create SubmitButton Component

**Files:**
- Create: `app/src/components/timesheets/SubmitButton.tsx`

**Step 1: Create the component**

```typescript
"use client";

interface SubmitButtonProps {
  totalHours: number;
  isSubmitted: boolean;
  isLoading: boolean;
  onSubmit: () => void;
}

const MIN_HOURS = 8;

export function SubmitButton({
  totalHours,
  isSubmitted,
  isLoading,
  onSubmit,
}: SubmitButtonProps) {
  if (isSubmitted) {
    return null;
  }

  const canSubmit = totalHours >= MIN_HOURS;

  return (
    <button
      onClick={onSubmit}
      disabled={!canSubmit || isLoading}
      className={`
        w-full py-3 px-4 rounded-lg font-medium transition-all duration-200
        ${canSubmit
          ? "bg-[var(--success)] text-white hover:bg-[var(--success)]/90"
          : "bg-[var(--bg-surface)] text-[var(--text-muted)] cursor-not-allowed"
        }
      `}
      title={!canSubmit ? `Log ${MIN_HOURS} hours to submit (${totalHours.toFixed(1)} logged)` : undefined}
    >
      {isLoading ? (
        "Submitting..."
      ) : canSubmit ? (
        `Submit (${totalHours.toFixed(1)} hours)`
      ) : (
        `Log ${MIN_HOURS} hours to submit (${totalHours.toFixed(1)} logged)`
      )}
    </button>
  );
}
```

**Step 2: Commit**

```bash
git add app/src/components/timesheets/SubmitButton.tsx
git commit -m "feat(ui): create SubmitButton component"
```

---

## Task 12: Create SubmitPromptModal Component

**Files:**
- Create: `app/src/components/timesheets/SubmitPromptModal.tsx`

**Step 1: Create the component**

```typescript
"use client";

interface SubmitPromptModalProps {
  date: string;
  totalHours: number;
  onSubmit: () => void;
  onDismiss: () => void;
}

export function SubmitPromptModal({
  date,
  totalHours,
  onSubmit,
  onDismiss,
}: SubmitPromptModalProps) {
  const formattedDate = new Date(date).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--bg-elevated)] rounded-lg p-6 max-w-md w-full mx-4 shadow-xl animate-fade-up">
        <h3 className="text-lg font-heading font-semibold text-[var(--text-primary)] mb-2">
          Submit Timesheet?
        </h3>
        <p className="text-[var(--text-secondary)] mb-4">
          You&apos;ve logged {totalHours.toFixed(1)} hours for {formattedDate}. Ready to submit?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 py-2 px-4 rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] transition-colors"
          >
            Not yet
          </button>
          <button
            onClick={onSubmit}
            className="flex-1 py-2 px-4 rounded-lg bg-[var(--success)] text-white hover:bg-[var(--success)]/90 transition-colors"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/src/components/timesheets/SubmitPromptModal.tsx
git commit -m "feat(ui): create SubmitPromptModal component"
```

---

## Task 13: Wire Up Components in TimesheetsContent

**Files:**
- Modify: `app/src/components/timesheets/TimesheetsContent.tsx`

**Step 1: Import new components**

```typescript
import { SubmitButton } from "./SubmitButton";
import { SubmitPromptModal } from "./SubmitPromptModal";
```

**Step 2: Add SubmitButton to the JSX**

After EntriesList:

```typescript
{/* Submit Button */}
<SubmitButton
  totalHours={totalHours}
  isSubmitted={isSubmitted}
  isLoading={isLoading}
  onSubmit={handleTimesheetSubmit}
/>
```

**Step 3: Add SubmitPromptModal**

At the end of the component (before closing div):

```typescript
{/* Submit Prompt Modal */}
{showSubmitPrompt && (
  <SubmitPromptModal
    date={formatDateISO(selectedDate)}
    totalHours={totalHours}
    onSubmit={handleTimesheetSubmit}
    onDismiss={() => setShowSubmitPrompt(false)}
  />
)}
```

**Step 4: Pass new props to WeekStrip**

```typescript
<WeekStrip
  selectedDate={selectedDate}
  today={today}
  datesWithEntries={datesWithEntries}
  submittedDates={submittedDates}
  overdueDates={overdueDates}
  onSelectDate={setSelectedDate}
  onPrevWeek={goToPrevWeek}
  onNextWeek={goToNextWeek}
  onGoToToday={goToToday}
  onFetchM365Activity={fetchM365Activity}
  isM365Loading={isM365Loading}
  isM365PanelOpen={isM365PanelOpen}
/>
```

**Step 5: Commit**

```bash
git add app/src/components/timesheets/TimesheetsContent.tsx
git commit -m "feat(ui): wire up submit button and modal in TimesheetsContent"
```

---

## Task 14: Handle Submission Revocation Toast

**Files:**
- Modify: `app/src/components/timesheets/TimesheetsContent.tsx`

**Step 1: Add revocation warning state**

```typescript
const [revocationWarning, setRevocationWarning] = useState<string | null>(null);
```

**Step 2: Update deleteEntry to handle revocation**

```typescript
const deleteEntry = useCallback(async (entryId: string) => {
  setIsLoading(true);
  setError(null);
  try {
    const response = await fetch(`/api/timesheets?id=${entryId}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (response.ok) {
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      fetchDatesWithEntries(selectedDate);

      // Handle revocation
      if (data.submissionRevoked) {
        setIsSubmitted(false);
        setSubmittedDates((prev) => {
          const next = new Set(prev);
          next.delete(formatDateISO(selectedDate));
          return next;
        });
        setRevocationWarning(
          `Your timesheet submission has been revoked. You now have ${data.remainingHours.toFixed(1)} hours logged (8 required).`
        );
        // Clear warning after 5 seconds
        setTimeout(() => setRevocationWarning(null), 5000);
      }
    }
  } catch {
    setError("Failed to delete entry");
  } finally {
    setIsLoading(false);
  }
}, [selectedDate, fetchDatesWithEntries]);
```

**Step 3: Add warning toast in JSX**

```typescript
{/* Revocation Warning Toast */}
{revocationWarning && (
  <div className="fixed bottom-4 right-4 bg-[var(--warning-bg)] border border-[var(--warning)] text-[var(--warning)] px-4 py-3 rounded-lg shadow-lg animate-fade-up max-w-md">
    <p className="text-sm font-medium">{revocationWarning}</p>
  </div>
)}
```

**Step 4: Commit**

```bash
git add app/src/components/timesheets/TimesheetsContent.tsx
git commit -m "feat(ui): add submission revocation warning toast"
```

---

## Task 15: Fetch Submission Status on Mount

**Files:**
- Modify: `app/src/components/timesheets/TimesheetsContent.tsx`

**Step 1: Add fetchSubmittedDates function**

```typescript
const fetchSubmittedDates = useCallback(async (centerDate: Date) => {
  try {
    const year = centerDate.getFullYear();
    const month = centerDate.getMonth() + 1;
    const response = await fetch(`/api/timesheets/submissions?year=${year}&month=${month}`);
    if (response.ok) {
      const dates: string[] = await response.json();
      setSubmittedDates(new Set(dates));
    }
  } catch (err) {
    console.error("Failed to fetch submitted dates:", err);
  }
}, []);
```

**Step 2: Call on mount and date change**

```typescript
useEffect(() => {
  fetchSubmittedDates(selectedDate);
  fetchOverdueStatus();
}, [selectedDate, fetchSubmittedDates, fetchOverdueStatus]);
```

**Step 3: Create the submissions dates endpoint**

Create `app/src/app/api/timesheets/submissions/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { timesheetSubmissions } from "@/lib/schema";
import { requireAuth, getUserFromSession } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");

  if (!yearParam || !monthParam) {
    return NextResponse.json({ error: "Year and month are required" }, { status: 400 });
  }

  const year = parseInt(yearParam, 10);
  const month = parseInt(monthParam, 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "Invalid year or month" }, { status: 400 });
  }

  // Get first and last day of month
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  try {
    const submissions = await db.query.timesheetSubmissions.findMany({
      where: and(
        eq(timesheetSubmissions.userId, user.id),
        gte(timesheetSubmissions.date, startDate),
        lte(timesheetSubmissions.date, endDate)
      ),
      columns: { date: true },
    });

    return NextResponse.json(submissions.map((s) => s.date));
  } catch (error) {
    console.error("Database error fetching submissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }
}
```

**Step 4: Commit**

```bash
git add app/src/components/timesheets/TimesheetsContent.tsx app/src/app/api/timesheets/submissions/
git commit -m "feat: fetch and display submission status for calendar"
```

---

## Task 16: Final Integration Testing

**Step 1: Run all tests**

Run:
```bash
cd app && npm run test -- --run
```

Expected: All tests PASS.

**Step 2: Run the dev server and manual test**

Run:
```bash
cd app && npm run dev
```

Test manually:
1. Log 7 hours - verify submit button shows "Log 8 hours to submit"
2. Log 8th hour - verify auto-prompt modal appears
3. Click "Submit" - verify green checkmark appears in WeekStrip
4. Delete an entry to drop below 8 hours - verify warning toast and checkmark disappears
5. Verify overdue banner shows for past unsubmitted days

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete timesheet submission feature implementation"
```

---

## Summary

This plan implements the timesheet submission feature in 16 tasks:

1. **Schema**: Add `timesheetSubmissions` table
2. **Utilities**: Deadline calculation functions
3. **API**: Submit endpoint
4. **API**: Overdue endpoint
5. **API**: Revocation on delete/update
6. **API**: Submission status in GET
7. **UI**: OverdueBanner component
8. **UI**: Add banner to layout
9. **UI**: WeekStrip status icons
10. **UI**: TimesheetsContent state
11. **UI**: SubmitButton component
12. **UI**: SubmitPromptModal component
13. **UI**: Wire up components
14. **UI**: Revocation toast
15. **API/UI**: Fetch submission status
16. **Testing**: Integration tests
