# API Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add comprehensive unit and integration tests for all API routes, starting with timesheets as the template.

**Architecture:** Mock-based testing using Vitest. Drizzle queries and auth functions are mocked to isolate route logic. Test data factories provide reusable, realistic test data. Tests are colocated with source files.

**Tech Stack:** Vitest, React Testing Library (already configured), vi.mock for mocking

---

## Task 1: Create Mock Request Helper

**Files:**
- Create: `src/test/helpers/api.ts`

**Step 1: Create the helper file**

```typescript
import { NextRequest } from "next/server";

interface MockRequestOptions {
  method: "GET" | "POST" | "DELETE" | "PUT" | "PATCH";
  url: string;
  body?: object;
  headers?: Record<string, string>;
}

export function createMockRequest(options: MockRequestOptions): NextRequest {
  const { method, url, body, headers = {} } = options;

  const fullUrl = url.startsWith("http") ? url : `http://localhost:3000${url}`;

  const requestInit: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body && method !== "GET") {
    requestInit.body = JSON.stringify(body);
  }

  return new NextRequest(fullUrl, requestInit);
}
```

**Step 2: Verify file created**

Run: `ls -la src/test/helpers/`
Expected: `api.ts` exists

**Step 3: Commit**

```bash
git add src/test/helpers/api.ts
git commit -m "test: add mock request helper for API route testing"
```

---

## Task 2: Create Test Data Factories

**Files:**
- Create: `src/test/mocks/factories.ts`

**Step 1: Create the factories file**

```typescript
import { createId } from "@paralleldrive/cuid2";

export interface MockUser {
  id: string;
  email: string;
  name: string;
  position: "ADMIN" | "PARTNER" | "SENIOR_ASSOCIATE" | "ASSOCIATE" | "CONSULTANT";
  status: "ACTIVE" | "INACTIVE";
}

export interface MockClient {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface MockTimeEntry {
  id: string;
  userId: string;
  clientId: string;
  date: string;
  hours: string;
  description: string;
  subtopicId: string | null;
  topicName: string;
  subtopicName: string;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string } | null;
}

export interface MockSubtopic {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  topic: {
    name: string;
    status: "ACTIVE" | "INACTIVE";
  };
}

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: createId(),
    email: "test@example.com",
    name: "Test User",
    position: "ASSOCIATE",
    status: "ACTIVE",
    ...overrides,
  };
}

export function createMockClient(overrides: Partial<MockClient> = {}): MockClient {
  return {
    id: createId(),
    name: "Test Client Ltd",
    status: "ACTIVE",
    ...overrides,
  };
}

export function createMockTimeEntry(overrides: Partial<MockTimeEntry> = {}): MockTimeEntry {
  const clientId = overrides.clientId || createId();
  return {
    id: createId(),
    userId: createId(),
    clientId,
    date: "2024-12-20",
    hours: "2.5",
    description: "Test time entry description",
    subtopicId: createId(),
    topicName: "General Advisory",
    subtopicName: "Client correspondence:",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    client: { id: clientId, name: "Test Client Ltd" },
    ...overrides,
  };
}

export function createMockSubtopic(overrides: Partial<MockSubtopic> = {}): MockSubtopic {
  return {
    id: createId(),
    name: "Client correspondence:",
    status: "ACTIVE",
    topic: {
      name: "General Advisory",
      status: "ACTIVE",
    },
    ...overrides,
  };
}
```

**Step 2: Verify file created**

Run: `ls -la src/test/mocks/`
Expected: `factories.ts` exists

**Step 3: Commit**

```bash
git add src/test/mocks/factories.ts
git commit -m "test: add test data factories for API testing"
```

---

## Task 3: Create Auth Mock Utilities

**Files:**
- Create: `src/test/mocks/auth.ts`

**Step 1: Create the auth mock file**

```typescript
import { vi } from "vitest";
import type { MockUser } from "./factories";

// Store mock state
let mockAuthState: {
  authenticated: boolean;
  user: MockUser | null;
  userInDb: boolean;
} = {
  authenticated: false,
  user: null,
  userInDb: true,
};

// Reset function for beforeEach
export function resetAuthMocks() {
  mockAuthState = {
    authenticated: false,
    user: null,
    userInDb: true,
  };
}

