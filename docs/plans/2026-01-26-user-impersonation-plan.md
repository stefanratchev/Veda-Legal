# User Impersonation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow ADMIN users to impersonate other users to verify production functionality from their perspective.

**Architecture:** Cookie-based impersonation using a session cookie (`impersonate_user_id`) that integrates with the existing `requireAuth()` pattern. The cookie auto-clears on browser close. All existing API routes automatically respect impersonation since they use `requireAuth()`.

**Tech Stack:** Next.js API routes, NextAuth JWT sessions, React Context, httpOnly cookies

---

## Task 1: Create Impersonation API Endpoints

**Files:**
- Create: `app/src/app/api/admin/impersonate/route.ts`
- Test: `app/src/app/api/admin/impersonate/route.test.ts`

**Step 1: Write the test file**

Create `app/src/app/api/admin/impersonate/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST, DELETE } from "./route";

// Mock dependencies
vi.mock("@/lib/api-utils", () => ({
  requireAuth: vi.fn(),
  errorResponse: (error: string, status: number) =>
    new Response(JSON.stringify({ error }), { status }),
  successResponse: <T>(data: T) =>
    new Response(JSON.stringify(data), { status: 200 }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

import { requireAuth } from "@/lib/api-utils";
import { db } from "@/lib/db";

describe("Impersonate API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/admin/impersonate", () => {
    it("returns 401 if not authenticated", async () => {
      vi.mocked(requireAuth).mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = new NextRequest("http://localhost/api/admin/impersonate", {
        method: "POST",
        body: JSON.stringify({ userId: "user-123" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it("returns 403 if user is not ADMIN", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        session: { user: { email: "partner@test.com" } },
      });
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: "admin-1",
        position: "PARTNER",
        status: "ACTIVE",
      });

      const request = new NextRequest("http://localhost/api/admin/impersonate", {
        method: "POST",
        body: JSON.stringify({ userId: "user-123" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(403);
    });

    it("returns 400 if trying to impersonate self", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        session: { user: { email: "admin@test.com" } },
      });
      vi.mocked(db.query.users.findFirst)
        .mockResolvedValueOnce({ id: "admin-1", position: "ADMIN", status: "ACTIVE" })
        .mockResolvedValueOnce({ id: "admin-1", email: "admin@test.com", name: "Admin", position: "ADMIN", status: "ACTIVE" });

      const request = new NextRequest("http://localhost/api/admin/impersonate", {
        method: "POST",
        body: JSON.stringify({ userId: "admin-1" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it("returns 404 if target user not found", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        session: { user: { email: "admin@test.com" } },
      });
      vi.mocked(db.query.users.findFirst)
        .mockResolvedValueOnce({ id: "admin-1", position: "ADMIN", status: "ACTIVE" })
        .mockResolvedValueOnce(undefined);

      const request = new NextRequest("http://localhost/api/admin/impersonate", {
        method: "POST",
        body: JSON.stringify({ userId: "nonexistent" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(404);
    });

    it("sets cookie and returns user on success", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        session: { user: { email: "admin@test.com" } },
      });
      vi.mocked(db.query.users.findFirst)
        .mockResolvedValueOnce({ id: "admin-1", position: "ADMIN", status: "ACTIVE" })
        .mockResolvedValueOnce({ id: "user-123", email: "user@test.com", name: "Test User", position: "ASSOCIATE", status: "ACTIVE" });

      const request = new NextRequest("http://localhost/api/admin/impersonate", {
        method: "POST",
        body: JSON.stringify({ userId: "user-123" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const cookie = response.headers.get("set-cookie");
      expect(cookie).toContain("impersonate_user_id=user-123");
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("SameSite=Strict");
    });
  });

  describe("DELETE /api/admin/impersonate", () => {
    it("clears the cookie", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        session: { user: { email: "admin@test.com" } },
      });

      const request = new NextRequest("http://localhost/api/admin/impersonate", {
        method: "DELETE",
      });

      const response = await DELETE(request);
      expect(response.status).toBe(200);

      const cookie = response.headers.get("set-cookie");
      expect(cookie).toContain("impersonate_user_id=");
      expect(cookie).toContain("Max-Age=0");
    });
  });

  describe("GET /api/admin/impersonate", () => {
    it("returns impersonating: false when no cookie", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        session: { user: { email: "admin@test.com" } },
      });

      const request = new NextRequest("http://localhost/api/admin/impersonate", {
        method: "GET",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data).toEqual({ impersonating: false });
    });

    it("returns user details when impersonating", async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        session: { user: { email: "admin@test.com" } },
      });
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: "user-123",
        name: "Test User",
        position: "ASSOCIATE",
        image: null,
      });

      const request = new NextRequest("http://localhost/api/admin/impersonate", {
        method: "GET",
        headers: {
          cookie: "impersonate_user_id=user-123",
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data).toEqual({
        impersonating: true,
        user: {
          id: "user-123",
          name: "Test User",
          position: "ASSOCIATE",
          image: null,
        },
      });
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd app && npm run test -- api/admin/impersonate/route.test.ts`

