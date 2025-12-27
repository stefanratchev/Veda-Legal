# Test Coverage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Achieve ~80% test coverage with unit and integration tests across lib utilities, API routes, hooks, and UI components.

**Architecture:** Bottom-up approach starting with pure functions (lib), then API routes (mocked DB), hooks, and finally UI components. All database interactions mocked at Drizzle layer.

**Tech Stack:** Vitest, React Testing Library, vi.mock for Drizzle/Auth, existing factories in `src/test/mocks/factories.ts`

---

## Phase 1: Test Infrastructure

### Task 1.1: Add Component Test Utilities

**Files:**
- Modify: `app/src/test/setup.ts`
- Create: `app/src/test/utils.tsx`

**Step 1: Create component test utilities**

Create `app/src/test/utils.tsx`:

```tsx
import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { SidebarNavContext } from "@/contexts/SidebarNavContext";

// Default context values for tests
const defaultSidebarNavContext = {
  isCollapsed: false,
  setIsCollapsed: vi.fn(),
};

interface ProvidersProps {
  children: React.ReactNode;
}

function AllTheProviders({ children }: ProvidersProps) {
  return (
    <SidebarNavContext.Provider value={defaultSidebarNavContext}>
      {children}
    </SidebarNavContext.Provider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

// Re-export everything from testing-library
export * from "@testing-library/react";
export { renderWithProviders as render };
```

**Step 2: Run tests to verify setup works**

Run: `cd app && npm run test -- --run`
Expected: All existing tests still pass

**Step 3: Commit**

```bash
git add app/src/test/utils.tsx
git commit -m "test: add component test utilities with context providers"
```

---

### Task 1.2: Add Auth Mocking Utilities

**Files:**
- Create: `app/src/test/mocks/auth.ts`

**Step 1: Create auth mock utilities**

Create `app/src/test/mocks/auth.ts`:

```typescript
import { vi } from "vitest";
import type { Session } from "next-auth";
import type { MockUser } from "./factories";

export type MockSession = {
  user: {
    name?: string | null;
    email?: string | null;
  };
  expires: string;
};

export function createMockSession(user?: MockUser): MockSession {
  return {
    user: {
      name: user?.name ?? "Test User",
      email: user?.email ?? "test@example.com",
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

// Helper to set up authenticated state for API route tests
export function setupMockAuth(mocks: {
  requireAuth: ReturnType<typeof vi.fn>;
  getUserFromSession?: ReturnType<typeof vi.fn>;
  user: MockUser;
}) {
  mocks.requireAuth.mockResolvedValue({
    session: { user: { name: mocks.user.name, email: mocks.user.email } },
  });

  if (mocks.getUserFromSession) {
    mocks.getUserFromSession.mockResolvedValue({
      id: mocks.user.id,
      email: mocks.user.email,
      name: mocks.user.name,
      position: mocks.user.position,
    });
  }
}

// Helper to set up unauthenticated state
export function setupMockAuthUnauthorized(mocks: {
  requireAuth: ReturnType<typeof vi.fn>;
}) {
  mocks.requireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });
}
```

**Step 2: Run tests to verify no regressions**

Run: `cd app && npm run test -- --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add app/src/test/mocks/auth.ts
git commit -m "test: add auth mocking utilities"
```

---

### Task 1.3: Add Database Mock Template

**Files:**
- Create: `app/src/test/mocks/db.ts`

**Step 1: Create reusable database mock pattern**

Create `app/src/test/mocks/db.ts`:

```typescript
import { vi } from "vitest";

/**
 * Creates a mock database object for Drizzle ORM tests.
 * Use with vi.mock('@/lib/db', () => ({ db: createMockDb() }))
 */
export function createMockDb() {
  return {
    query: {
      users: { findFirst: vi.fn(), findMany: vi.fn() },
      clients: { findFirst: vi.fn(), findMany: vi.fn() },
      timeEntries: { findFirst: vi.fn(), findMany: vi.fn() },
      topics: { findFirst: vi.fn(), findMany: vi.fn() },
      subtopics: { findFirst: vi.fn(), findMany: vi.fn() },
      billing: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

/**
 * Helper to create chainable mock for insert().values().returning()
 */
export function mockInsertReturning<T>(data: T) {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([data]),
    }),
  };
}

/**
 * Helper to create chainable mock for update().set().where().returning()
 */
export function mockUpdateReturning<T>(data: T | null) {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(data ? [data] : []),
      }),
    }),
  };
}

/**
 * Helper to create chainable mock for delete().where()
 */
export function mockDeleteWhere() {
  return {
    where: vi.fn().mockResolvedValue(undefined),
  };
}
```