// Configure authenticated state
export function mockAuthenticated(user: MockUser) {
  mockAuthState = {
    authenticated: true,
    user,
    userInDb: true,
  };
}

// Configure unauthenticated state
export function mockUnauthenticated() {
  mockAuthState = {
    authenticated: false,
    user: null,
    userInDb: true,
  };
}

// Configure auth passes but user not in database
export function mockUserNotInDb(user: MockUser) {
  mockAuthState = {
    authenticated: true,
    user,
    userInDb: false,
  };
}

// Mock implementation for requireAuth
export function createRequireAuthMock() {
  return vi.fn().mockImplementation(async () => {
    if (!mockAuthState.authenticated || !mockAuthState.user) {
      return { error: "Unauthorized", status: 401 };
    }
    return {
      session: {
        user: {
          name: mockAuthState.user.name,
          email: mockAuthState.user.email,
        },
      },
    };
  });
}

// Mock implementation for getUserFromSession
export function createGetUserFromSessionMock() {
  return vi.fn().mockImplementation(async (email: string | null | undefined) => {
    if (!email || !mockAuthState.userInDb || !mockAuthState.user) {
      return null;
    }
    return {
      id: mockAuthState.user.id,
      email: mockAuthState.user.email,
      name: mockAuthState.user.name,
      position: mockAuthState.user.position,
    };
  });
}

// Mock implementation for canViewTeamTimesheets
export function createCanViewTeamTimesheetsMock() {
  return vi.fn().mockImplementation((position: string) => {
    return ["ADMIN", "PARTNER"].includes(position);
  });
}
```

**Step 2: Verify file created**

Run: `ls -la src/test/mocks/`
Expected: `auth.ts` exists

**Step 3: Commit**

```bash
git add src/test/mocks/auth.ts
git commit -m "test: add auth mock utilities for API testing"
```

---

## Task 4: Create Database Mock Utilities

**Files:**
- Create: `src/test/mocks/db.ts`

**Step 1: Create the database mock file**

```typescript
import { vi } from "vitest";

// Store mock query results
let mockQueryResults: {
  timeEntries: {
    findMany: unknown[];
    findFirst: unknown | undefined;
  };
  users: {
    findFirst: unknown | undefined;
  };
  clients: {
    findFirst: unknown | undefined;
  };
  subtopics: {
    findFirst: unknown | undefined;
  };
} = {
  timeEntries: { findMany: [], findFirst: undefined },
  users: { findFirst: undefined },
  clients: { findFirst: undefined },
  subtopics: { findFirst: undefined },
};

let mockInsertResult: unknown = undefined;
let mockSelectResult: unknown[] = [];

// Reset function for beforeEach
export function resetDbMocks() {
  mockQueryResults = {
    timeEntries: { findMany: [], findFirst: undefined },
    users: { findFirst: undefined },
    clients: { findFirst: undefined },
    subtopics: { findFirst: undefined },
  };
  mockInsertResult = undefined;
  mockSelectResult = [];
}

// Configure mock results
export const mockDbQuery = {
  timeEntries: {
    findMany: (entries: unknown[]) => {
      mockQueryResults.timeEntries.findMany = entries;
    },
    findFirst: (entry: unknown | undefined) => {
      mockQueryResults.timeEntries.findFirst = entry;
    },
  },
  users: {
    findFirst: (user: unknown | undefined) => {
      mockQueryResults.users.findFirst = user;
    },
  },
  clients: {
    findFirst: (client: unknown | undefined) => {
      mockQueryResults.clients.findFirst = client;
    },
  },
  subtopics: {
    findFirst: (subtopic: unknown | undefined) => {
      mockQueryResults.subtopics.findFirst = subtopic;
    },
  },
};

export const mockDbInsert = {
  timeEntries: {
    returning: (entry: unknown) => {
      mockInsertResult = entry;
    },
  },
};

export const mockDbSelect = {
  result: (rows: unknown[]) => {
    mockSelectResult = rows;
  },
};