Expected: FAIL - route.ts doesn't exist

**Step 3: Write the API route implementation**

Create `app/src/app/api/admin/impersonate/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAuth, errorResponse, successResponse } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";

const COOKIE_NAME = "impersonate_user_id";

/**
 * GET /api/admin/impersonate
 * Returns current impersonation state
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const impersonateUserId = request.cookies.get(COOKIE_NAME)?.value;

  if (!impersonateUserId) {
    return successResponse({ impersonating: false });
  }

  const impersonatedUser = await db.query.users.findFirst({
    where: eq(users.id, impersonateUserId),
    columns: { id: true, name: true, position: true, image: true },
  });

  if (!impersonatedUser) {
    return successResponse({ impersonating: false });
  }

  return successResponse({
    impersonating: true,
    user: impersonatedUser,
  });
}

/**
 * POST /api/admin/impersonate
 * Start impersonating a user (ADMIN only)
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const userEmail = auth.session.user?.email;
  if (!userEmail) {
    return errorResponse("Email required", 403);
  }

  // Verify current user is ADMIN
  const currentUser = await db.query.users.findFirst({
    where: eq(users.email, userEmail),
    columns: { id: true, position: true, status: true },
  });

  if (!currentUser || currentUser.position !== "ADMIN") {
    return errorResponse("Only ADMIN can impersonate users", 403);
  }

  // Parse request body
  const body = await request.json();
  const { userId } = body;

  if (!userId) {
    return errorResponse("userId is required", 400);
  }

  // Fetch target user
  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, email: true, name: true, position: true, status: true },
  });

  if (!targetUser) {
    return errorResponse("User not found", 404);
  }

  // Prevent self-impersonation
  if (targetUser.id === currentUser.id) {
    return errorResponse("Cannot impersonate yourself", 400);
  }

  // Prevent impersonating inactive users
  if (targetUser.status === "INACTIVE") {
    return errorResponse("Cannot impersonate inactive user", 400);
  }

  // Set the impersonation cookie
  const response = NextResponse.json({
    success: true,
    user: {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      position: targetUser.position,
    },
  });

  response.cookies.set(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    // No maxAge = session cookie (cleared on browser close)
  });

  return response;
}

/**
 * DELETE /api/admin/impersonate
 * Stop impersonating
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0, // Delete cookie
  });

  return response;
}
```

**Step 4: Run tests to verify they pass**

Run: `cd app && npm run test -- api/admin/impersonate/route.test.ts`

Expected: PASS

**Step 5: Commit**

