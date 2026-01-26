# Impersonation Page Access Control - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When impersonating a non-admin user, block access to admin-only pages via URL.

**Architecture:** Create an `(admin)` route group with a shared layout that checks position. Update `getCurrentUser()` to return the impersonated user when active.

**Tech Stack:** Next.js App Router, React Server Components, cookies API

---

## Task 1: Update `getCurrentUser()` to Respect Impersonation

**Files:**
- Modify: `app/src/lib/user.ts:64-78`
- Test: `app/src/lib/user.test.ts`

### Step 1: Write the failing tests

Add these tests to `app/src/lib/user.test.ts`. First, update the mock setup at the top of the file to include cookies:

```typescript
// Add to the vi.hoisted block (around line 4)
const { mockDb, mockCookies } = vi.hoisted(() => {
  return {
    mockDb: {
      query: {
        users: {
          findFirst: vi.fn(),
        },
      },
    },
    mockCookies: {
      get: vi.fn(),
    },
  };
});

// Add this mock after the existing vi.mock calls (around line 27)
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookies)),
}));
```

Then add a new describe block for `getCurrentUser` impersonation tests at the end of the file (before the final closing brace):

```typescript
describe("getCurrentUser with impersonation", () => {
  const mockGetServerSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.get.mockReturnValue(undefined);
  });

  // We need to mock next-auth and redirect for these tests
  vi.mock("next-auth", () => ({
    getServerSession: () => mockGetServerSession(),
  }));

  vi.mock("next/navigation", () => ({
    redirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    }),
  }));

  vi.mock("@/lib/auth", () => ({
    authOptions: {},
  }));

  it("returns impersonated user when cookie set and real user is ADMIN", async () => {
    // This test validates the impersonation flow
    const realAdmin = {
      id: "admin-1",
      name: "Admin User",
      email: "admin@example.com",
      position: "ADMIN" as const,
      status: "ACTIVE",
      image: null,
    };
    const impersonatedUser = {
      id: "user-2",
      name: "Regular User",
      email: "user@example.com",
      position: "ASSOCIATE" as const,
      status: "ACTIVE",
      image: null,
    };

    mockGetServerSession.mockResolvedValue({
      user: { email: "admin@example.com" },
    });
    mockCookies.get.mockReturnValue({ value: "user-2" });

    // First call returns admin, second returns impersonated user
    mockDb.query.users.findFirst
      .mockResolvedValueOnce(realAdmin)
      .mockResolvedValueOnce(impersonatedUser);

    const { getCurrentUser } = await import("./user");
    const result = await getCurrentUser();

    expect(result.id).toBe("user-2");
    expect(result.position).toBe("ASSOCIATE");
  });

  it("returns real user when no impersonation cookie", async () => {
    const realUser = {
      id: "user-1",
      name: "Real User",
      email: "real@example.com",
      position: "PARTNER" as const,
      status: "ACTIVE",
      image: null,
    };

    mockGetServerSession.mockResolvedValue({
      user: { email: "real@example.com" },
    });
    mockCookies.get.mockReturnValue(undefined);
    mockDb.query.users.findFirst.mockResolvedValue(realUser);

    const { getCurrentUser } = await import("./user");
    const result = await getCurrentUser();

    expect(result.id).toBe("user-1");
    expect(result.position).toBe("PARTNER");
  });

  it("returns real user when cookie exists but real user is not ADMIN", async () => {
    const realUser = {
      id: "user-1",
      name: "Partner User",
      email: "partner@example.com",
      position: "PARTNER" as const,
      status: "ACTIVE",
      image: null,
    };

    mockGetServerSession.mockResolvedValue({
      user: { email: "partner@example.com" },
    });
    mockCookies.get.mockReturnValue({ value: "user-2" });
    mockDb.query.users.findFirst.mockResolvedValue(realUser);

    const { getCurrentUser } = await import("./user");
    const result = await getCurrentUser();

    // Should return real user, not attempt impersonation
    expect(result.id).toBe("user-1");
    expect(result.position).toBe("PARTNER");
  });
});
```

### Step 2: Run tests to verify they fail

Run: `cd app && npm test -- user.test.ts --run`

Expected: Tests fail because `getCurrentUser` doesn't check impersonation cookie yet.

### Step 3: Implement impersonation in `getCurrentUser()`

Replace the `getCurrentUser` function in `app/src/lib/user.ts` (lines 64-78):