// Create the mock db object
export function createDbMock() {
  return {
    query: {
      timeEntries: {
        findMany: vi.fn().mockImplementation(async () => mockQueryResults.timeEntries.findMany),
        findFirst: vi.fn().mockImplementation(async () => mockQueryResults.timeEntries.findFirst),
      },
      users: {
        findFirst: vi.fn().mockImplementation(async () => mockQueryResults.users.findFirst),
      },
      clients: {
        findFirst: vi.fn().mockImplementation(async () => mockQueryResults.clients.findFirst),
      },
      subtopics: {
        findFirst: vi.fn().mockImplementation(async () => mockQueryResults.subtopics.findFirst),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(async () => [mockInsertResult]),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation(async () => undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockReturnValue({
              having: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockImplementation(async () => mockSelectResult),
              }),
            }),
          }),
        }),
      }),
    }),
    selectDistinct: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(async () => mockQueryResults.timeEntries.findMany),
      }),
    }),
  };
}
```

**Step 2: Verify file created**

Run: `ls -la src/test/mocks/`
Expected: `db.ts` exists

**Step 3: Commit**

```bash
git add src/test/mocks/db.ts
git commit -m "test: add database mock utilities for API testing"
```

---

## Task 5: Create Mock Index File

**Files:**
- Create: `src/test/mocks/index.ts`

**Step 1: Create the index file to re-export all mocks**

```typescript
export * from "./factories";
export * from "./auth";
export * from "./db";
```

**Step 2: Create helpers index file**

Create: `src/test/helpers/index.ts`

```typescript
export * from "./api";
```

**Step 3: Commit**

```bash
git add src/test/mocks/index.ts src/test/helpers/index.ts
git commit -m "test: add index files for test mocks and helpers"
```

---

## Task 6: Write GET /api/timesheets Auth Tests

**Files:**
- Create: `src/app/api/timesheets/route.test.ts`

**Step 1: Write the initial test file with auth tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { createMockRequest } from "@/test/helpers/api";
import {
  createMockUser,
  createMockTimeEntry,
  resetAuthMocks,
  resetDbMocks,
  mockAuthenticated,
  mockUnauthenticated,
  mockUserNotInDb,
  createRequireAuthMock,
  createGetUserFromSessionMock,
  createCanViewTeamTimesheetsMock,
  createDbMock,
  mockDbQuery,
} from "@/test/mocks";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: createDbMock(),
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...original,
    requireAuth: createRequireAuthMock(),
    getUserFromSession: createGetUserFromSessionMock(),
    canViewTeamTimesheets: createCanViewTeamTimesheetsMock(),
  };
});

describe("GET /api/timesheets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthMocks();
    resetDbMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockUnauthenticated();

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets?date=2024-12-20",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 404 when user not in database", async () => {
      const user = createMockUser();
      mockUserNotInDb(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets?date=2024-12-20",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });
});
```

**Step 2: Run tests to verify they work**

Run: `npm test -- --run src/app/api/timesheets/route.test.ts`
Expected: Tests run (may fail due to mock setup - this is expected, we'll fix in next steps)

**Step 3: Commit**

```bash
git add src/app/api/timesheets/route.test.ts
git commit -m "test: add initial auth tests for GET /api/timesheets"
```

---

## Task 7: Fix Mocking Setup and Add Validation Tests

**Files:**
- Modify: `src/app/api/timesheets/route.test.ts`

**Step 1: Update the test file with proper mock setup**

The mocks need to be set up before the route module is imported. Update the file:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import {
  createMockUser,
  createMockTimeEntry,
  MockUser,
} from "@/test/mocks/factories";

// Set up mocks before importing the route
const mockRequireAuth = vi.fn();
const mockGetUserFromSession = vi.fn();
const mockCanViewTeamTimesheets = vi.fn();
const mockDb = {
  query: {
    timeEntries: {
      findMany: vi.fn(),
    },
  },
  select: vi.fn(),
};

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...original,
    requireAuth: mockRequireAuth,
    getUserFromSession: mockGetUserFromSession,
    canViewTeamTimesheets: mockCanViewTeamTimesheets,
  };
});

// Import route after mocks are set up
import { GET } from "./route";

// Helper to set up authenticated user
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
  mockCanViewTeamTimesheets.mockImplementation((position: string) =>
    ["ADMIN", "PARTNER"].includes(position)
  );
}