```bash
git add app/src/app/api/admin/impersonate/
git commit -m "feat: add impersonation API endpoints

- POST to start impersonating (ADMIN only)
- DELETE to stop impersonating
- GET to check current impersonation state
- Uses session cookie that clears on browser close

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Modify requireAuth to Support Impersonation

**Files:**
- Modify: `app/src/lib/api-utils.ts`
- Test: `app/src/lib/api-utils.test.ts` (update existing tests)

**Step 1: Write failing test for impersonation in requireAuth**

Add to `app/src/lib/api-utils.test.ts` (create if doesn't exist):

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/db", () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { db } from "@/lib/db";
import { requireAuth } from "./api-utils";

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns session for authenticated user", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "user@test.com", name: "Test User" },
    });

    const request = new NextRequest("http://localhost/api/test");
    const result = await requireAuth(request);

    expect(result).toEqual({
      session: { user: { email: "user@test.com", name: "Test User" } },
    });
  });

  it("returns 401 for unauthenticated request", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    vi.mocked(getToken).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/test");
    const result = await requireAuth(request);

    expect(result).toEqual({ error: "Unauthorized", status: 401 });
  });

  describe("impersonation", () => {
    it("returns impersonated user when admin has impersonation cookie", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { email: "admin@test.com", name: "Admin" },
      });

      // First call: get real user (admin check)
      // Second call: get impersonated user
      vi.mocked(db.query.users.findFirst)
        .mockResolvedValueOnce({ id: "admin-1", position: "ADMIN", status: "ACTIVE" })
        .mockResolvedValueOnce({ id: "user-123", email: "user@test.com", name: "User", position: "ASSOCIATE", status: "ACTIVE" });

      const request = new NextRequest("http://localhost/api/test", {
        headers: {
          cookie: "impersonate_user_id=user-123",
        },
      });

      const result = await requireAuth(request);

      expect(result).toEqual({
        session: { user: { email: "user@test.com", name: "User" } },
      });
    });

    it("ignores impersonation cookie for non-ADMIN users", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { email: "partner@test.com", name: "Partner" },
      });

      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        id: "partner-1",
        position: "PARTNER",
        status: "ACTIVE",
      });

      const request = new NextRequest("http://localhost/api/test", {
        headers: {
          cookie: "impersonate_user_id=user-123",
        },
      });

      const result = await requireAuth(request);

      expect(result).toEqual({
        session: { user: { email: "partner@test.com", name: "Partner" } },
      });
    });

    it("ignores impersonation cookie if impersonated user is inactive", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { email: "admin@test.com", name: "Admin" },
      });

      vi.mocked(db.query.users.findFirst)
        .mockResolvedValueOnce({ id: "admin-1", position: "ADMIN", status: "ACTIVE" })
        .mockResolvedValueOnce({ id: "user-123", email: "user@test.com", name: "User", position: "ASSOCIATE", status: "INACTIVE" });

      const request = new NextRequest("http://localhost/api/test", {
        headers: {
          cookie: "impersonate_user_id=user-123",
        },
      });

      const result = await requireAuth(request);

      expect(result).toEqual({
        session: { user: { email: "admin@test.com", name: "Admin" } },
      });
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd app && npm run test -- api-utils.test.ts`

Expected: FAIL - impersonation tests fail

**Step 3: Update requireAuth to handle impersonation**

Modify `app/src/lib/api-utils.ts`, update the `requireAuth` function:

```typescript
/**
 * Require authentication for API routes.
 * Supports both server session and JWT token authentication.
 * Also handles admin impersonation via cookie.
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  // Try getServerSession first
  const session = await getServerSession(authOptions);
  let realUser: { name?: string | null; email?: string | null } | null = null;

  if (session?.user) {
    realUser = { name: session.user.name, email: session.user.email };
  } else {
    // Fallback: check JWT token directly (works better with chunked cookies)
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (token) {
      realUser = { name: token.name, email: token.email };
    }
  }

  if (!realUser) {
    return { error: "Unauthorized", status: 401 };
  }

  // Check for impersonation cookie
  const impersonateUserId = request.cookies.get("impersonate_user_id")?.value;

  if (impersonateUserId && realUser.email) {
    // Verify real user is ADMIN
    const adminUser = await db.query.users.findFirst({
      where: eq(users.email, realUser.email),
      columns: { id: true, position: true, status: true },
    });

    if (adminUser?.position === "ADMIN") {
      // Fetch impersonated user
      const impersonatedUser = await db.query.users.findFirst({
        where: eq(users.id, impersonateUserId),
        columns: { id: true, email: true, name: true, position: true, status: true },
      });

      // Only impersonate if user exists and is active
      if (impersonatedUser && impersonatedUser.status !== "INACTIVE") {
        return {
          session: {
            user: {
              name: impersonatedUser.name,
              email: impersonatedUser.email,
            },
          },
        };
      }
    }
  }

  return { session: { user: realUser } };
}
```

**Step 4: Run tests to verify they pass**

Run: `cd app && npm run test -- api-utils.test.ts`

Expected: PASS

**Step 5: Run all tests to ensure no regressions**

Run: `cd app && npm run test -- --run`

Expected: All tests pass

**Step 6: Commit**

```bash
git add app/src/lib/api-utils.ts app/src/lib/api-utils.test.ts
git commit -m "feat: add impersonation support to requireAuth

- Check for impersonate_user_id cookie
- Verify real user is ADMIN before allowing impersonation
- Return impersonated user identity if valid
- Ignore cookie for non-admins or inactive impersonated users

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create ImpersonationContext

**Files:**
- Create: `app/src/contexts/ImpersonationContext.tsx`

**Step 1: Create the context file**

Create `app/src/contexts/ImpersonationContext.tsx`:

```typescript
"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface ImpersonatedUser {
  id: string;
  name: string | null;
  position: string;
  image: string | null;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedUser: ImpersonatedUser | null;
  isLoading: boolean;
  startImpersonation: (userId: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  refresh: () => Promise<void>;
}