```typescript
/**
 * Get the current authenticated user (cached per request).
 * Redirects to login if not authenticated.
 * Respects impersonation: returns impersonated user if ADMIN has set cookie.
 */
export const getCurrentUser = cache(async (): Promise<AuthenticatedUser> => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  const realUser = await db.query.users.findFirst({
    where: eq(users.email, session.user.email),
    columns: { id: true, name: true, position: true, image: true, status: true },
  });

  if (!realUser) {
    redirect("/login");
  }

  // Check for impersonation cookie (only ADMIN can impersonate)
  const cookieStore = await cookies();
  const impersonateUserId = cookieStore.get("impersonate_user_id")?.value;

  if (impersonateUserId && realUser.position === "ADMIN") {
    const impersonatedUser = await db.query.users.findFirst({
      where: eq(users.id, impersonateUserId),
      columns: { id: true, name: true, position: true, image: true, status: true },
    });

    if (impersonatedUser && impersonatedUser.status !== "INACTIVE") {
      return {
        id: impersonatedUser.id,
        name: impersonatedUser.name || "User",
        position: impersonatedUser.position,
        initials: getInitials(impersonatedUser.name),
        image: impersonatedUser.image,
      };
    }
  }

  return {
    id: realUser.id,
    name: realUser.name || "User",
    position: realUser.position,
    initials: getInitials(realUser.name),
    image: realUser.image,
  };
});
```

Add import at the top of the file (after line 3):

```typescript
import { cookies } from "next/headers";
```

### Step 4: Run tests to verify they pass

Run: `cd app && npm test -- user.test.ts --run`

Expected: All tests pass.

### Step 5: Commit

```bash
git add app/src/lib/user.ts app/src/lib/user.test.ts
git commit -m "$(cat <<'EOF'
feat: make getCurrentUser() respect impersonation cookie

When an ADMIN user has the impersonate_user_id cookie set,
getCurrentUser() now returns the impersonated user instead.
This mirrors the behavior already in requireAuth() for API routes.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create Admin Route Group and Layout

**Files:**
- Create: `app/src/app/(authenticated)/(admin)/layout.tsx`

### Step 1: Create the admin layout

Create new file `app/src/app/(authenticated)/(admin)/layout.tsx`:

```typescript
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!["ADMIN", "PARTNER"].includes(user.position)) {
    redirect("/timesheets");
  }

  return children;
}
```

### Step 2: Verify the file was created correctly

Run: `cat app/src/app/\(authenticated\)/\(admin\)/layout.tsx`

Expected: File contents match above.

### Step 3: Commit

```bash
git add "app/src/app/(authenticated)/(admin)/layout.tsx"
git commit -m "$(cat <<'EOF'
feat: add admin route group with access control layout

Creates (admin) route group that restricts access to ADMIN/PARTNER
positions. Non-admin users are redirected to /timesheets.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Move Admin Pages to Route Group

**Files:**
- Move: `app/src/app/(authenticated)/clients/` → `app/src/app/(authenticated)/(admin)/clients/`
- Move: `app/src/app/(authenticated)/billing/` → `app/src/app/(authenticated)/(admin)/billing/`
- Move: `app/src/app/(authenticated)/reports/` → `app/src/app/(authenticated)/(admin)/reports/`
- Move: `app/src/app/(authenticated)/topics/` → `app/src/app/(authenticated)/(admin)/topics/`

### Step 1: Move all admin page directories

```bash
cd app/src/app/\(authenticated\) && \
mv clients ../\(authenticated\)/\(admin\)/ && \
mv billing ../\(authenticated\)/\(admin\)/ && \
mv reports ../\(authenticated\)/\(admin\)/ && \
mv topics ../\(authenticated\)/\(admin\)/
```

### Step 2: Verify structure

Run: `ls -la app/src/app/\(authenticated\)/\(admin\)/`

Expected: Should show `layout.tsx`, `clients/`, `billing/`, `reports/`, `topics/`

### Step 3: Verify app still builds

Run: `cd app && npm run build`

Expected: Build succeeds (URLs unchanged due to route group parentheses).

### Step 4: Commit

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: move admin pages into (admin) route group

Moves clients, billing, reports, and topics pages into the (admin)
route group. URLs remain unchanged - the parentheses make it a
route group that only affects file organization.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Remove Redundant Position Checks

**Files:**
- Modify: `app/src/app/(authenticated)/(admin)/clients/page.tsx`
- Modify: `app/src/app/(authenticated)/(admin)/billing/page.tsx`
- Modify: `app/src/app/(authenticated)/(admin)/billing/[id]/page.tsx`

### Step 1: Remove position check from clients/page.tsx

In `app/src/app/(authenticated)/(admin)/clients/page.tsx`, remove lines 9-13:

```typescript
// REMOVE these lines:
  // Only ADMIN or PARTNER can access clients page
  if (!["ADMIN", "PARTNER"].includes(user.position)) {
    redirect("/timesheets");
  }
```

The file should now have `getCurrentUser()` call used only for the query (if needed) or can be removed if not used elsewhere. Keep the import for `getCurrentUser` only if it's still used.

After removal, line 7 (`export default async function ClientsPage()`) should be followed directly by the `clientsList` query.