describe("GET /api/timesheets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets?date=2024-12-20",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 404 when user not in database", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });
      mockGetUserFromSession.mockResolvedValue(null);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets?date=2024-12-20",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });

  describe("Validation", () => {
    it("returns 400 when date param is missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Date parameter is required");
    });

    it("returns 400 when date format is invalid", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets?date=not-a-date",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid date format");
    });
  });
});
```

**Step 2: Run tests**

Run: `npm test -- --run src/app/api/timesheets/route.test.ts`
Expected: 4 tests pass

**Step 3: Commit**

```bash
git add src/app/api/timesheets/route.test.ts
git commit -m "test: fix mock setup and add validation tests for GET /api/timesheets"
```

---

## Task 8: Add Happy Path Tests for GET /api/timesheets

**Files:**
- Modify: `src/app/api/timesheets/route.test.ts`

**Step 1: Add happy path test cases**

Add these tests inside the existing describe block:

```typescript
  describe("Happy Path", () => {
    it("returns entries for given date", async () => {
      const user = createMockUser({ position: "ASSOCIATE" });
      const entries = [
        createMockTimeEntry({ userId: user.id, hours: "2.5" }),
        createMockTimeEntry({ userId: user.id, hours: "1.0" }),
      ];

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets?date=2024-12-20",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
    });

    it("serializes decimal hours to numbers", async () => {
      const user = createMockUser({ position: "ASSOCIATE" });
      const entries = [createMockTimeEntry({ userId: user.id, hours: "2.5" })];

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets?date=2024-12-20",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(typeof data[0].hours).toBe("number");
      expect(data[0].hours).toBe(2.5);
    });

    it("returns entries with client details populated", async () => {
      const user = createMockUser({ position: "ASSOCIATE" });
      const entries = [
        createMockTimeEntry({
          userId: user.id,
          client: { id: "client-1", name: "Acme Corp" },
        }),
      ];

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets?date=2024-12-20",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data[0].client).toEqual({ id: "client-1", name: "Acme Corp" });
    });
  });
```

**Step 2: Run tests**

Run: `npm test -- --run src/app/api/timesheets/route.test.ts`
Expected: 7 tests pass

**Step 3: Commit**

```bash
git add src/app/api/timesheets/route.test.ts
git commit -m "test: add happy path tests for GET /api/timesheets"
```

---

## Task 9: Add Role-Based Behavior Tests for GET /api/timesheets

**Files:**
- Modify: `src/app/api/timesheets/route.test.ts`

**Step 1: Add role-based tests**

Add these tests inside the existing describe block:

```typescript
  describe("Role-Based Behavior", () => {
    it("returns entries array directly for regular users", async () => {
      const user = createMockUser({ position: "ASSOCIATE" });
      const entries = [createMockTimeEntry({ userId: user.id })];

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets?date=2024-12-20",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(Array.isArray(data)).toBe(true);
      expect(data).not.toHaveProperty("teamSummaries");
    });

    it("returns entries and teamSummaries for ADMIN", async () => {
      const user = createMockUser({ position: "ADMIN" });
      const entries = [createMockTimeEntry({ userId: user.id })];
      const teamSummaries = [
        { userId: "other-user", userName: "Other User", position: "ASSOCIATE", totalHours: "4.0" },
      ];

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                having: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue(teamSummaries),
                }),
              }),
            }),
          }),
        }),
      });

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets?date=2024-12-20",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty("entries");
      expect(data).toHaveProperty("teamSummaries");
      expect(Array.isArray(data.entries)).toBe(true);
      expect(Array.isArray(data.teamSummaries)).toBe(true);
    });

    it("returns entries and teamSummaries for PARTNER", async () => {
      const user = createMockUser({ position: "PARTNER" });
      const entries = [createMockTimeEntry({ userId: user.id })];

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                having: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      });

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets?date=2024-12-20",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data).toHaveProperty("entries");
      expect(data).toHaveProperty("teamSummaries");
    });
  });