**Step 2: Run tests to verify no regressions**

Run: `cd app && npm run test -- --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add app/src/test/mocks/db.ts
git commit -m "test: add database mock utilities for Drizzle ORM"
```

---

## Phase 2: Lib Utilities

### Task 2.1: Test user.ts - getInitials

**Files:**
- Test: `app/src/lib/user.test.ts`

**Step 1: Write tests for getInitials**

Create `app/src/lib/user.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getInitials } from "./user";

describe("user", () => {
  describe("getInitials", () => {
    it("returns initials from full name", () => {
      expect(getInitials("John Doe")).toBe("JD");
    });

    it("returns single initial for single name", () => {
      expect(getInitials("John")).toBe("J");
    });

    it("limits to two characters for long names", () => {
      expect(getInitials("John Michael Doe")).toBe("JM");
    });

    it("returns U for null input", () => {
      expect(getInitials(null)).toBe("U");
    });

    it("returns U for undefined input", () => {
      expect(getInitials(undefined)).toBe("U");
    });

    it("returns U for empty string", () => {
      expect(getInitials("")).toBe("U");
    });

    it("returns U for whitespace only", () => {
      expect(getInitials("   ")).toBe("U");
    });

    it("handles names with extra whitespace", () => {
      expect(getInitials("  John   Doe  ")).toBe("JD");
    });

    it("converts to uppercase", () => {
      expect(getInitials("john doe")).toBe("JD");
    });
  });
});
```

**Step 2: Run test to verify it passes**

Run: `cd app && npm run test -- user.test.ts --run`
Expected: All 9 tests pass

**Step 3: Commit**

```bash
git add app/src/lib/user.test.ts
git commit -m "test: add unit tests for getInitials utility"
```

---

### Task 2.2: Test user.ts - getAuthenticatedUser

**Files:**
- Modify: `app/src/lib/user.test.ts`

**Step 1: Add tests for getAuthenticatedUser**

Add to `app/src/lib/user.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getInitials } from "./user";

// Mock db before importing getAuthenticatedUser
const mockDb = vi.hoisted(() => ({
  query: {
    users: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

// Import after mocks
import { getAuthenticatedUser } from "./user";

describe("user", () => {
  describe("getInitials", () => {
    // ... existing tests ...
  });

  describe("getAuthenticatedUser", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns user with formatted data when found", async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: "user-123",
        name: "John Doe",
        position: "ASSOCIATE",
        image: "https://example.com/avatar.jpg",
      });

      const result = await getAuthenticatedUser("john@example.com");

      expect(result).toEqual({
        id: "user-123",
        name: "John Doe",
        position: "ASSOCIATE",
        initials: "JD",
        image: "https://example.com/avatar.jpg",
      });
    });

    it("returns null when user not found", async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);

      const result = await getAuthenticatedUser("unknown@example.com");

      expect(result).toBeNull();
    });

    it("uses 'User' as default name when name is null", async () => {
      mockDb.query.users.findFirst.mockResolvedValue({
        id: "user-123",
        name: null,
        position: "ASSOCIATE",
        image: null,
      });

      const result = await getAuthenticatedUser("john@example.com");

      expect(result?.name).toBe("User");
    });

    it("queries database with correct email", async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);

      await getAuthenticatedUser("specific@email.com");

      expect(mockDb.query.users.findFirst).toHaveBeenCalledTimes(1);
    });
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `cd app && npm run test -- user.test.ts --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add app/src/lib/user.test.ts
git commit -m "test: add unit tests for getAuthenticatedUser"
```

---

### Task 2.3: Test auth-utils.ts - hasAdminAccess and response helpers

**Files:**
- Create: `app/src/lib/auth-utils.test.ts`

**Step 1: Write tests for pure functions**

Create `app/src/lib/auth-utils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { hasAdminAccess, errorResponse, successResponse } from "./auth-utils";

