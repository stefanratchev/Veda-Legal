# Testing Patterns

**Analysis Date:** 2026-02-24

## Test Framework

**Runner:**
- Vitest 4.0.16 with jsdom environment
- Config: `app/vitest.config.ts`
- React Testing Library 16.3.1 for component tests

**Assertion Library:**
- Built-in Vitest assertions (expect API)
- Testing Library matchers via `@testing-library/jest-dom` (v6.9.1)

**Run Commands:**
```bash
npm run test              # Run tests in watch mode
npm run test -- file     # Run specific test file (e.g., npm run test -- date-utils)
npm run test -- --run    # Run all tests once (no watch)
npm run test:coverage    # Run tests with coverage report (v8 provider)
```

## Test File Organization

**Location:**
- Co-located with source: `src/lib/date-utils.ts` → `src/lib/date-utils.test.ts`
- API routes: `src/app/api/timesheets/route.ts` → `src/app/api/timesheets/route.test.ts`
- Components: `src/components/timesheets/WeekStrip.tsx` → `src/components/timesheets/WeekStrip.test.tsx`

**Naming:**
- Pattern: `{name}.test.ts` or `{name}.test.tsx`
- Vitest includes files matching `src/**/*.{test,spec}.{ts,tsx}`

**Structure:**
```
app/src/
├── lib/
│   ├── date-utils.ts
│   ├── date-utils.test.ts        # Unit tests
│   ├── api-utils.ts
│   └── api-utils.test.ts
├── app/api/
│   ├── timesheets/
│   │   ├── route.ts
│   │   └── route.test.ts          # API route tests
│   └── billing/
│       └── [id]/
│           └── topics/
│               ├── reorder/
│               │   ├── route.ts
│               │   └── route.test.ts
└── test/
    ├── setup.ts                   # Vitest global setup
    ├── utils.tsx                  # renderWithProviders helper
    ├── helpers/
    │   └── api.ts                 # createMockRequest
    └── mocks/
        ├── factories.ts           # createMockUser, createMockClient, etc.
        ├── auth.ts                # Auth mocking helpers
        └── db.ts                  # Database mocking utilities
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("date-utils", () => {
  describe("formatDateLong", () => {
    it("formats date with full weekday, day, month and year", () => {
      const date = new Date(2024, 11, 20);
      expect(formatDateLong(date)).toBe("Friday, 20 December 2024");
    });

    it("handles year boundary (Jan 1)", () => {
      const date = new Date(2025, 0, 1);
      expect(formatDateLong(date)).toBe("Wednesday, 1 January 2025");
    });
  });
});
```

**Patterns:**
- Top-level `describe()` wraps entire module
- Nested `describe()` blocks for function groups
- `beforeEach()` clears mocks before each test
- `it()` for individual test cases with descriptive names
- Arrange-act-assert within each test

**Setup:**
- Global setup file: `src/test/setup.ts` registers `@testing-library/jest-dom/vitest` and adds cleanup
- Mocks must be set up before imports using `vi.hoisted()`

## Mocking

**Framework:** Vitest `vi` API for mocking

**Patterns:**

### API Route Tests (vi.hoisted pattern)
```typescript
// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireAuth, mockDb } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockDb: {
    query: {
      users: { findFirst: vi.fn() },
    },
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
  };
});

// Import route AFTER mocks are set up
import { GET, POST, DELETE } from "./route";
```

### Component Tests (direct mock)
```typescript
vi.mock("@/hooks/useClickOutside", () => ({
  useClickOutside: vi.fn(),
}));

vi.mock("@/lib/date-utils", () => ({
  formatDateISO: (date: Date) => { /* implementation */ },
  getWeekDays: (centerDate: Date) => { /* implementation */ },
}));
```

**What to Mock:**
- External dependencies: `db`, `auth`, API utilities
- Hooks: `useClickOutside`, `useState` side effects
- Date functions when predictable values needed
- Network calls via `vi.stubGlobal("fetch", mockFetch)` for M365 tests

**What NOT to Mock:**
- Pure utility functions being tested
- React core components
- Real date/time calculations (unless testing time-dependent logic)

## Fixtures and Factories

**Test Data:**
- Factory functions in `src/test/mocks/factories.ts` create consistent test objects
- Use `createId()` from `@paralleldrive/cuid2` for IDs

**Factories:**
```typescript
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
    topicId: createId(),
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
    topic: { name: "General Advisory", status: "ACTIVE" },
    ...overrides,
  };
}
```

**Location:**
- `src/test/mocks/factories.ts` - All factory functions
- `src/test/mocks/auth.ts` - Auth state helpers
- `src/test/mocks/db.ts` - Database mock utilities

**Auth Test Helpers:**
```typescript
// Helper to set up authenticated user in API route tests
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

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
```