```

**Step 2: Run tests**

Run: `npm test -- --run src/app/api/timesheets/route.test.ts`
Expected: 10 tests pass

**Step 3: Commit**

```bash
git add src/app/api/timesheets/route.test.ts
git commit -m "test: add role-based behavior tests for GET /api/timesheets"
```

---

## Task 10: Add POST /api/timesheets Auth and Validation Tests

**Files:**
- Modify: `src/app/api/timesheets/route.test.ts`

**Step 1: Import POST and add mock for db.insert, db.query.clients, db.query.subtopics**

Update the mockDb object at the top of the file:

```typescript
const mockDb = {
  query: {
    timeEntries: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    clients: {
      findFirst: vi.fn(),
    },
    subtopics: {
      findFirst: vi.fn(),
    },
  },
  select: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
};
```

Update the import to include POST:

```typescript
import { GET, POST } from "./route";
```

**Step 2: Add POST tests**

```typescript
describe("POST /api/timesheets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { date: "2024-12-20", clientId: "c1", subtopicId: "s1", hours: 2 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 404 when user not in database", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });
      mockGetUserFromSession.mockResolvedValue(null);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { date: "2024-12-20", clientId: "c1", subtopicId: "s1", hours: 2 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });

  describe("Validation", () => {
    it("returns 400 for invalid JSON body", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      // Create request with invalid JSON
      const request = new NextRequest("http://localhost:3000/api/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON");
    });

    it("returns 400 when date is missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { clientId: "c1", subtopicId: "s1", hours: 2 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Date is required");
    });

    it("returns 400 when date is invalid format", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { date: "not-a-date", clientId: "c1", subtopicId: "s1", hours: 2 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid date format");
    });

    it("returns 400 when date is in future", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: {
          date: futureDate.toISOString().split("T")[0],
          clientId: "c1",
          subtopicId: "s1",
          hours: 2,
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot log time for future dates");
    });

    it("returns 400 when clientId is missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { date: "2024-12-20", subtopicId: "s1", hours: 2 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Client is required");
    });

    it("returns 404 when client not found", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue(null);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { date: "2024-12-20", clientId: "c1", subtopicId: "s1", hours: 2 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Client not found");
    });

    it("returns 400 when client is inactive", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue({ id: "c1", status: "INACTIVE" });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { date: "2024-12-20", clientId: "c1", subtopicId: "s1", hours: 2 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot log time for inactive clients");
    });

    it("returns 400 when subtopicId is missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue({ id: "c1", status: "ACTIVE" });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { date: "2024-12-20", clientId: "c1", hours: 2 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Subtopic is required");
    });

    it("returns 404 when subtopic not found", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue({ id: "c1", status: "ACTIVE" });
      mockDb.query.subtopics.findFirst.mockResolvedValue(null);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { date: "2024-12-20", clientId: "c1", subtopicId: "s1", hours: 2 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Subtopic not found");
    });

    it("returns 400 when subtopic is inactive", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue({ id: "c1", status: "ACTIVE" });
      mockDb.query.subtopics.findFirst.mockResolvedValue({
        id: "s1",
        name: "Test",
        status: "INACTIVE",
        topic: { name: "Topic", status: "ACTIVE" },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { date: "2024-12-20", clientId: "c1", subtopicId: "s1", hours: 2 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot log time with inactive subtopic");
    });

    it("returns 400 when topic is inactive", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue({ id: "c1", status: "ACTIVE" });
      mockDb.query.subtopics.findFirst.mockResolvedValue({
        id: "s1",
        name: "Test",
        status: "ACTIVE",
        topic: { name: "Topic", status: "INACTIVE" },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { date: "2024-12-20", clientId: "c1", subtopicId: "s1", hours: 2 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot log time with inactive topic");
    });

    it("returns 400 when hours is missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue({ id: "c1", status: "ACTIVE" });
      mockDb.query.subtopics.findFirst.mockResolvedValue({
        id: "s1",
        name: "Test",
        status: "ACTIVE",
        topic: { name: "Topic", status: "ACTIVE" },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { date: "2024-12-20", clientId: "c1", subtopicId: "s1" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Hours is required");
    });

    it("returns 400 when hours is zero", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue({ id: "c1", status: "ACTIVE" });
      mockDb.query.subtopics.findFirst.mockResolvedValue({
        id: "s1",
        name: "Test",
        status: "ACTIVE",
        topic: { name: "Topic", status: "ACTIVE" },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { date: "2024-12-20", clientId: "c1", subtopicId: "s1", hours: 0 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Hours must be between");
    });

    it("returns 400 when hours exceeds maximum", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue({ id: "c1", status: "ACTIVE" });
      mockDb.query.subtopics.findFirst.mockResolvedValue({
        id: "s1",
        name: "Test",
        status: "ACTIVE",
        topic: { name: "Topic", status: "ACTIVE" },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { date: "2024-12-20", clientId: "c1", subtopicId: "s1", hours: 13 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Hours must be between");
    });
  });
});
```

**Step 3: Add NextRequest import at the top**

```typescript
import { NextRequest } from "next/server";
```

**Step 4: Run tests**

Run: `npm test -- --run src/app/api/timesheets/route.test.ts`
Expected: 24+ tests (some may fail - we'll fix in next task)

**Step 5: Commit**

```bash
git add src/app/api/timesheets/route.test.ts
git commit -m "test: add POST /api/timesheets auth and validation tests"
```

---

## Task 11: Add POST /api/timesheets Happy Path Tests

**Files:**
- Modify: `src/app/api/timesheets/route.test.ts`

**Step 1: Add happy path tests for POST**

Add inside the POST describe block:

```typescript
  describe("Happy Path", () => {
    it("creates entry with valid data", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      mockDb.query.clients.findFirst.mockResolvedValue({ id: "c1", status: "ACTIVE" });
      mockDb.query.subtopics.findFirst.mockResolvedValue({
        id: "s1",
        name: "Client correspondence:",
        status: "ACTIVE",
        topic: { name: "General Advisory", status: "ACTIVE" },
      });

      const createdEntry = {
        id: "new-entry-id",
        date: "2024-12-20",
        hours: "2.5",
        description: "Test description",
        clientId: "c1",
        subtopicId: "s1",
        topicName: "General Advisory",
        subtopicName: "Client correspondence:",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdEntry]),
        }),
      });

      // Mock the client fetch after insert
      mockDb.query.clients.findFirst
        .mockResolvedValueOnce({ id: "c1", status: "ACTIVE" }) // First call for validation
        .mockResolvedValueOnce({ id: "c1", name: "Test Client" }); // Second call for response

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: {
          date: "2024-12-20",
          clientId: "c1",
          subtopicId: "s1",
          hours: 2.5,
          description: "Test description",
        },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("new-entry-id");
      expect(data.hours).toBe(2.5);
    });

    it("stores denormalized topic and subtopic names", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      mockDb.query.clients.findFirst.mockResolvedValue({ id: "c1", status: "ACTIVE" });
      mockDb.query.subtopics.findFirst.mockResolvedValue({
        id: "s1",
        name: "Drafting documents:",
        status: "ACTIVE",
        topic: { name: "M&A Advisory", status: "ACTIVE" },
      });

      const createdEntry = {
        id: "entry-id",
        date: "2024-12-20",
        hours: "1.0",
        description: "",
        clientId: "c1",
        subtopicId: "s1",
        topicName: "M&A Advisory",
        subtopicName: "Drafting documents:",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdEntry]),
        }),
      });

      mockDb.query.clients.findFirst
        .mockResolvedValueOnce({ id: "c1", status: "ACTIVE" })
        .mockResolvedValueOnce({ id: "c1", name: "Client" });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { date: "2024-12-20", clientId: "c1", subtopicId: "s1", hours: 1 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.topicName).toBe("M&A Advisory");
      expect(data.subtopicName).toBe("Drafting documents:");
    });
  });