describe("auth-utils", () => {
  describe("hasAdminAccess", () => {
    it("returns true for ADMIN position", () => {
      expect(hasAdminAccess("ADMIN")).toBe(true);
    });

    it("returns true for PARTNER position", () => {
      expect(hasAdminAccess("PARTNER")).toBe(true);
    });

    it("returns false for SENIOR_ASSOCIATE position", () => {
      expect(hasAdminAccess("SENIOR_ASSOCIATE")).toBe(false);
    });

    it("returns false for ASSOCIATE position", () => {
      expect(hasAdminAccess("ASSOCIATE")).toBe(false);
    });

    it("returns false for CONSULTANT position", () => {
      expect(hasAdminAccess("CONSULTANT")).toBe(false);
    });
  });

  describe("errorResponse", () => {
    it("returns NextResponse with error message and status", async () => {
      const response = errorResponse("Not found", 404);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "Not found" });
    });

    it("handles 401 unauthorized", async () => {
      const response = errorResponse("Unauthorized", 401);

      expect(response.status).toBe(401);
    });

    it("handles 500 server error", async () => {
      const response = errorResponse("Internal error", 500);

      expect(response.status).toBe(500);
    });
  });

  describe("successResponse", () => {
    it("returns NextResponse with data", async () => {
      const response = successResponse({ id: "123", name: "Test" });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ id: "123", name: "Test" });
    });

    it("handles array data", async () => {
      const response = successResponse([{ id: "1" }, { id: "2" }]);
      const data = await response.json();

      expect(data).toHaveLength(2);
    });

    it("handles null data", async () => {
      const response = successResponse(null);
      const data = await response.json();

      expect(data).toBeNull();
    });
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `cd app && npm run test -- auth-utils.test.ts --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add app/src/lib/auth-utils.test.ts
git commit -m "test: add unit tests for auth-utils pure functions"
```

---

### Task 2.4: Test auth-utils.ts - requireAuth

**Files:**
- Modify: `app/src/lib/auth-utils.test.ts`

**Step 1: Add tests for requireAuth**

Add to `app/src/lib/auth-utils.test.ts` (at the top, reorganize mocks):

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Hoisted mocks
const { mockGetServerSession, mockGetToken, mockDb } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockGetToken: vi.fn(),
  mockDb: {
    query: {
      users: { findFirst: vi.fn() },
    },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("next-auth/jwt", () => ({
  getToken: mockGetToken,
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { hasAdminAccess, errorResponse, successResponse, requireAuth, requireAdmin } from "./auth-utils";

describe("auth-utils", () => {
  // ... existing pure function tests ...

  describe("requireAuth", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns user when session has email and user exists", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "john@example.com", name: "John" },
      });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: "user-123",
        email: "john@example.com",
        position: "ASSOCIATE",
      });

      const request = new NextRequest("http://localhost:3000/api/test");
      const result = await requireAuth(request);

      expect(result).toEqual({
        session: { user: { name: "John", email: "john@example.com" } },
        user: { id: "user-123", email: "john@example.com", position: "ASSOCIATE" },
      });
    });

    it("falls back to JWT token when session has no email", async () => {
      mockGetServerSession.mockResolvedValue(null);
      mockGetToken.mockResolvedValue({ email: "jwt@example.com" });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: "user-456",
        email: "jwt@example.com",
        position: "PARTNER",
      });

      const request = new NextRequest("http://localhost:3000/api/test");
      const result = await requireAuth(request);

      expect("user" in result && result.user.email).toBe("jwt@example.com");
    });

    it("returns 401 when no session and no token", async () => {
      mockGetServerSession.mockResolvedValue(null);
      mockGetToken.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/test");
      const result = await requireAuth(request);

      expect(result).toEqual({ error: "Unauthorized", status: 401 });
    });

    it("returns 403 when user not in database", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "notfound@example.com" },
      });
      mockDb.query.users.findFirst.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/test");
      const result = await requireAuth(request);

      expect(result).toEqual({
        error: "User not found. Contact administrator.",
        status: 403,
      });
    });
  });

  describe("requireAdmin", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns user when user is ADMIN", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "admin@example.com", name: "Admin" },
      });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: "admin-1",
        email: "admin@example.com",
        position: "ADMIN",
      });

      const request = new NextRequest("http://localhost:3000/api/test");
      const result = await requireAdmin(request);

      expect("user" in result && result.user.position).toBe("ADMIN");
    });

    it("returns user when user is PARTNER", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "partner@example.com", name: "Partner" },
      });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: "partner-1",
        email: "partner@example.com",
        position: "PARTNER",
      });

      const request = new NextRequest("http://localhost:3000/api/test");
      const result = await requireAdmin(request);

      expect("user" in result && result.user.position).toBe("PARTNER");
    });

    it("returns 403 when user is ASSOCIATE", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "assoc@example.com", name: "Associate" },
      });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: "assoc-1",
        email: "assoc@example.com",
        position: "ASSOCIATE",
      });

      const request = new NextRequest("http://localhost:3000/api/test");
      const result = await requireAdmin(request);

      expect(result).toEqual({ error: "Admin access required", status: 403 });
    });

    it("returns 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);
      mockGetToken.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/test");
      const result = await requireAdmin(request);

      expect(result).toEqual({ error: "Unauthorized", status: 401 });
    });
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `cd app && npm run test -- auth-utils.test.ts --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add app/src/lib/auth-utils.test.ts
git commit -m "test: add unit tests for requireAuth and requireAdmin"
```

