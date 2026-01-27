# Timesheet Submission Exclusions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Exclude ADMIN and CONSULTANT positions from timesheet overdue tracking while still allowing voluntary submissions.

**Architecture:** Add a new position group `TIMESHEET_REQUIRED_POSITIONS` in `api-utils.ts` with a helper function. Filter overdue calculations in the API route to only include positions that require submission.

**Tech Stack:** TypeScript, Next.js API routes, Vitest

---

## Task 1: Add Position Group and Helper Function

**Files:**
- Modify: `app/src/lib/api-utils.ts:13-34`
- Test: `app/src/lib/api-utils.test.ts` (create if needed)

**Step 1: Write the failing test**

Add test to `app/src/lib/api-utils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { requiresTimesheetSubmission, hasAdminAccess, canViewTeamTimesheets } from "./api-utils";

describe("requiresTimesheetSubmission", () => {
  it("returns true for PARTNER", () => {
    expect(requiresTimesheetSubmission("PARTNER")).toBe(true);
  });

  it("returns true for SENIOR_ASSOCIATE", () => {
    expect(requiresTimesheetSubmission("SENIOR_ASSOCIATE")).toBe(true);
  });

  it("returns true for ASSOCIATE", () => {
    expect(requiresTimesheetSubmission("ASSOCIATE")).toBe(true);
  });

  it("returns false for ADMIN", () => {
    expect(requiresTimesheetSubmission("ADMIN")).toBe(false);
  });

  it("returns false for CONSULTANT", () => {
    expect(requiresTimesheetSubmission("CONSULTANT")).toBe(false);
  });

  it("returns false for unknown position", () => {
    expect(requiresTimesheetSubmission("UNKNOWN")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- api-utils.test.ts --run`
Expected: FAIL with "requiresTimesheetSubmission is not exported"

**Step 3: Write minimal implementation**

Add to `app/src/lib/api-utils.ts` after line 20 (after `TEAM_VIEW_POSITIONS`):

```typescript
// Positions required to submit timesheets daily
const TIMESHEET_REQUIRED_POSITIONS = ["PARTNER", "SENIOR_ASSOCIATE", "ASSOCIATE"] as const;

/**
 * Check if a position is required to submit timesheets.
 */
export function requiresTimesheetSubmission(position: string): boolean {
  return TIMESHEET_REQUIRED_POSITIONS.includes(position as (typeof TIMESHEET_REQUIRED_POSITIONS)[number]);
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- api-utils.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add app/src/lib/api-utils.ts app/src/lib/api-utils.test.ts
git commit -m "feat: add requiresTimesheetSubmission helper function"
```

---

## Task 2: Update API Route for Regular Users

**Files:**
- Modify: `app/src/app/api/timesheets/overdue/route.ts:75-87`
- Test: `app/src/app/api/timesheets/overdue/route.test.ts`

**Step 1: Write the failing tests**

Add to `app/src/app/api/timesheets/overdue/route.test.ts` inside the "Regular users" describe block:

```typescript
it("returns empty array for CONSULTANT (not required to submit)", async () => {
  const user = createMockUser({ position: "CONSULTANT" });
  setupAuthenticatedUser(user);
  mockHasAdminAccess.mockReturnValue(false);

  // No submissions
  mockDb.query.timesheetSubmissions.findMany.mockResolvedValue([]);

  const request = createMockRequest({
    method: "GET",
    url: "/api/timesheets/overdue",
  });

  const response = await GET(request);
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data.overdue).toEqual([]);
});

it("returns empty array for ADMIN when not viewing team (not required to submit)", async () => {
  const user = createMockUser({ position: "ADMIN" });
  setupAuthenticatedUser(user);
  // Simulate non-admin path by returning false
  mockHasAdminAccess.mockReturnValue(false);

  mockDb.query.timesheetSubmissions.findMany.mockResolvedValue([]);

  const request = createMockRequest({
    method: "GET",
    url: "/api/timesheets/overdue",
  });

  const response = await GET(request);
  const data = await response.json();

  expect(response.status).toBe(200);
  expect(data.overdue).toEqual([]);
});
```

Also add to the mocks at the top of the file (inside `vi.mock("@/lib/api-utils")`):

```typescript
const { mockRequireAuth, mockGetUserFromSession, mockHasAdminAccess, mockRequiresTimesheetSubmission, mockDb } = vi.hoisted(() => {
  return {
    mockRequireAuth: vi.fn(),
    mockGetUserFromSession: vi.fn(),
    mockHasAdminAccess: vi.fn(),
    mockRequiresTimesheetSubmission: vi.fn(),
    mockDb: {
      // ... existing mockDb
    },
  };
});

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...original,
    requireAuth: mockRequireAuth,
    getUserFromSession: mockGetUserFromSession,
    hasAdminAccess: mockHasAdminAccess,
    requiresTimesheetSubmission: mockRequiresTimesheetSubmission,
  };
});
```

Update `setupAuthenticatedUser` helper to also mock `requiresTimesheetSubmission`:

```typescript
function setupAuthenticatedUser(user: MockUser) {
  mockRequireAuth.mockResolvedValue({
    session: { user: { name: user.name, email: user.email } },
  });
  mockGetUserFromSession.mockResolvedValue({
    id: user.id,
    email: user.email,
    name: user.name,
    position: user.position,
  });
  // Mock requiresTimesheetSubmission based on position
  const requiredPositions = ["PARTNER", "SENIOR_ASSOCIATE", "ASSOCIATE"];
  mockRequiresTimesheetSubmission.mockReturnValue(requiredPositions.includes(user.position));
}
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- overdue/route.test.ts --run`
Expected: FAIL - CONSULTANT test expects empty array but gets overdue dates