```

**Step 2: Run tests**

Run: `npm test -- --run src/app/api/timesheets/route.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/app/api/timesheets/route.test.ts
git commit -m "test: add POST /api/timesheets happy path tests"
```

---

## Task 12: Add DELETE /api/timesheets Tests

**Files:**
- Modify: `src/app/api/timesheets/route.test.ts`

**Step 1: Import DELETE and add tests**

Update import:
```typescript
import { GET, POST, DELETE } from "./route";
```

Add DELETE tests:

```typescript
describe("DELETE /api/timesheets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/timesheets?id=entry-1",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 404 when user not in database", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });
      mockGetUserFromSession.mockResolvedValue(null);

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/timesheets?id=entry-1",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });

  describe("Validation", () => {
    it("returns 400 when id param is missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/timesheets",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Entry ID is required");
    });
  });

  describe("Authorization", () => {
    it("returns 404 when entry not found", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue(null);

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/timesheets?id=nonexistent",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Entry not found");
    });

    it("returns 403 when deleting another user's entry", async () => {
      const user = createMockUser({ id: "user-1" });
      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue({ userId: "other-user" });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/timesheets?id=entry-1",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("You can only delete your own entries");
    });
  });

  describe("Happy Path", () => {
    it("deletes entry and returns success", async () => {
      const user = createMockUser({ id: "user-1" });
      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue({ userId: "user-1" });
      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/timesheets?id=entry-1",
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

Run: `npm test -- --run src/app/api/timesheets/route.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/app/api/timesheets/route.test.ts
git commit -m "test: add DELETE /api/timesheets tests"
```

---

## Task 13: Add /api/timesheets/dates Tests

**Files:**
- Create: `src/app/api/timesheets/dates/route.test.ts`

**Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser, MockUser } from "@/test/mocks/factories";

const mockRequireAuth = vi.fn();
const mockGetUserFromSession = vi.fn();
const mockDb = {
  selectDistinct: vi.fn(),
};

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
}

describe("GET /api/timesheets/dates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/dates?year=2024&month=12",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 404 when user not in database", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });
      mockGetUserFromSession.mockResolvedValue(null);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/dates?year=2024&month=12",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });

  describe("Validation", () => {
    it("returns 400 when year param is missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/dates?month=12",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Year and month parameters are required");
    });

    it("returns 400 when month param is missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/dates?year=2024",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Year and month parameters are required");
    });

    it("returns 400 when year is not a number", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/dates?year=abc&month=12",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid year or month");
    });

    it("returns 400 when month is not a number", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/dates?year=2024&month=abc",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid year or month");
    });

    it("returns 400 when month is 0", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/dates?year=2024&month=0",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid year or month");
    });

    it("returns 400 when month is 13", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/dates?year=2024&month=13",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid year or month");
    });
  });

  describe("Happy Path", () => {
    it("returns array of date strings for month", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      mockDb.selectDistinct.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { date: "2024-12-02" },
            { date: "2024-12-05" },
            { date: "2024-12-10" },
          ]),
        }),
      });

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/dates?year=2024&month=12",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toEqual(["2024-12-02", "2024-12-05", "2024-12-10"]);
    });

    it("returns empty array when no entries", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      mockDb.selectDistinct.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/dates?year=2024&month=12",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });
  });
});
```

**Step 2: Run tests**

Run: `npm test -- --run src/app/api/timesheets/dates/route.test.ts`
Expected: All 10 tests pass

**Step 3: Commit**

```bash
git add src/app/api/timesheets/dates/route.test.ts
git commit -m "test: add /api/timesheets/dates endpoint tests"
```

---

## Task 14: Add /api/timesheets/team/[userId] Tests

**Files:**
- Create: `src/app/api/timesheets/team/[userId]/route.test.ts`

**Step 1: Create the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser, createMockTimeEntry, MockUser } from "@/test/mocks/factories";

const mockRequireAuth = vi.fn();
const mockGetUserFromSession = vi.fn();
const mockCanViewTeamTimesheets = vi.fn();
const mockDb = {
  query: {
    timeEntries: {
      findMany: vi.fn(),
    },
  },
};

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...original,
    requireAuth: mockRequireAuth,
    getUserFromSession: mockGetUserFromSession,
    canViewTeamTimesheets: mockCanViewTeamTimesheets,
  };
});

import { GET } from "./route";

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
  mockCanViewTeamTimesheets.mockImplementation((position: string) =>
    ["ADMIN", "PARTNER"].includes(position)
  );
}

// Helper to create params promise (Next.js 15+ pattern)
function createParams(userId: string): Promise<{ userId: string }> {
  return Promise.resolve({ userId });
}

describe("GET /api/timesheets/team/[userId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/team/user-123?date=2024-12-20",
      });

      const response = await GET(request, { params: createParams("user-123") });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 404 when user not in database", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });
      mockGetUserFromSession.mockResolvedValue(null);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/team/user-123?date=2024-12-20",
      });

      const response = await GET(request, { params: createParams("user-123") });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });

  describe("Authorization", () => {
    it("returns 403 when user is ASSOCIATE", async () => {
      const user = createMockUser({ position: "ASSOCIATE" });
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/team/user-123?date=2024-12-20",
      });

      const response = await GET(request, { params: createParams("user-123") });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("You don't have permission to view team timesheets");
    });

    it("returns 403 when user is SENIOR_ASSOCIATE", async () => {
      const user = createMockUser({ position: "SENIOR_ASSOCIATE" });
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/team/user-123?date=2024-12-20",
      });

      const response = await GET(request, { params: createParams("user-123") });
      const data = await response.json();

      expect(response.status).toBe(403);
    });

    it("allows ADMIN to view team entries", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/team/user-123?date=2024-12-20",
      });

      const response = await GET(request, { params: createParams("user-123") });

      expect(response.status).toBe(200);
    });

    it("allows PARTNER to view team entries", async () => {
      const user = createMockUser({ position: "PARTNER" });
      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/team/user-123?date=2024-12-20",
      });

      const response = await GET(request, { params: createParams("user-123") });

      expect(response.status).toBe(200);
    });
  });

  describe("Validation", () => {
    it("returns 400 when date param is missing", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/team/user-123",
      });

      const response = await GET(request, { params: createParams("user-123") });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Date parameter is required");
    });

    it("returns 400 when date format is invalid", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/team/user-123?date=not-a-date",
      });

      const response = await GET(request, { params: createParams("user-123") });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid date format");
    });
  });

  describe("Happy Path", () => {
    it("returns entries for specified team member", async () => {
      const user = createMockUser({ position: "ADMIN" });
      const entries = [
        createMockTimeEntry({ userId: "user-123", hours: "3.0" }),
        createMockTimeEntry({ userId: "user-123", hours: "1.5" }),
      ];

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/team/user-123?date=2024-12-20",
      });

      const response = await GET(request, { params: createParams("user-123") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
    });

    it("returns entries with client details", async () => {
      const user = createMockUser({ position: "ADMIN" });
      const entries = [
        createMockTimeEntry({
          userId: "user-123",
          client: { id: "c1", name: "Client Corp" },
        }),
      ];

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/team/user-123?date=2024-12-20",
      });

      const response = await GET(request, { params: createParams("user-123") });
      const data = await response.json();

      expect(data[0].client).toEqual({ id: "c1", name: "Client Corp" });
    });

    it("returns empty array when no entries", async () => {
      const user = createMockUser({ position: "PARTNER" });
      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/team/user-123?date=2024-12-20",
      });

      const response = await GET(request, { params: createParams("user-123") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });
  });
});
```