---

### Task 2.5: Expand date-utils.test.ts coverage

**Files:**
- Modify: `app/src/lib/date-utils.test.ts`

**Step 1: Review current coverage and add missing tests**

Read existing tests, then add edge cases for:
- Year boundaries (Dec 31 → Jan 1)
- Invalid date inputs
- Empty string handling

Add to `app/src/lib/date-utils.test.ts`:

```typescript
// Add these test cases to existing describe blocks

describe("edge cases", () => {
  describe("year boundaries", () => {
    it("handles Dec 31 to Jan 1 transition", () => {
      const dec31 = new Date("2024-12-31");
      const jan1 = new Date("2025-01-01");
      // Test your date functions with these dates
    });
  });

  describe("invalid inputs", () => {
    it("handles Invalid Date object gracefully", () => {
      const invalidDate = new Date("invalid");
      // Expect graceful handling or specific error
    });
  });
});
```

**Step 2: Run coverage to verify improvement**

Run: `cd app && npm run test:coverage -- date-utils.test.ts`
Expected: Coverage improved from 88% toward 95%

**Step 3: Commit**

```bash
git add app/src/lib/date-utils.test.ts
git commit -m "test: expand date-utils coverage with edge cases"
```

---

## Phase 3: API Routes

### Task 3.1: Test clients/route.ts - GET

**Files:**
- Create: `app/src/app/api/clients/route.test.ts`

**Step 1: Write GET endpoint tests**

Create `app/src/app/api/clients/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser, createMockClient } from "@/test/mocks/factories";

const { mockRequireAuth, mockRequireWriteAccess, mockDb } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequireWriteAccess: vi.fn(),
  mockDb: {
    query: {
      clients: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...original,
    requireAuth: mockRequireAuth,
    requireWriteAccess: mockRequireWriteAccess,
  };
});

import { GET, POST, PATCH, DELETE } from "./route";

describe("GET /api/clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({ method: "GET", url: "/api/clients" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("Happy Path", () => {
    it("returns all clients", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const clients = [
        { id: "c1", name: "Client 1", email: "c1@test.com", hourlyRate: "150.00", status: "ACTIVE" },
        { id: "c2", name: "Client 2", email: "c2@test.com", hourlyRate: null, status: "ACTIVE" },
      ];
      mockDb.query.clients.findMany.mockResolvedValue(clients);

      const request = createMockRequest({ method: "GET", url: "/api/clients" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
    });

    it("serializes hourlyRate decimal to number", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.clients.findMany.mockResolvedValue([
        { id: "c1", name: "Client", hourlyRate: "150.50", status: "ACTIVE" },
      ]);

      const request = createMockRequest({ method: "GET", url: "/api/clients" });
      const response = await GET(request);
      const data = await response.json();

      expect(data[0].hourlyRate).toBe(150.5);
    });

    it("handles null hourlyRate", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.clients.findMany.mockResolvedValue([
        { id: "c1", name: "Client", hourlyRate: null, status: "ACTIVE" },
      ]);

      const request = createMockRequest({ method: "GET", url: "/api/clients" });
      const response = await GET(request);
      const data = await response.json();

      expect(data[0].hourlyRate).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });
      mockDb.query.clients.findMany.mockRejectedValue(new Error("DB error"));

      const request = createMockRequest({ method: "GET", url: "/api/clients" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch clients");
    });
  });
});
```

