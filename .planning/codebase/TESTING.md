# Testing Patterns

**Analysis Date:** 2026-02-24

## Test Framework

**Runner:**
- Vitest 4.0.16
- Config: `app/vitest.config.ts`
- Environment: jsdom (browser APIs available in all tests)
- Globals enabled: `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach` available without import (though explicit imports are used as convention)

**Assertion Library:**
- Vitest built-in (`expect`) + `@testing-library/jest-dom` matchers (`.toBeInTheDocument()`, `.toBeDisabled()`, etc.)
- Setup: `app/src/test/setup.ts` imports `@testing-library/jest-dom/vitest`

**Run Commands:**
```bash
npm run test               # Watch mode (default)
npm run test -- someFile   # Run specific file
npm run test -- --run      # Run all tests once (no watch)
npm run test:coverage      # Run with v8 coverage report
```

## Test File Organization

**Location:**
- Co-located with source files — test file sits next to the file it tests
- `app/src/lib/date-utils.ts` → `app/src/lib/date-utils.test.ts`
- `app/src/app/api/billing/[id]/route.ts` → `app/src/app/api/billing/[id]/route.test.ts`
- `app/src/components/timesheets/EntryCard.tsx` → `app/src/components/timesheets/EntryCard.test.tsx`

**Naming:**
- Files: `[source-name].test.ts` or `[source-name].test.tsx`
- Top-level `describe`: matches the module name or component name
- HTTP method describes: `describe("GET /api/timesheets", ...)`, `describe("POST /api/timesheets", ...)`

**Shared test utilities:**
```
app/src/test/
├── setup.ts                  # Global test setup (jest-dom, cleanup)
├── utils.tsx                 # renderWithProviders()
├── helpers/
│   ├── api.ts                # createMockRequest()
│   └── index.ts              # Re-exports
└── mocks/
    ├── auth.ts               # Auth mock helpers
    ├── db.ts                 # DB mock helpers
    ├── factories.ts          # Data factory functions
    └── index.ts              # Re-exports
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("GET /api/billing/[id]/topics/reorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => { ... });
  });

  describe("Validation", () => {
    beforeEach(() => {
      // shared setup for all validation tests
      setupAuthenticatedAdmin();
      mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({ status: "DRAFT" });
    });

    it("returns 400 when items is missing", async () => { ... });
    it("returns 400 when items is empty array", async () => { ... });
  });

  describe("Happy Path", () => {
    it("returns success and calls transaction for valid reorder", async () => { ... });
  });

  describe("Error Handling", () => {
    it("returns 500 when transaction throws", async () => { ... });
  });
});
```

**Patterns:**
- `beforeEach(() => { vi.clearAllMocks(); })` at top-level of every test suite — always reset mocks between tests
- Nested `describe` blocks group by concern: Authentication, Validation, Happy Path, Error Handling, Authorization, Role-Based Behavior
- Helper functions within test files for repeated setup: `function setupAuthenticatedAdmin() { ... }`
- `beforeEach` in nested `describe` for shared preconditions

## Mocking

**Framework:** Vitest (`vi.mock`, `vi.fn`, `vi.hoisted`, `vi.stubGlobal`)

**Critical pattern — `vi.hoisted()` for API route tests:**

All mocks for API route tests MUST use `vi.hoisted()` because `vi.mock()` is hoisted to the top of the file by Vitest's transformer, but the mock factory needs to reference variables. `vi.hoisted()` creates those variables before hoisting occurs.

```typescript
// Step 1: Create mocks with vi.hoisted()
const { mockRequireAdmin, mockDb } = vi.hoisted(() => {
  return {
    mockRequireAdmin: vi.fn(),
    mockDb: {
      query: {
        serviceDescriptions: { findFirst: vi.fn() },
      },
      transaction: vi.fn(),
      update: vi.fn(),
    },
  };
});

// Step 2: Wire mocks to modules
vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...original,          // Preserve non-mocked exports
    requireAdmin: mockRequireAdmin,
  };
});

// Step 3: Import route handler AFTER mocks are set up
import { PATCH } from "./route";
```

**Module mocking patterns:**
```typescript
// Mock entire module
vi.mock("@/lib/db", () => ({ db: mockDb }));

// Partial mock — preserve original exports
vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return { ...original, requireAdmin: mockRequireAdmin };
});

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock global fetch (for M365 Graph API)
vi.stubGlobal("fetch", mockFetch);
```

**Component mocking:**
```typescript
// Mock child component with test-id attributes
vi.mock("@/components/ui/ClientSelect", () => ({
  ClientSelect: ({ value, onChange }: { clients: ...; value: string; onChange: (id: string) => void }) => (
    <button data-testid="client-select" onClick={() => onChange("client-1")}>
      {value || "Select client..."}
    </button>
  ),
}));
```

**What to Mock:**
- Database (`@/lib/db`) — never hit real database in tests
- Auth functions (`requireAuth`, `requireAdmin`, `requireWriteAccess`)
- `getUserFromSession` when testing user-aware logic
- External HTTP calls (Microsoft Graph API via `vi.stubGlobal("fetch", ...)`)
- Next.js navigation (`useRouter`, `usePathname`)
- Child components in component tests when they have complex setup requirements