Actually, looking at the file, `user` isn't used after the position check, so we can remove the entire `getCurrentUser()` call:

Remove lines 7-13 and the unused import. The file becomes:

```typescript
import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { db, clients } from "@/lib/db";
import { ClientsContent } from "@/components/clients/ClientsContent";

export default async function ClientsPage() {
  const clientsList = await db.query.clients.findMany({
    // ... rest of the function unchanged
```

Wait, we still need `redirect` import for potential future use... Actually no, since we removed the redirect. Remove that import too.

Final `clients/page.tsx`:

```typescript
import { desc } from "drizzle-orm";
import { db, clients } from "@/lib/db";
import { ClientsContent } from "@/components/clients/ClientsContent";

export default async function ClientsPage() {
  const clientsList = await db.query.clients.findMany({
    columns: {
      id: true,
      name: true,
      invoicedName: true,
      invoiceAttn: true,
      email: true,
      secondaryEmails: true,
      hourlyRate: true,
      phone: true,
      address: true,
      practiceArea: true,
      status: true,
      clientType: true,
      notes: true,
      createdAt: true,
    },
    orderBy: [desc(clients.createdAt)],
  });

  // Convert for client component (numeric string to number, timestamp string already ISO)
  const serializedClients = clientsList.map((client) => ({
    ...client,
    hourlyRate: client.hourlyRate ? Number(client.hourlyRate) : null,
    createdAt: client.createdAt,
  }));

  return <ClientsContent initialClients={serializedClients} />;
}
```

### Step 2: Remove position check from billing/page.tsx

In `app/src/app/(authenticated)/(admin)/billing/page.tsx`, remove lines 8-12 (the getCurrentUser call and position check):

```typescript
// REMOVE these lines:
  const user = await getCurrentUser();

  if (!["ADMIN", "PARTNER"].includes(user.position)) {
    redirect("/timesheets");
  }
```

Also remove unused imports: `redirect` from "next/navigation" and `getCurrentUser` from "@/lib/user".

Final imports:

```typescript
import { eq, asc, desc, and } from "drizzle-orm";
import { db, clients, serviceDescriptions } from "@/lib/db";
import { BillingContent } from "@/components/billing/BillingContent";
```

### Step 3: Remove position check from billing/[id]/page.tsx

In `app/src/app/(authenticated)/(admin)/billing/[id]/page.tsx`, remove lines 13-18:

```typescript
// REMOVE these lines:
  const user = await getCurrentUser();

  if (!["ADMIN", "PARTNER"].includes(user.position)) {
    redirect("/billing");
  }
```

Also remove unused import `getCurrentUser` from "@/lib/user". Keep `redirect` since it's used for the "not found" case (line 50).

Final imports:

```typescript
import { redirect } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { db, serviceDescriptions, serviceDescriptionTopics, serviceDescriptionLineItems } from "@/lib/db";
import { ServiceDescriptionDetail } from "@/components/billing/ServiceDescriptionDetail";
import { serializeDecimal } from "@/lib/api-utils";
import type { ServiceDescription } from "@/types";
```

### Step 4: Verify app still builds

Run: `cd app && npm run build`

Expected: Build succeeds.

### Step 5: Commit

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor: remove redundant position checks from admin pages

Position checks are now handled by the (admin) layout, so individual
pages no longer need them. Removes duplicate code from clients,
billing, and billing/[id] pages.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Manual Testing

### Step 1: Start dev server

Run: `cd app && npm run dev`

### Step 2: Test as admin (no impersonation)

1. Log in as ADMIN user
2. Navigate to `/clients` - should work
3. Navigate to `/billing` - should work
4. Navigate to `/reports` - should work
5. Navigate to `/topics` - should work

### Step 3: Test impersonation of non-admin

1. Go to `/team`
2. Click "View as" on a non-admin user (e.g., ASSOCIATE)
3. Sidebar should hide admin menu items
4. Navigate directly to `/clients` via URL bar - should redirect to `/timesheets`
5. Navigate directly to `/billing` via URL bar - should redirect to `/timesheets`
6. Navigate directly to `/reports` via URL bar - should redirect to `/timesheets`
7. Navigate directly to `/topics` via URL bar - should redirect to `/timesheets`

### Step 4: Test exit impersonation

1. Click "Exit Impersonation" in sidebar
2. Navigate to `/clients` - should work again
3. Admin menu items should be visible

### Step 5: Run all tests

Run: `cd app && npm run test -- --run`

Expected: All tests pass.

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Update `getCurrentUser()` to check impersonation cookie |
| 2 | Create `(admin)` route group with access control layout |
| 3 | Move admin pages (clients, billing, reports, topics) into route group |
| 4 | Remove redundant position checks from individual pages |
| 5 | Manual testing to verify impersonation blocks admin URLs |