**Step 2: Run tests**

Run: `cd app && npm run test -- clients/route.test.ts --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add app/src/app/api/clients/route.test.ts
git commit -m "test: add GET /api/clients tests"
```

---

### Task 3.2: Test clients/route.ts - POST

**Files:**
- Modify: `app/src/app/api/clients/route.test.ts`

**Step 1: Add POST endpoint tests**

Add to `app/src/app/api/clients/route.test.ts`:

```typescript
describe("POST /api/clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validBody = {
    name: "New Client",
    email: "new@client.com",
    hourlyRate: 150,
    status: "ACTIVE",
  };

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireWriteAccess.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({ method: "POST", url: "/api/clients", body: validBody });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("returns 403 when user lacks write access", async () => {
      mockRequireWriteAccess.mockResolvedValue({ error: "Write access required", status: 403 });

      const request = createMockRequest({ method: "POST", url: "/api/clients", body: validBody });
      const response = await POST(request);

      expect(response.status).toBe(403);
    });
  });

  describe("Validation", () => {
    it("returns 400 when name is missing", async () => {
      mockRequireWriteAccess.mockResolvedValue({ session: {}, user: {} });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: { ...validBody, name: undefined },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name is required");
    });

    it("returns 400 when name is empty string", async () => {
      mockRequireWriteAccess.mockResolvedValue({ session: {}, user: {} });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: { ...validBody, name: "   " },
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("returns 400 for invalid email format", async () => {
      mockRequireWriteAccess.mockResolvedValue({ session: {}, user: {} });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: { ...validBody, email: "not-an-email" },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid email format");
    });

    it("returns 400 for negative hourly rate", async () => {
      mockRequireWriteAccess.mockResolvedValue({ session: {}, user: {} });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: { ...validBody, hourlyRate: -50 },
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("returns 400 for invalid status", async () => {
      mockRequireWriteAccess.mockResolvedValue({ session: {}, user: {} });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: { ...validBody, status: "INVALID" },
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe("Happy Path", () => {
    it("creates client with valid data", async () => {
      mockRequireWriteAccess.mockResolvedValue({ session: {}, user: {} });

      const createdClient = {
        id: "new-client-id",
        name: "New Client",
        email: "new@client.com",
        hourlyRate: "150.00",
        status: "ACTIVE",
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdClient]),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: validBody,
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe("New Client");
    });

    it("allows creating client without email", async () => {
      mockRequireWriteAccess.mockResolvedValue({ session: {}, user: {} });

      const createdClient = { id: "id", name: "Client", email: null, hourlyRate: null, status: "ACTIVE" };
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdClient]),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: { name: "Client" },
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
    });
  });
});
```

**Step 2: Run tests**

Run: `cd app && npm run test -- clients/route.test.ts --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add app/src/app/api/clients/route.test.ts
git commit -m "test: add POST /api/clients tests"
```

---

### Task 3.3: Test clients/route.ts - PATCH and DELETE

**Files:**
- Modify: `app/src/app/api/clients/route.test.ts`

**Step 1: Add PATCH and DELETE tests**

Add to `app/src/app/api/clients/route.test.ts`:

```typescript
describe("PATCH /api/clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireWriteAccess.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/clients",
        body: { id: "c1", name: "Updated" },
      });
      const response = await PATCH(request);

      expect(response.status).toBe(401);
    });
  });

  describe("Validation", () => {
    it("returns 400 when id is missing", async () => {
      mockRequireWriteAccess.mockResolvedValue({ session: {}, user: {} });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/clients",
        body: { name: "Updated" },
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Client ID is required");
    });

    it("returns 400 when name is empty string", async () => {
      mockRequireWriteAccess.mockResolvedValue({ session: {}, user: {} });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/clients",
        body: { id: "c1", name: "" },
      });
      const response = await PATCH(request);

      expect(response.status).toBe(400);
    });
  });

  describe("Happy Path", () => {
    it("updates client and returns updated data", async () => {
      mockRequireWriteAccess.mockResolvedValue({ session: {}, user: {} });

      const updatedClient = {
        id: "c1",
        name: "Updated Name",
        hourlyRate: "200.00",
        status: "ACTIVE",
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedClient]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/clients",
        body: { id: "c1", name: "Updated Name" },
      });
      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe("Updated Name");
    });

    it("returns 404 when client not found", async () => {
      mockRequireWriteAccess.mockResolvedValue({ session: {}, user: {} });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/clients",
        body: { id: "nonexistent", name: "Test" },
      });
      const response = await PATCH(request);

      expect(response.status).toBe(404);
    });
  });
});

describe("DELETE /api/clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireWriteAccess.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/clients?id=c1",
      });
      const response = await DELETE(request);

      expect(response.status).toBe(401);
    });
  });

  describe("Validation", () => {
    it("returns 400 when id param is missing", async () => {
      mockRequireWriteAccess.mockResolvedValue({ session: {}, user: {} });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/clients",
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Client ID is required");
    });
  });

  describe("Business Rules", () => {
    it("returns 404 when client not found", async () => {
      mockRequireWriteAccess.mockResolvedValue({ session: {}, user: {} });
      mockDb.query.clients.findFirst.mockResolvedValue(null);

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/clients?id=nonexistent",
      });
      const response = await DELETE(request);

      expect(response.status).toBe(404);
    });

    it("returns 400 when client has time entries", async () => {
      mockRequireWriteAccess.mockResolvedValue({ session: {}, user: {} });
      mockDb.query.clients.findFirst.mockResolvedValue({
        id: "c1",
        timeEntries: [{ id: "entry-1" }],
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/clients?id=c1",
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot delete client with existing time entries");
    });
  });

  describe("Happy Path", () => {
    it("deletes client with no time entries", async () => {
      mockRequireWriteAccess.mockResolvedValue({ session: {}, user: {} });
      mockDb.query.clients.findFirst.mockResolvedValue({
        id: "c1",
        timeEntries: [],
      });
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/clients?id=c1",
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
```

**Step 2: Run tests**

Run: `cd app && npm run test -- clients/route.test.ts --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add app/src/app/api/clients/route.test.ts
git commit -m "test: add PATCH and DELETE /api/clients tests"
```

---

### Task 3.4: Test employees/route.ts

**Files:**
- Create: `app/src/app/api/employees/route.test.ts`

Follow the same pattern as clients/route.test.ts for:
- GET (list employees)
- POST (create employee - if supported)
- Authentication and validation tests

**Step 1: Read the route file first**

Read `app/src/app/api/employees/route.ts` to understand the API structure.

**Step 2: Write tests following the clients pattern**

**Step 3: Run and commit**

---

### Task 3.5: Test topics/route.ts

**Files:**
- Create: `app/src/app/api/topics/route.test.ts`

Test:
- GET /api/topics - list topics with subtopics
- POST /api/topics - create topic

---

### Task 3.6: Test topics/[id]/route.ts

**Files:**
- Create: `app/src/app/api/topics/[id]/route.test.ts`

Test:
- PATCH /api/topics/[id] - update topic
- DELETE /api/topics/[id] - delete topic (cascade behavior)

---

### Task 3.7: Test subtopics routes

**Files:**
- Create: `app/src/app/api/subtopics/[id]/route.test.ts`

Test:
- PATCH - update subtopic
- DELETE - delete subtopic (prevent if used)

---

### Task 3.8: Test reports/route.ts

**Files:**
- Create: `app/src/app/api/reports/route.test.ts`

Test:
- GET with date range parameters
- Aggregation logic
- Grouping by client/employee

---

## Phase 4: Hooks

### Task 4.1: Test useClickOutside hook

**Files:**
- Create: `app/src/hooks/useClickOutside.test.ts`

**Step 1: Write hook tests**

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import { useClickOutside } from "./useClickOutside";