const ImpersonationContext = createContext<ImpersonationContextType | null>(null);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/impersonate");
      if (response.ok) {
        const data = await response.json();
        setIsImpersonating(data.impersonating);
        setImpersonatedUser(data.impersonating ? data.user : null);
      }
    } catch (error) {
      console.error("Failed to fetch impersonation state:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startImpersonation = useCallback(async (userId: string) => {
    try {
      const response = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start impersonation");
      }

      const data = await response.json();
      setIsImpersonating(true);
      setImpersonatedUser({
        id: data.user.id,
        name: data.user.name,
        position: data.user.position,
        image: null,
      });

      // Redirect to timesheets to see impersonated view
      router.push("/timesheets");
      router.refresh();
    } catch (error) {
      console.error("Failed to start impersonation:", error);
      throw error;
    }
  }, [router]);

  const stopImpersonation = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/impersonate", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to stop impersonation");
      }

      setIsImpersonating(false);
      setImpersonatedUser(null);

      // Refresh the page to restore admin view
      router.refresh();
    } catch (error) {
      console.error("Failed to stop impersonation:", error);
      throw error;
    }
  }, [router]);

  return (
    <ImpersonationContext.Provider
      value={{
        isImpersonating,
        impersonatedUser,
        isLoading,
        startImpersonation,
        stopImpersonation,
        refresh,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error("useImpersonation must be used within ImpersonationProvider");
  }
  return context;
}
```

**Step 2: Run lint to verify no errors**

Run: `cd app && npm run lint`

Expected: No errors

**Step 3: Commit**

```bash
git add app/src/contexts/ImpersonationContext.tsx
git commit -m "feat: add ImpersonationContext for managing impersonation state

- Tracks isImpersonating and impersonatedUser state
- Provides startImpersonation and stopImpersonation methods
- Auto-fetches state on mount
- Redirects to /timesheets after starting impersonation

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Add ImpersonationProvider to Layout

**Files:**
- Modify: `app/src/app/(authenticated)/layout.tsx`

**Step 1: Update layout to include ImpersonationProvider**

Modify `app/src/app/(authenticated)/layout.tsx`:

```typescript
import { getCurrentUser } from "@/lib/user";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainContent } from "@/components/layout/MainContent";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { OverdueBanner } from "@/components/layout/OverdueBanner";
import { MobileNavProvider } from "@/contexts/MobileNavContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { hasAdminAccess } from "@/lib/api-utils";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const isAdmin = hasAdminAccess(user.position);

  return (
    <ImpersonationProvider>
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
              <OverdueBanner isAdmin={isAdmin} userName={user.name} />
              <MobileHeader />
              <div className="px-3 py-4 md:px-4 lg:px-6 lg:py-5">{children}</div>
            </MainContent>
          </div>
        </SidebarProvider>
      </MobileNavProvider>
    </ImpersonationProvider>
  );
}
```

**Step 2: Run lint to verify no errors**

Run: `cd app && npm run lint`

Expected: No errors

**Step 3: Commit**

```bash
git add app/src/app/\(authenticated\)/layout.tsx
git commit -m "feat: wrap authenticated layout with ImpersonationProvider

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Update Sidebar to Show Impersonation Indicator

**Files:**
- Modify: `app/src/components/layout/Sidebar.tsx`

**Step 1: Update Sidebar to show impersonation state**

Modify `app/src/components/layout/Sidebar.tsx`. Add the import and update the user footer section:

Add import at top:
```typescript
import { useImpersonation } from "@/contexts/ImpersonationContext";
```

Update the component to use impersonation context. Replace the User Profile Footer section (starting around line 311) with:

```typescript
      {/* User Profile Footer */}
      {user && (
        <UserProfileFooter
          user={user}
          isCollapsed={isCollapsed}
          showUserMenu={showUserMenu}
          setShowUserMenu={setShowUserMenu}
          userMenuRef={userMenuRef}
        />
      )}
```

Then add this new component before the main Sidebar component:

```typescript
function UserProfileFooter({
  user,
  isCollapsed,
  showUserMenu,
  setShowUserMenu,
  userMenuRef,
}: {
  user: NonNullable<SidebarProps["user"]>;
  isCollapsed: boolean;
  showUserMenu: boolean;
  setShowUserMenu: (show: boolean) => void;
  userMenuRef: React.RefObject<HTMLDivElement>;
}) {
  const { isImpersonating, impersonatedUser, stopImpersonation } = useImpersonation();
  const isAdmin = hasAdminAccess(user.position);

  // When impersonating, show the impersonated user's info
  const displayUser = isImpersonating && impersonatedUser
    ? {
        name: impersonatedUser.name || "User",
        position: impersonatedUser.position,
        initials: impersonatedUser.name
          ? impersonatedUser.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
          : "U",
        image: impersonatedUser.image,
      }
    : user;

  const handleStopImpersonation = async () => {
    setShowUserMenu(false);
    await stopImpersonation();
  };

  return (
    <div
      className={`p-3 border-t border-[var(--border-subtle)] ${isCollapsed ? "flex justify-center" : ""} ${
        isImpersonating ? "bg-[rgba(234,179,8,0.1)]" : ""
      }`}
      ref={userMenuRef}
    >
      <div className="relative">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className={`
            flex items-center rounded hover:bg-[var(--bg-hover)] transition-colors cursor-pointer
            ${isCollapsed ? "p-1 justify-center" : "w-full gap-2.5 px-2 py-2"}
            ${isImpersonating ? "ring-2 ring-yellow-500/50 rounded-lg" : ""}
          `}
        >
          {displayUser.image ? (
            /* eslint-disable-next-line @next/next/no-img-element -- base64 data URL doesn't benefit from next/image optimization */
            <img
              src={displayUser.image}
              alt={displayUser.name}
              className={`w-8 h-8 rounded-full object-cover ${isImpersonating ? "ring-2 ring-yellow-500" : ""}`}
            />
          ) : (
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-[var(--bg-deep)] font-heading font-semibold text-xs ${
                isImpersonating
                  ? "bg-yellow-500"
                  : "bg-gradient-to-br from-[var(--accent-pink)] to-[var(--accent-pink-dim)]"
              }`}
            >
              {displayUser.initials}
            </div>
          )}
          {!isCollapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] font-medium text-[var(--text-primary)] truncate leading-tight">
                    {displayUser.name}
                  </p>
                  {isImpersonating && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-500 font-medium">
                      VIEWING AS
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-tight">
                  {formatPosition(displayUser.position)}
                </p>
              </div>
              <svg
                className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${showUserMenu ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>

        {/* Dropdown Menu */}
        {showUserMenu && (
          <div
            className={`
              absolute mb-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg shadow-lg overflow-hidden animate-fade-up
              ${isCollapsed ? "bottom-full left-full ml-1" : "bottom-full left-0 right-0"}
            `}
          >
            {isImpersonating && (
              <button
                onClick={handleStopImpersonation}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-yellow-500 hover:bg-yellow-500/10 transition-colors whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Exit Impersonation
              </button>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors whitespace-nowrap"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign out
            </button>
          </div>
        )}
      </div>
      {/* Version indicator - admin only, hidden when collapsed */}
      {isAdmin && !isCollapsed && (
        <p className="text-[9px] text-[var(--text-muted)] text-center mt-2 opacity-50">
          {process.env.NEXT_PUBLIC_BUILD_ID}
        </p>
      )}
    </div>
  );
}
```

**Step 2: Run lint to verify no errors**

Run: `cd app && npm run lint`

Expected: No errors

**Step 3: Commit**

```bash
git add app/src/components/layout/Sidebar.tsx
git commit -m "feat: show impersonation indicator in sidebar

- Display impersonated user info when impersonating
- Yellow highlight on avatar and background
- 'VIEWING AS' badge next to name
- 'Exit Impersonation' option in dropdown menu

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Add Impersonate Button to Team Page

**Files:**
- Modify: `app/src/app/(authenticated)/team/page.tsx`
- Modify: `app/src/components/employees/EmployeesContent.tsx`

**Step 1: Update Team page to pass isAdmin prop**

Modify `app/src/app/(authenticated)/team/page.tsx`:

```typescript
import { desc } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { EmployeesContent } from "@/components/employees/EmployeesContent";

export default async function EmployeesPage() {
  // Get current user for role-based access
  const user = await getCurrentUser();

  // Fetch employees from database
  const employees = await db.query.users.findMany({
    columns: {
      id: true,
      name: true,
      email: true,
      position: true,
      status: true,
      createdAt: true,
      lastLogin: true,
    },
    orderBy: [desc(users.createdAt)],
  });

  // Convert for client component (timestamps already strings from Drizzle)
  const serializedEmployees = employees.map((employee) => ({
    ...employee,
    createdAt: employee.createdAt,
    lastLogin: employee.lastLogin ?? null,
  }));

  return (
    <EmployeesContent
      initialEmployees={serializedEmployees}
      currentUserId={user.id}
      currentUserPosition={user.position}
      readOnly={!["ADMIN", "PARTNER"].includes(user.position)}
    />
  );
}
```

**Step 2: Update EmployeesContent to show Impersonate button**

Modify `app/src/components/employees/EmployeesContent.tsx`:

Add import at top:
```typescript
import { useImpersonation } from "@/contexts/ImpersonationContext";
```

Update interface:
```typescript
interface EmployeesContentProps {
  initialEmployees: Employee[];
  currentUserId: string;
  currentUserPosition: string;
  readOnly?: boolean;
}
```

Update function signature:
```typescript
export function EmployeesContent({
  initialEmployees,
  currentUserId,
  currentUserPosition,
  readOnly = false,
}: EmployeesContentProps) {
```

Add impersonation hook inside the component:
```typescript
const { startImpersonation, isImpersonating } = useImpersonation();
const canImpersonate = currentUserPosition === "ADMIN" && !isImpersonating;
```

Add handler:
```typescript
const handleImpersonate = useCallback(async (employee: Employee) => {
  try {
    await startImpersonation(employee.id);
  } catch (error) {
    alert(error instanceof Error ? error.message : "Failed to impersonate");
  }
}, [startImpersonation]);
```

Update the actions column in the `columns` useMemo (around line 444), add the Impersonate button before the Edit button:

```typescript
if (!readOnly) {
  baseColumns.push({
    id: "actions",
    header: "Actions",
    accessor: () => null,
    sortable: false,
    align: "right",
    cell: (employee) => {
      const isSelf = employee.id === currentUserId;
      const isInactive = employee.status === "INACTIVE";

      return (
        <div className="flex items-center justify-end gap-1">
          {/* Impersonate button - ADMIN only, not self */}
          {canImpersonate && !isSelf && !isInactive && (
            <button
              onClick={() => handleImpersonate(employee)}
              className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-yellow-400 hover:bg-[var(--bg-surface)] transition-colors"
              title={`View as ${employee.name || employee.email}`}
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </button>
          )}
          {/* Edit button */}
          <button
            onClick={() => openEditModal(employee)}
            className="p-1.5 rounded-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
            title="Edit"
          >
            {/* ... existing edit icon ... */}
          </button>
          {/* ... rest of existing buttons ... */}
        </div>
      );
    },
  });
}
```

Update the useMemo dependencies to include new variables:
```typescript
}, [readOnly, openEditModal, currentUserId, handleDeactivate, handleReactivate, canImpersonate, handleImpersonate]);
```

**Step 3: Run lint to verify no errors**

Run: `cd app && npm run lint`

Expected: No errors

**Step 4: Run all tests**

Run: `cd app && npm run test -- --run`

Expected: All tests pass

**Step 5: Commit**

```bash
git add app/src/app/\(authenticated\)/team/page.tsx app/src/components/employees/EmployeesContent.tsx
git commit -m "feat: add Impersonate button to Team page

- Eye icon button visible only for ADMIN users
- Not shown for self or inactive users
- Calls startImpersonation and redirects to timesheets

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Manual Testing

**Step 1: Start dev server**

Run: `cd app && npm run dev`

**Step 2: Test impersonation flow**

1. Log in as an ADMIN user
2. Navigate to Team page
3. Verify eye icon appears next to non-self, active users
4. Click eye icon on a user
5. Verify redirect to /timesheets
6. Verify sidebar shows yellow indicator with "VIEWING AS" badge
7. Verify sidebar shows impersonated user's name and position
8. Create a time entry - verify it's created as impersonated user
9. Click user avatar in sidebar, verify "Exit Impersonation" option
10. Click "Exit Impersonation"
11. Verify return to admin view
12. Verify time entry was created under impersonated user

**Step 3: Test security**

1. Log in as PARTNER user
2. Navigate to Team page
3. Verify NO eye icon appears (only ADMIN can impersonate)

**Step 4: Test edge cases**

1. Try impersonating inactive user (should be blocked)
2. Close browser while impersonating, reopen - should be back to normal
3. Try direct API call as non-admin - should return 403

---

## Task 8: Final Commit and PR

**Step 1: Run final test suite**

Run: `cd app && npm run test -- --run && npm run lint && npm run build`

Expected: All pass

**Step 2: Commit any remaining changes**

```bash
git status
# If any uncommitted changes:
git add -A
git commit -m "chore: cleanup and final adjustments

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

**Step 3: Push branch**

```bash
git push -u origin impersonate-users
```