**Database Mock Helpers:**
```typescript
// Create mock with chainable methods
export function createMockDb() {
  return {
    query: {
      users: { findFirst: vi.fn(), findMany: vi.fn() },
      clients: { findFirst: vi.fn(), findMany: vi.fn() },
      timeEntries: { findFirst: vi.fn(), findMany: vi.fn() },
    },
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

// Helper for chainable insert
export function mockInsertReturning<T>(data: T) {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([data]),
    }),
  };
}

// Helper for chainable update
export function mockUpdateReturning<T>(data: T | null) {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(data ? [data] : []),
      }),
    }),
  };
}
```

## Coverage

**Requirements:** Not enforced (no coverage threshold in config)

**View Coverage:**
```bash
npm run test:coverage
# Generates: text, json, html reports
# HTML report: coverage/index.html
```

**Coverage Config:**
- Provider: v8
- Includes: `src/**/*.{ts,tsx}`
- Excludes: test files, test utilities, type files

## Test Types

**Unit Tests:**
- Location: `src/lib/*.test.ts`
- Scope: Pure functions with isolated inputs/outputs
- Example: `date-utils.test.ts` tests date formatting without external dependencies
- Pattern: Create input, call function, assert output
```typescript
describe("formatHours", () => {
  it("formats whole hours", () => {
    expect(formatHours(3)).toBe("3h");
  });
  it("formats hours with minutes", () => {
    expect(formatHours(2.5)).toBe("2h 30m");
  });
});
```

**Integration Tests:**
- Location: `src/app/api/**/*.test.ts`
- Scope: API routes with mocked db and auth
- Example: `route.test.ts` tests full request-response cycle
- Pattern: Mock dependencies, create request, call handler, assert response
```typescript
describe("GET /api/timesheets", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });
    const request = createMockRequest({ method: "GET", url: "/api/timesheets" });
    const response = await GET(request);
    expect(response.status).toBe(401);
  });
});
```

**Component Tests:**
- Location: `src/components/**/*.test.tsx`
- Scope: React components with mocked hooks and utilities
- Example: `WeekStrip.test.tsx` tests rendering and interaction
- Pattern: Mock dependencies, render component, simulate interaction, assert updates
```typescript
describe("WeekStrip", () => {
  it("renders all 7 weekdays (Mon-Sun)", () => {
    render(<WeekStrip {...defaultProps} />);
    expect(screen.getByText("Mon")).toBeInTheDocument();
  });
  it("calls onSelectDate when day clicked", () => {
    render(<WeekStrip {...defaultProps} />);
    fireEvent.click(screen.getByText("26"));
    expect(mockOnSelectDate).toHaveBeenCalled();
  });
});
```

**E2E Tests:**
- Not used in this codebase

## Common Patterns

**Async Testing:**
```typescript
it("fetches entries for a date", async () => {
  mockDb.query.timeEntries.findMany.mockResolvedValue([mockEntry1, mockEntry2]);

  const response = await GET(createMockRequest({ method: "GET", url: "/api/timesheets?date=2024-12-20" }));

  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data).toHaveLength(2);
});
```

**Error Testing:**
```typescript
it("returns 400 for invalid hours", async () => {
  const request = createMockRequest({
    method: "POST",
    url: "/api/timesheets",
    body: { hours: 15 }, // Exceeds MAX_HOURS_PER_ENTRY
  });

  const response = await POST(request);
  expect(response.status).toBe(400);
  const data = await response.json();
  expect(data.error).toContain("Invalid hours");
});
```

**Component Interaction:**
```typescript
// Note: @testing-library/user-event NOT installed; use fireEvent
import { fireEvent, render, screen } from "@testing-library/react";

it("calls handler on button click", () => {
  render(<Component />);
  fireEvent.click(screen.getByRole("button", { name: /submit/i }));
  expect(mockHandler).toHaveBeenCalled();
});
```

**Fixed Dates for Predictable Tests:**
```typescript
// Use specific dates to avoid flaky tests
const selectedDate = new Date(2024, 11, 26); // Thu Dec 26, 2024
const today = new Date(2024, 11, 26);

// Mock date functions for consistent output
vi.mock("@/lib/date-utils", () => ({
  formatDateISO: (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },
}));
```

## Test Utilities

**API Helper:**
- `createMockRequest()` from `src/test/helpers/api.ts`
- Creates NextRequest objects for API route testing
- Accepts method, url, body, headers
```typescript
const request = createMockRequest({
  method: "POST",
  url: "/api/billing/sd-1/topics/reorder",
  body: { items: [{ id: "topic-1", displayOrder: 0 }] },
});
```

**Component Helper:**
- `renderWithProviders()` from `src/test/utils.tsx`
- Wraps components with required context providers (MobileNavProvider)
- Use as drop-in replacement for render
```typescript
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}
```

---

*Testing analysis: 2026-02-24*