describe("useClickOutside", () => {
  it("calls handler when clicking outside the referenced element", () => {
    const handler = vi.fn();
    const element = document.createElement("div");
    document.body.appendChild(element);

    const ref = { current: element };
    renderHook(() => useClickOutside(ref, handler));

    fireEvent.mouseDown(document.body);

    expect(handler).toHaveBeenCalledTimes(1);

    document.body.removeChild(element);
  });

  it("does not call handler when clicking inside the referenced element", () => {
    const handler = vi.fn();
    const element = document.createElement("div");
    document.body.appendChild(element);

    const ref = { current: element };
    renderHook(() => useClickOutside(ref, handler));

    fireEvent.mouseDown(element);

    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(element);
  });

  it("does not call handler when ref is null", () => {
    const handler = vi.fn();
    const ref = { current: null };

    renderHook(() => useClickOutside(ref, handler));

    fireEvent.mouseDown(document.body);

    expect(handler).not.toHaveBeenCalled();
  });

  it("removes event listener on unmount", () => {
    const handler = vi.fn();
    const element = document.createElement("div");
    document.body.appendChild(element);

    const ref = { current: element };
    const { unmount } = renderHook(() => useClickOutside(ref, handler));

    unmount();

    fireEvent.mouseDown(document.body);

    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(element);
  });
});
```

**Step 2: Run tests**

Run: `cd app && npm run test -- useClickOutside.test.ts --run`

**Step 3: Commit**

```bash
git add app/src/hooks/useClickOutside.test.ts
git commit -m "test: add useClickOutside hook tests"
```

---

## Phase 5: UI Components

### Task 5.1: Test ConfirmModal component

**Files:**
- Create: `app/src/components/ui/ConfirmModal.test.tsx`

**Step 1: Write tests**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmModal } from "./ConfirmModal";

describe("ConfirmModal", () => {
  const defaultProps = {
    isOpen: true,
    title: "Confirm Action",
    message: "Are you sure?",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders when isOpen is true", () => {
    render(<ConfirmModal {...defaultProps} />);

    expect(screen.getByText("Confirm Action")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    render(<ConfirmModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByText("Confirm Action")).not.toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /confirm|yes|delete/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: /cancel|no/i }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("displays custom confirm text", () => {
    render(<ConfirmModal {...defaultProps} confirmText="Delete" />);

    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});
```

**Step 2: Run and commit**

---

### Task 5.2: Test ClientSelect component

**Files:**
- Create: `app/src/components/ui/ClientSelect.test.tsx`

Test:
- Renders with placeholder
- Opens dropdown on click
- Filters clients as user types
- Selects client and closes
- Shows empty state

---

### Task 5.3: Test DurationPicker component

**Files:**
- Create: `app/src/components/ui/DurationPicker.test.tsx`

Test:
- Renders with initial value
- Hour/minute input changes
- Validation (max hours, etc.)
- Calls onChange with correct value

---

### Task 5.4: Test TopicCascadeSelect component

**Files:**
- Create: `app/src/components/ui/TopicCascadeSelect.test.tsx`

Test:
- Two-level selection flow
- Topic selection shows subtopics
- isPrefix handling in selection
- Keyboard navigation

---

### Task 5.5: Test DataTable component

**Files:**
- Create: `app/src/components/ui/DataTable.test.tsx`

Test:
- Renders rows from data
- Sorting when column clicked
- Pagination controls
- Empty state display

---

### Task 5.6: Test EntryForm component

**Files:**
- Create: `app/src/components/timesheets/EntryForm.test.tsx`

Test:
- Renders all form fields
- Validation errors display
- Submit calls onSubmit with data
- Edit mode populates existing values

---

### Task 5.7: Test WeekStrip component

**Files:**
- Create: `app/src/components/timesheets/WeekStrip.test.tsx`

Test:
- Renders week days
- Highlights current day
- Navigation arrows work
- Calls onDateSelect

---

### Task 5.8-5.15: Remaining component tests

Continue with remaining components following the same pattern:
- EntriesList
- EntryCard
- EntryRow
- ClientModal
- EmployeeModal
- TopicModal
- SubtopicModal
- TopicsContent

---

## Final Tasks

### Task F.1: Run full coverage report

**Step 1: Generate coverage report**

Run: `cd app && npm run test:coverage`

**Step 2: Review uncovered lines**

Identify any remaining gaps and add targeted tests.

**Step 3: Final commit**

```bash
git add -A
git commit -m "test: complete test coverage implementation"
```

---

### Task F.2: Merge to main

**Step 1: Push branch**

```bash
git push -u origin feature/test-coverage
```

**Step 2: Create PR or merge**

Use `superpowers:finishing-a-development-branch` skill.

---

## Summary

| Phase | Tasks | Estimated Test Cases |
|-------|-------|---------------------|
| 1. Infrastructure | 3 | — |
| 2. Lib Utilities | 5 | ~40 |
| 3. API Routes | 8 | ~120 |
| 4. Hooks | 1 | ~5 |
| 5. UI Components | 15 | ~200 |
| Final | 2 | — |
| **Total** | **34** | **~365** |