**Step 2: Run tests**

Run: `npm test -- --run src/app/api/timesheets/team`
Expected: All 13 tests pass

**Step 3: Commit**

```bash
git add "src/app/api/timesheets/team/[userId]/route.test.ts"
git commit -m "test: add /api/timesheets/team/[userId] endpoint tests"
```

---

## Task 15: Run All Tests and Verify Coverage

**Step 1: Run all tests**

Run: `npm test -- --run`
Expected: All tests pass (36 existing + ~43 new = ~79 tests)

**Step 2: Run with coverage**

Run: `npm run test:coverage`
Expected: Coverage report shows improved coverage for API routes

**Step 3: Commit any fixes if needed**

If tests fail, fix them and commit:
```bash
git add -A
git commit -m "test: fix failing tests"
```

**Step 4: Final commit for phase completion**

```bash
git add -A
git commit -m "test: complete timesheets API route test suite

- Added test infrastructure (mocks, factories, helpers)
- Full coverage for GET/POST/DELETE /api/timesheets
- Full coverage for /api/timesheets/dates
- Full coverage for /api/timesheets/team/[userId]
- ~43 new test cases covering auth, validation, and happy paths"
```

---

## Summary

This plan adds comprehensive test coverage for the timesheets API endpoints:

| Endpoint | Tests | Coverage |
|----------|-------|----------|
| GET /api/timesheets | 10 | Auth, validation, happy path, roles |
| POST /api/timesheets | 17 | Auth, validation (13 cases), happy path |
| DELETE /api/timesheets | 6 | Auth, validation, authorization, happy path |
| GET /api/timesheets/dates | 10 | Auth, validation, happy path |
| GET /api/timesheets/team/[userId] | 13 | Auth, authorization, validation, happy path |
| **Total** | **56** | |

The same patterns can be applied to remaining API routes (clients, employees, topics, subtopics, billing, reports).