**What NOT to Mock:**
- Utility functions from `@/lib/date-utils`, `@/lib/billing-utils` — test these through their own unit tests
- Simple validation functions from `@/lib/api-utils` — preserve with `importOriginal`

## Fixtures and Factories

**Test Data:** Factory functions in `app/src/test/mocks/factories.ts`:

```typescript
// Override any field with Partial<T>
const user = createMockUser({ position: "ADMIN", id: "user-123" });
const client = createMockClient({ status: "INACTIVE" });
const entry = createMockTimeEntry({ userId: user.id, hours: "8.0" });
const subtopic = createMockSubtopic({ status: "INACTIVE" });
```

**Factory defaults:**
- `createMockUser()`: ASSOCIATE, ACTIVE, auto-generated cuid2 id
- `createMockClient()`: ACTIVE, "Test Client Ltd"
- `createMockTimeEntry()`: date "2024-12-20", hours "2.5", includes client relation
- `createMockSubtopic()`: ACTIVE, with ACTIVE parent topic

**Inline test fixtures for complex objects:**
```typescript
// Local helper in test file for complex domain objects
function createServiceDescription(notes: string | null): ServiceDescription {
  return {
    id: "sd-1",
    clientId: "client-1",
    client: { id: "client-1", name: "Acme Corp", hourlyRate: 200, notes, ... },
    status: "DRAFT",
    topics: [],
    ...
  };
}
```

**Location:**
- Shared factories: `app/src/test/mocks/factories.ts`
- Test-local fixtures: inline within the test file as functions or `const` declarations

## Coverage

**Requirements:** No enforced minimum (no `threshold` in vitest config)

**Provider:** v8

**View Coverage:**
```bash
npm run test:coverage
# Reports: text (console), json, html
# HTML report in: app/coverage/
```

**Exclusions from coverage:**
- `src/**/*.{test,spec}.{ts,tsx}`
- `src/test/**`
- `src/types/**`

## Test Types

**Unit Tests:**
- Scope: Individual utility functions, hooks, pure logic
- Examples: `lib/date-utils.test.ts`, `lib/auth-utils.test.ts`, `hooks/useClickOutside.test.ts`
- Pattern: Import function directly, call with inputs, assert outputs

**Integration Tests (API Routes):**
- Scope: Full API handler execution with mocked DB and auth
- Tests verify: HTTP status codes, response body shape, auth enforcement, validation errors, happy path behavior
- Pattern: `vi.hoisted` → `vi.mock` → `import handler` → `createMockRequest` → call handler → assert response

**Component Tests:**
- Scope: React component rendering and user interaction
- Tool: `@testing-library/react` with `render`, `screen`, `fireEvent`
- Pattern: Render with props, query DOM with `screen.getBy*`/`screen.queryBy*`, interact with `fireEvent`
- No E2E tests

## Common Patterns

**API route test structure:**
```typescript
describe("PATCH /api/billing/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAdmin.mockResolvedValue({ error: "Unauthorized", status: 401 });

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/billing/sd-1",
      body: { status: "FINALIZED" },
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "sd-1" }),  // Note: params is a Promise in Next.js App Router
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });
});
```

**Chainable DB mock pattern:**
```typescript
// insert().values().returning()
mockDb.insert.mockReturnValue({
  values: vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([createdEntry]),
  }),
});

// update().set().where()
mockDb.update.mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});
```

**Async component testing:**
```typescript
// fireEvent (NOT userEvent — @testing-library/user-event is not installed)
fireEvent.click(screen.getByText("Client Notes"));
expect(screen.getByText(/First line/)).toBeInTheDocument();
```

**Error testing:**
```typescript
it("returns 500 when transaction throws", async () => {
  mockDb.transaction.mockRejectedValue(new Error("Database connection failed"));

  const response = await PATCH(request, { params: Promise.resolve({ id: "sd-1" }) });
  const data = await response.json();

  expect(response.status).toBe(500);
  expect(data.error).toBe("Failed to reorder topics");
});
```

**Hook testing with renderHook:**
```typescript
import { renderHook } from "@testing-library/react";

const { rerender, unmount } = renderHook(
  ({ enabled }) => useClickOutside(ref, handler, enabled),
  { initialProps: { enabled: false } }
);
rerender({ enabled: true });
```

**Auth setup helpers:**
```typescript
// In test file: local helper composing mock setup
function setupAuthenticatedUser(user: MockUser) {
  mockRequireAuth.mockResolvedValue({
    session: { user: { name: user.name, email: user.email } },
  });
  mockGetUserFromSession.mockResolvedValue({
    id: user.id, email: user.email, name: user.name, position: user.position,
  });
}

// In test body
const user = createMockUser({ position: "ADMIN" });
setupAuthenticatedUser(user);
```

**Component with providers:**
```typescript
import { renderWithProviders } from "@/test/utils";
// Wraps with MobileNavProvider and any other required contexts
renderWithProviders(<ComponentUnderTest />);
```

---

*Testing analysis: 2026-02-24*