**Step 3: Write minimal implementation**

Modify `app/src/app/api/timesheets/overdue/route.ts`:

Add import at line 5:
```typescript
import { requireAuth, getUserFromSession, hasAdminAccess, requiresTimesheetSubmission } from "@/lib/api-utils";
```

Add early return after getting user (around line 75, before the regular user section):
```typescript
    // 4. Regular user: check if required to submit
    if (!requiresTimesheetSubmission(user.position)) {
      return NextResponse.json({ overdue: [] });
    }

    // 5. Get own submissions and calculate overdue
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- overdue/route.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add app/src/app/api/timesheets/overdue/route.ts app/src/app/api/timesheets/overdue/route.test.ts
git commit -m "feat: exclude ADMIN/CONSULTANT from personal overdue tracking"
```

---

## Task 3: Update API Route for Team View

**Files:**
- Modify: `app/src/app/api/timesheets/overdue/route.ts:35-72`
- Test: `app/src/app/api/timesheets/overdue/route.test.ts`

**Step 1: Write the failing tests**

Add to `app/src/app/api/timesheets/overdue/route.test.ts` inside "Admins and Partners" describe block:

```typescript
it("excludes ADMIN and CONSULTANT from team overdue list", async () => {
  const adminUser = createMockUser({ position: "ADMIN", name: "Admin User" });
  setupAuthenticatedUser(adminUser);
  mockHasAdminAccess.mockReturnValue(true);

  // Mock active users including ADMIN and CONSULTANT
  const associate = createMockUser({ id: "user-1", name: "John Associate", position: "ASSOCIATE" });
  const consultant = createMockUser({ id: "user-2", name: "Jane Consultant", position: "CONSULTANT" });
  const otherAdmin = createMockUser({ id: "user-3", name: "Other Admin", position: "ADMIN" });

  mockDb.query.users.findMany.mockResolvedValue([
    { id: associate.id, name: associate.name, email: associate.email, position: associate.position, status: "ACTIVE" },
    { id: consultant.id, name: consultant.name, email: consultant.email, position: consultant.position, status: "ACTIVE" },
    { id: otherAdmin.id, name: otherAdmin.name, email: otherAdmin.email, position: otherAdmin.position, status: "ACTIVE" },
    { id: adminUser.id, name: adminUser.name, email: adminUser.email, position: adminUser.position, status: "ACTIVE" },
  ]);

  // No submissions - everyone would have overdue if they're tracked
  mockDb.query.timesheetSubmissions.findMany.mockResolvedValue([]);

  const request = createMockRequest({
    method: "GET",
    url: "/api/timesheets/overdue",
  });

  const response = await GET(request);
  const data = await response.json();

  expect(response.status).toBe(200);

  // Only ASSOCIATE should appear in overdue list
  expect(data.overdue).toHaveLength(1);
  expect(data.overdue[0].userId).toBe(associate.id);
  expect(data.overdue[0].name).toBe("John Associate");

  // CONSULTANT and ADMINs should NOT appear
  const consultantEntry = data.overdue.find((e: { userId: string }) => e.userId === consultant.id);
  const adminEntry = data.overdue.find((e: { userId: string }) => e.userId === adminUser.id);
  const otherAdminEntry = data.overdue.find((e: { userId: string }) => e.userId === otherAdmin.id);

  expect(consultantEntry).toBeUndefined();
  expect(adminEntry).toBeUndefined();
  expect(otherAdminEntry).toBeUndefined();
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- overdue/route.test.ts --run`
Expected: FAIL - expects 1 user in overdue but gets 4

**Step 3: Write minimal implementation**

Modify `app/src/app/api/timesheets/overdue/route.ts` in the admin section (around line 37-42):

Replace the existing filtering logic:
```typescript
      // Get all active users
      const activeUsers = await db.query.users.findMany({
        where: eq(users.status, "ACTIVE"),
        columns: { id: true, name: true, email: true, position: true },
      });

      // Filter to only positions required to submit timesheets
      const usersRequiringSubmission = activeUsers.filter(u =>
        requiresTimesheetSubmission(u.position)
      );
```

Update the loop to use `usersRequiringSubmission` instead of `activeUsers`:
```typescript
      // Calculate overdue for each user
      const overdueByUser: UserOverdue[] = [];
      for (const u of usersRequiringSubmission) {
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- overdue/route.test.ts --run`
Expected: PASS

**Step 5: Commit**

```bash
git add app/src/app/api/timesheets/overdue/route.ts app/src/app/api/timesheets/overdue/route.test.ts
git commit -m "feat: exclude ADMIN/CONSULTANT from team overdue list"
```

---

## Task 4: Run Full Test Suite and Verify

**Step 1: Run all tests**

Run: `npm run test -- --run`
Expected: All tests pass

**Step 2: Manual verification (optional)**

Start dev server and verify:
1. Log in as CONSULTANT - should see no overdue banner
2. Log in as ADMIN - team banner should exclude ADMINs/CONSULTANTs
3. Log in as ASSOCIATE - should see personal overdue banner as before

**Step 3: Final commit with any fixes**

If any issues found, fix and commit.

---

## Summary of Changes

| File | Change |
|------|--------|
| `lib/api-utils.ts` | Add `TIMESHEET_REQUIRED_POSITIONS` and `requiresTimesheetSubmission()` |
| `lib/api-utils.test.ts` | New file with tests for the helper function |
| `api/timesheets/overdue/route.ts` | Filter users by submission requirement |
| `api/timesheets/overdue/route.test.ts` | Add tests for ADMIN/CONSULTANT exclusion |
