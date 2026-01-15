# Billing Unbilled Clients Cards - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a visual "Clients Ready to Bill" section showing cards for clients with unbilled hours, sorted by estimated value.

**Architecture:** New GET endpoint aggregates unbilled time entries by client, returning summary data. Two new client components render the cards grid. BillingContent integrates the section above the existing service descriptions list.

**Tech Stack:** Next.js API routes, Drizzle ORM queries, React components with Tailwind CSS, Vitest for testing.

---

## Task 1: API Endpoint - Unbilled Summary

Create the backend endpoint that powers the cards.

**Files:**
- Create: `app/src/app/api/billing/unbilled-summary/route.ts`
- Create: `app/src/app/api/billing/unbilled-summary/route.test.ts`

### Step 1: Write the failing test for authentication

```typescript
// app/src/app/api/billing/unbilled-summary/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser } from "@/test/mocks/factories";

const { mockRequireAuth, mockDb } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockDb: {
    query: {
      timeEntries: { findMany: vi.fn() },
      serviceDescriptions: { findMany: vi.fn() },
    },
  },
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...original,
    requireAuth: mockRequireAuth,
  };
});

import { GET } from "./route";

describe("GET /api/billing/unbilled-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "GET",
        url: "/api/billing/unbilled-summary",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd app && npm run test -- unbilled-summary --run`
Expected: FAIL with "Cannot find module './route'"

### Step 3: Create minimal route to pass auth test

```typescript
// app/src/app/api/billing/unbilled-summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, errorResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({ clients: [] });
}
```

### Step 4: Run test to verify it passes

Run: `cd app && npm run test -- unbilled-summary --run`
Expected: PASS

### Step 5: Write test for empty state (no unbilled entries)

Add to test file:

```typescript
  describe("Happy Path", () => {
    it("returns empty array when no unbilled entries exist", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.timeEntries.findMany.mockResolvedValue([]);
      mockDb.query.serviceDescriptions.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/billing/unbilled-summary",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.clients).toEqual([]);
    });
  });
```

### Step 6: Run test to verify it passes

Run: `cd app && npm run test -- unbilled-summary --run`
Expected: PASS (empty array already returned)

### Step 7: Write test for client with unbilled hours

Add to "Happy Path" describe block:

```typescript
    it("returns clients with unbilled hours aggregated", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      // Mock time entries - two entries for same client
      mockDb.query.timeEntries.findMany.mockResolvedValue([
        {
          id: "entry-1",
          clientId: "client-1",
          date: "2024-11-15",
          hours: "2.5",
          topicName: "Corporate",
          client: { id: "client-1", name: "Acme Corp", hourlyRate: "200.00", status: "ACTIVE" },
          billingLineItems: [],
        },
        {
          id: "entry-2",
          clientId: "client-1",
          date: "2024-12-01",
          hours: "3.0",
          topicName: "Corporate",
          client: { id: "client-1", name: "Acme Corp", hourlyRate: "200.00", status: "ACTIVE" },
          billingLineItems: [],
        },
      ]);

      // No existing drafts
      mockDb.query.serviceDescriptions.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/billing/unbilled-summary",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.clients).toHaveLength(1);
      expect(data.clients[0]).toEqual({
        clientId: "client-1",
        clientName: "Acme Corp",
        hourlyRate: 200,
        totalUnbilledHours: 5.5,
        estimatedValue: 1100, // 5.5 * 200
        oldestEntryDate: "2024-11-15",
        newestEntryDate: "2024-12-01",
        existingDraftId: null,
        existingDraftPeriod: null,
      });
    });
```

### Step 8: Implement full aggregation logic

Replace route.ts with complete implementation:

```typescript
// app/src/app/api/billing/unbilled-summary/route.ts
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { timeEntries, serviceDescriptions } from "@/lib/schema";
import { requireAuth, errorResponse } from "@/lib/api-utils";

interface ClientSummary {
  clientId: string;
  clientName: string;
  hourlyRate: number | null;
  totalUnbilledHours: number;
  estimatedValue: number | null;
  oldestEntryDate: string;
  newestEntryDate: string;
  existingDraftId: string | null;
  existingDraftPeriod: string | null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    // Get all time entries with their billing status
    const allEntries = await db.query.timeEntries.findMany({
      columns: {
        id: true,
        clientId: true,
        date: true,
        hours: true,
        topicName: true,
      },
      with: {
        client: {
          columns: { id: true, name: true, hourlyRate: true, status: true },
        },
        billingLineItems: {
          columns: { id: true },
          with: {
            topic: {
              columns: { id: true },
              with: {
                serviceDescription: {
                  columns: { status: true },
                },
              },
            },
          },
        },
      },
    });

    // Filter to unbilled entries (not in FINALIZED service descriptions) and ACTIVE clients
    const unbilledEntries = allEntries.filter((entry) => {
      if (entry.client?.status !== "ACTIVE") return false;
      const hasFinalized = entry.billingLineItems.some(
        (li) => li.topic?.serviceDescription?.status === "FINALIZED"
      );
      return !hasFinalized;
    });

    // Get existing DRAFT service descriptions
    const drafts = await db.query.serviceDescriptions.findMany({
      where: eq(serviceDescriptions.status, "DRAFT"),
      columns: {
        id: true,
        clientId: true,
        periodStart: true,
        periodEnd: true,
      },
    });

    // Create map of clientId -> draft
    const draftsByClient = new Map<string, typeof drafts[0]>();
    for (const draft of drafts) {
      // Only keep the most recent draft per client (last one wins)
      draftsByClient.set(draft.clientId, draft);
    }

    // Group by client and aggregate
    const clientMap = new Map<string, {
      clientId: string;
      clientName: string;
      hourlyRate: number | null;
      totalHours: number;
      oldestDate: string;
      newestDate: string;
    }>();

    for (const entry of unbilledEntries) {
      const clientId = entry.clientId;
      const hours = Number(entry.hours);
      const rate = entry.client?.hourlyRate ? Number(entry.client.hourlyRate) : null;

      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          clientId,
          clientName: entry.client?.name || "Unknown",
          hourlyRate: rate,
          totalHours: 0,
          oldestDate: entry.date,
          newestDate: entry.date,
        });
      }

      const client = clientMap.get(clientId)!;
      client.totalHours += hours;
      if (entry.date < client.oldestDate) client.oldestDate = entry.date;
      if (entry.date > client.newestDate) client.newestDate = entry.date;
    }

    // Build response
    const clients: ClientSummary[] = [];
    for (const [clientId, data] of clientMap.entries()) {
      const draft = draftsByClient.get(clientId);
      clients.push({
        clientId: data.clientId,
        clientName: data.clientName,
        hourlyRate: data.hourlyRate,
        totalUnbilledHours: Math.round(data.totalHours * 100) / 100,
        estimatedValue: data.hourlyRate
          ? Math.round(data.totalHours * data.hourlyRate * 100) / 100
          : null,
        oldestEntryDate: data.oldestDate,
        newestEntryDate: data.newestDate,
        existingDraftId: draft?.id || null,
        existingDraftPeriod: draft
          ? `${draft.periodStart} - ${draft.periodEnd}`
          : null,
      });
    }

    // Sort by estimated value descending (nulls last)
    clients.sort((a, b) => {
      if (a.estimatedValue === null && b.estimatedValue === null) return 0;
      if (a.estimatedValue === null) return 1;
      if (b.estimatedValue === null) return -1;
      return b.estimatedValue - a.estimatedValue;
    });

    return NextResponse.json({ clients });
  } catch (error) {
    console.error("Database error fetching unbilled summary:", error);
    return errorResponse("Failed to fetch unbilled summary", 500);
  }
}
```

### Step 9: Run test to verify it passes

Run: `cd app && npm run test -- unbilled-summary --run`
Expected: PASS

### Step 10: Write test for draft detection

Add to "Happy Path" describe block:

```typescript
    it("includes existing draft info when draft exists for client", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.timeEntries.findMany.mockResolvedValue([
        {
          id: "entry-1",
          clientId: "client-1",
          date: "2024-12-15",
          hours: "4.0",
          topicName: "Corporate",
          client: { id: "client-1", name: "Acme Corp", hourlyRate: "150.00", status: "ACTIVE" },
          billingLineItems: [],
        },
      ]);

      mockDb.query.serviceDescriptions.findMany.mockResolvedValue([
        {
          id: "sd-123",
          clientId: "client-1",
          periodStart: "2024-12-01",
          periodEnd: "2024-12-31",
        },
      ]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/billing/unbilled-summary",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.clients[0].existingDraftId).toBe("sd-123");
      expect(data.clients[0].existingDraftPeriod).toBe("2024-12-01 - 2024-12-31");
    });
```

### Step 11: Run test to verify it passes

Run: `cd app && npm run test -- unbilled-summary --run`
Expected: PASS

### Step 12: Write test for excluding finalized entries

Add to test file:

```typescript
    it("excludes entries already in finalized service descriptions", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.timeEntries.findMany.mockResolvedValue([
        {
          id: "entry-1",
          clientId: "client-1",
          date: "2024-12-15",
          hours: "4.0",
          topicName: "Corporate",
          client: { id: "client-1", name: "Acme Corp", hourlyRate: "150.00", status: "ACTIVE" },
          billingLineItems: [
            {
              id: "li-1",
              topic: {
                id: "topic-1",
                serviceDescription: { status: "FINALIZED" },
              },
            },
          ],
        },
      ]);

      mockDb.query.serviceDescriptions.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/billing/unbilled-summary",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.clients).toEqual([]);
    });
```

### Step 13: Run test to verify it passes

Run: `cd app && npm run test -- unbilled-summary --run`
Expected: PASS

### Step 14: Write test for null hourly rate

Add to test file:

```typescript
    it("returns null estimatedValue when client has no hourly rate", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.timeEntries.findMany.mockResolvedValue([
        {
          id: "entry-1",
          clientId: "client-1",
          date: "2024-12-15",
          hours: "4.0",
          topicName: "Corporate",
          client: { id: "client-1", name: "Acme Corp", hourlyRate: null, status: "ACTIVE" },
          billingLineItems: [],
        },
      ]);

      mockDb.query.serviceDescriptions.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/billing/unbilled-summary",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.clients[0].hourlyRate).toBeNull();
      expect(data.clients[0].estimatedValue).toBeNull();
    });
```

### Step 15: Run test to verify it passes

Run: `cd app && npm run test -- unbilled-summary --run`
Expected: PASS

### Step 16: Write test for sorting by value

Add to test file:

```typescript
    it("sorts clients by estimated value descending", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.timeEntries.findMany.mockResolvedValue([
        {
          id: "entry-1",
          clientId: "client-low",
          date: "2024-12-15",
          hours: "1.0",
          topicName: "Corporate",
          client: { id: "client-low", name: "Low Value", hourlyRate: "100.00", status: "ACTIVE" },
          billingLineItems: [],
        },
        {
          id: "entry-2",
          clientId: "client-high",
          date: "2024-12-15",
          hours: "10.0",
          topicName: "Corporate",
          client: { id: "client-high", name: "High Value", hourlyRate: "200.00", status: "ACTIVE" },
          billingLineItems: [],
        },
      ]);

      mockDb.query.serviceDescriptions.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/billing/unbilled-summary",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.clients[0].clientName).toBe("High Value");
      expect(data.clients[0].estimatedValue).toBe(2000);
      expect(data.clients[1].clientName).toBe("Low Value");
      expect(data.clients[1].estimatedValue).toBe(100);
    });
```

### Step 17: Run test to verify it passes

Run: `cd app && npm run test -- unbilled-summary --run`
Expected: PASS

### Step 18: Write test for database error handling

Add to test file:

```typescript
  describe("Error Handling", () => {
    it("returns 500 on database error", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.timeEntries.findMany.mockRejectedValue(new Error("Database connection failed"));

      const request = createMockRequest({
        method: "GET",
        url: "/api/billing/unbilled-summary",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch unbilled summary");
    });
  });
```

### Step 19: Run all tests to verify everything passes

Run: `cd app && npm run test -- unbilled-summary --run`
Expected: All tests PASS

### Step 20: Commit

```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/billing-unbilled-clients
git add app/src/app/api/billing/unbilled-summary/
git commit -m "$(cat <<'EOF'
feat(billing): add unbilled-summary API endpoint

Returns aggregated unbilled hours per client with:
- Total hours and estimated value
- Date range of unbilled work
- Existing draft service description info
- Sorted by value descending

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: UnbilledClientCard Component

Create the individual card component.

**Files:**
- Create: `app/src/components/billing/UnbilledClientCard.tsx`
- Create: `app/src/components/billing/UnbilledClientCard.test.tsx`

### Step 1: Write failing test for card rendering

```typescript
// app/src/components/billing/UnbilledClientCard.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnbilledClientCard } from "./UnbilledClientCard";

// Mock useRouter
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

describe("UnbilledClientCard", () => {
  const defaultProps = {
    clientId: "client-1",
    clientName: "Acme Corporation",
    hourlyRate: 200,
    totalUnbilledHours: 17.5,
    estimatedValue: 3500,
    oldestEntryDate: "2024-10-15",
    newestEntryDate: "2024-12-20",
    existingDraftId: null,
    existingDraftPeriod: null,
    onCreateServiceDescription: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders client name", () => {
      render(<UnbilledClientCard {...defaultProps} />);
      expect(screen.getByText("Acme Corporation")).toBeInTheDocument();
    });

    it("renders estimated value formatted as currency", () => {
      render(<UnbilledClientCard {...defaultProps} />);
      expect(screen.getByText("3,500.00 BGN")).toBeInTheDocument();
    });

    it("renders total unbilled hours", () => {
      render(<UnbilledClientCard {...defaultProps} />);
      expect(screen.getByText("17.5 hours")).toBeInTheDocument();
    });

    it("renders date range", () => {
      render(<UnbilledClientCard {...defaultProps} />);
      expect(screen.getByText("Oct 15 – Dec 20, 2024")).toBeInTheDocument();
    });

    it("renders 'Rate not set' when hourlyRate is null", () => {
      render(<UnbilledClientCard {...defaultProps} hourlyRate={null} estimatedValue={null} />);
      expect(screen.getByText("Rate not set")).toBeInTheDocument();
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd app && npm run test -- UnbilledClientCard --run`
Expected: FAIL with "Cannot find module './UnbilledClientCard'"

### Step 3: Create minimal component to pass rendering tests

```typescript
// app/src/components/billing/UnbilledClientCard.tsx
"use client";

import { useRouter } from "next/navigation";

interface UnbilledClientCardProps {
  clientId: string;
  clientName: string;
  hourlyRate: number | null;
  totalUnbilledHours: number;
  estimatedValue: number | null;
  oldestEntryDate: string;
  newestEntryDate: string;
  existingDraftId: string | null;
  existingDraftPeriod: string | null;
  onCreateServiceDescription: (clientId: string, periodStart: string, periodEnd: string) => Promise<void>;
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startStr = startDate.toLocaleDateString("en-GB", { month: "short", day: "numeric" });
  const endStr = endDate.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" });
  return `${startStr} – ${endStr}`;
}

export function UnbilledClientCard({
  clientId,
  clientName,
  hourlyRate,
  totalUnbilledHours,
  estimatedValue,
  oldestEntryDate,
  newestEntryDate,
  existingDraftId,
  existingDraftPeriod,
  onCreateServiceDescription,
}: UnbilledClientCardProps) {
  const router = useRouter();

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg p-4 hover:border-[var(--border-default)] transition-colors cursor-pointer">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-[var(--text-primary)] text-sm truncate pr-2">
          {clientName}
        </h3>
      </div>

      <div className="mb-3">
        {estimatedValue !== null ? (
          <>
            <div className="text-2xl font-semibold text-[var(--accent-pink)]">
              {estimatedValue.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BGN
            </div>
            <div className="text-xs text-[var(--text-muted)]">estimated unbilled</div>
          </>
        ) : (
          <div className="text-lg text-[var(--text-muted)]">Rate not set</div>
        )}
      </div>

      <div className="text-[13px] text-[var(--text-secondary)] mb-1">
        {totalUnbilledHours} hours
      </div>
      <div className="text-xs text-[var(--text-muted)]">
        {formatDateRange(oldestEntryDate, newestEntryDate)}
      </div>
    </div>
  );
}
```

### Step 4: Run test to verify it passes

Run: `cd app && npm run test -- UnbilledClientCard --run`
Expected: PASS

### Step 5: Write test for draft badge

Add to "Rendering" describe block:

```typescript
    it("shows DRAFT badge when existingDraftId is set", () => {
      render(
        <UnbilledClientCard
          {...defaultProps}
          existingDraftId="draft-123"
          existingDraftPeriod="Dec 1 – Dec 31, 2024"
        />
      );
      expect(screen.getByText("DRAFT")).toBeInTheDocument();
    });

    it("does not show DRAFT badge when no draft exists", () => {
      render(<UnbilledClientCard {...defaultProps} />);
      expect(screen.queryByText("DRAFT")).not.toBeInTheDocument();
    });
```

### Step 6: Update component to show draft badge

Add to the component JSX, after the client name h3:

```typescript
        {existingDraftId && (
          <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded bg-[var(--warning-bg)] text-[var(--warning)]">
            DRAFT
          </span>
        )}
```

### Step 7: Run test to verify it passes

Run: `cd app && npm run test -- UnbilledClientCard --run`
Expected: PASS

### Step 8: Write test for button text

Add new describe block:

```typescript
  describe("Button Text", () => {
    it("shows 'Create Service Description' when no draft exists", () => {
      render(<UnbilledClientCard {...defaultProps} />);
      expect(screen.getByRole("button")).toHaveTextContent("Create Service Description");
    });

    it("shows 'Continue Draft' when draft exists", () => {
      render(
        <UnbilledClientCard
          {...defaultProps}
          existingDraftId="draft-123"
          existingDraftPeriod="Dec 1 – Dec 31, 2024"
        />
      );
      expect(screen.getByRole("button")).toHaveTextContent("Continue Draft");
    });
  });
```

### Step 9: Update component with button

Add button to the component JSX, at the end before the closing div:

```typescript
      <button
        className="mt-4 w-full py-2 text-[13px] font-medium text-[var(--accent-pink)] hover:bg-[var(--bg-surface)] rounded transition-colors"
      >
        {existingDraftId ? "Continue Draft →" : "Create Service Description →"}
      </button>
```

### Step 10: Run test to verify it passes

Run: `cd app && npm run test -- UnbilledClientCard --run`
Expected: PASS

### Step 11: Write test for click behavior

Add new describe block:

```typescript
  describe("Click Behavior", () => {
    it("navigates to existing draft when draft exists", async () => {
      render(
        <UnbilledClientCard
          {...defaultProps}
          existingDraftId="draft-123"
          existingDraftPeriod="Dec 1 – Dec 31, 2024"
        />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(mockPush).toHaveBeenCalledWith("/billing/draft-123");
    });

    it("calls onCreateServiceDescription when no draft exists", async () => {
      const mockCreate = vi.fn().mockResolvedValue(undefined);
      render(
        <UnbilledClientCard
          {...defaultProps}
          onCreateServiceDescription={mockCreate}
        />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(mockCreate).toHaveBeenCalledWith("client-1", "2024-10-15", "2024-12-20");
    });
  });
```

### Step 12: Implement click handler

Update the button and add state:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ... props interface ...

export function UnbilledClientCard({
  // ... props ...
}: UnbilledClientCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (existingDraftId) {
      router.push(`/billing/${existingDraftId}`);
      return;
    }

    setIsLoading(true);
    try {
      await onCreateServiceDescription(clientId, oldestEntryDate, newestEntryDate);
    } finally {
      setIsLoading(false);
    }
  };

  // ... rest of component ...

  // Update button:
  <button
    onClick={handleClick}
    disabled={isLoading}
    className="mt-4 w-full py-2 text-[13px] font-medium text-[var(--accent-pink)] hover:bg-[var(--bg-surface)] rounded transition-colors disabled:opacity-50"
  >
    {isLoading ? "Creating..." : existingDraftId ? "Continue Draft →" : "Create Service Description →"}
  </button>
```

### Step 13: Run test to verify it passes

Run: `cd app && npm run test -- UnbilledClientCard --run`
Expected: PASS

### Step 14: Write test for loading state

Add to "Click Behavior" describe block:

```typescript
    it("shows loading state while creating", async () => {
      const mockCreate = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
      render(
        <UnbilledClientCard
          {...defaultProps}
          onCreateServiceDescription={mockCreate}
        />
      );

      fireEvent.click(screen.getByRole("button"));

      expect(screen.getByRole("button")).toHaveTextContent("Creating...");
      expect(screen.getByRole("button")).toBeDisabled();
    });
```

### Step 15: Run test to verify it passes

Run: `cd app && npm run test -- UnbilledClientCard --run`
Expected: PASS

### Step 16: Run all card tests

Run: `cd app && npm run test -- UnbilledClientCard --run`
Expected: All tests PASS

### Step 17: Commit

```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/billing-unbilled-clients
git add app/src/components/billing/UnbilledClientCard.tsx app/src/components/billing/UnbilledClientCard.test.tsx
git commit -m "$(cat <<'EOF'
feat(billing): add UnbilledClientCard component

Card displays client unbilled summary with:
- Estimated value in accent color
- Total hours and date range
- DRAFT badge when draft exists
- Click to create SD or continue draft

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: UnbilledClientsSection Component

Create the grid container with empty state.

**Files:**
- Create: `app/src/components/billing/UnbilledClientsSection.tsx`
- Create: `app/src/components/billing/UnbilledClientsSection.test.tsx`

### Step 1: Write failing test for section rendering

```typescript
// app/src/components/billing/UnbilledClientsSection.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { UnbilledClientsSection } from "./UnbilledClientsSection";

// Mock fetch
global.fetch = vi.fn();

// Mock useRouter
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("UnbilledClientsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("shows loading state initially", () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));

      render(<UnbilledClientsSection onCreateServiceDescription={vi.fn()} />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("shows empty state when no clients have unbilled hours", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ clients: [] }),
      });

      render(<UnbilledClientsSection onCreateServiceDescription={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("All caught up!")).toBeInTheDocument();
      });
      expect(screen.getByText("No unbilled hours to bill.")).toBeInTheDocument();
    });
  });
});
```

### Step 2: Run test to verify it fails

Run: `cd app && npm run test -- UnbilledClientsSection --run`
Expected: FAIL with "Cannot find module './UnbilledClientsSection'"

### Step 3: Create minimal component

```typescript
// app/src/components/billing/UnbilledClientsSection.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface UnbilledClient {
  clientId: string;
  clientName: string;
  hourlyRate: number | null;
  totalUnbilledHours: number;
  estimatedValue: number | null;
  oldestEntryDate: string;
  newestEntryDate: string;
  existingDraftId: string | null;
  existingDraftPeriod: string | null;
}

interface UnbilledClientsSectionProps {
  onCreateServiceDescription: (clientId: string, periodStart: string, periodEnd: string) => Promise<void>;
}

export function UnbilledClientsSection({ onCreateServiceDescription }: UnbilledClientsSectionProps) {
  const [clients, setClients] = useState<UnbilledClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUnbilledClients() {
      try {
        const response = await fetch("/api/billing/unbilled-summary");
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();
        setClients(data.clients);
      } catch {
        setError("Failed to load unbilled clients");
      } finally {
        setIsLoading(false);
      }
    }
    fetchUnbilledClients();
  }, []);

  if (isLoading) {
    return <div className="text-[var(--text-muted)]">Loading...</div>;
  }

  if (error) {
    return <div className="text-[var(--danger)]">{error}</div>;
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[var(--text-primary)] font-medium">All caught up!</p>
        <p className="text-[var(--text-muted)] text-sm">No unbilled hours to bill.</p>
        <Link href="/timesheets" className="text-[var(--accent-pink)] text-sm hover:underline mt-2 inline-block">
          Log time →
        </Link>
      </div>
    );
  }

  return <div>Cards here</div>;
}
```

### Step 4: Run test to verify it passes

Run: `cd app && npm run test -- UnbilledClientsSection --run`
Expected: PASS

### Step 5: Write test for rendering cards

Add new describe block:

```typescript
  describe("Rendering Cards", () => {
    it("renders cards for each client with unbilled hours", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          clients: [
            {
              clientId: "client-1",
              clientName: "Acme Corp",
              hourlyRate: 200,
              totalUnbilledHours: 10,
              estimatedValue: 2000,
              oldestEntryDate: "2024-12-01",
              newestEntryDate: "2024-12-15",
              existingDraftId: null,
              existingDraftPeriod: null,
            },
            {
              clientId: "client-2",
              clientName: "Beta Inc",
              hourlyRate: 150,
              totalUnbilledHours: 5,
              estimatedValue: 750,
              oldestEntryDate: "2024-12-10",
              newestEntryDate: "2024-12-20",
              existingDraftId: null,
              existingDraftPeriod: null,
            },
          ],
        }),
      });

      render(<UnbilledClientsSection onCreateServiceDescription={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("Acme Corp")).toBeInTheDocument();
      });
      expect(screen.getByText("Beta Inc")).toBeInTheDocument();
    });

    it("renders section heading with count", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          clients: [
            {
              clientId: "client-1",
              clientName: "Acme Corp",
              hourlyRate: 200,
              totalUnbilledHours: 10,
              estimatedValue: 2000,
              oldestEntryDate: "2024-12-01",
              newestEntryDate: "2024-12-15",
              existingDraftId: null,
              existingDraftPeriod: null,
            },
          ],
        }),
      });

      render(<UnbilledClientsSection onCreateServiceDescription={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("Clients Ready to Bill")).toBeInTheDocument();
      });
      expect(screen.getByText("1")).toBeInTheDocument(); // count badge
    });
  });
```

### Step 6: Update component with full rendering

```typescript
// app/src/components/billing/UnbilledClientsSection.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { UnbilledClientCard } from "./UnbilledClientCard";

interface UnbilledClient {
  clientId: string;
  clientName: string;
  hourlyRate: number | null;
  totalUnbilledHours: number;
  estimatedValue: number | null;
  oldestEntryDate: string;
  newestEntryDate: string;
  existingDraftId: string | null;
  existingDraftPeriod: string | null;
}

interface UnbilledClientsSectionProps {
  onCreateServiceDescription: (clientId: string, periodStart: string, periodEnd: string) => Promise<void>;
}

export function UnbilledClientsSection({ onCreateServiceDescription }: UnbilledClientsSectionProps) {
  const [clients, setClients] = useState<UnbilledClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUnbilledClients() {
      try {
        const response = await fetch("/api/billing/unbilled-summary");
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();
        setClients(data.clients);
      } catch {
        setError("Failed to load unbilled clients");
      } finally {
        setIsLoading(false);
      }
    }
    fetchUnbilledClients();
  }, []);

  if (isLoading) {
    return <div className="text-[var(--text-muted)]">Loading...</div>;
  }

  if (error) {
    return <div className="text-[var(--danger)]">{error}</div>;
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[var(--text-primary)] font-medium">All caught up!</p>
        <p className="text-[var(--text-muted)] text-sm">No unbilled hours to bill.</p>
        <Link href="/timesheets" className="text-[var(--accent-pink)] text-sm hover:underline mt-2 inline-block">
          Log time →
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)]">
          Clients Ready to Bill
        </h2>
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[var(--accent-pink)] text-[var(--bg-deep)]">
          {clients.length}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients.map((client) => (
          <UnbilledClientCard
            key={client.clientId}
            {...client}
            onCreateServiceDescription={onCreateServiceDescription}
          />
        ))}
      </div>
    </div>
  );
}
```

### Step 7: Run test to verify it passes

Run: `cd app && npm run test -- UnbilledClientsSection --run`
Expected: PASS

### Step 8: Write test for error state

Add new describe block:

```typescript
  describe("Error State", () => {
    it("shows error message when fetch fails", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
      });

      render(<UnbilledClientsSection onCreateServiceDescription={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load unbilled clients")).toBeInTheDocument();
      });
    });
  });
```

### Step 9: Run all section tests

Run: `cd app && npm run test -- UnbilledClientsSection --run`
Expected: All tests PASS

### Step 10: Commit

```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/billing-unbilled-clients
git add app/src/components/billing/UnbilledClientsSection.tsx app/src/components/billing/UnbilledClientsSection.test.tsx
git commit -m "$(cat <<'EOF'
feat(billing): add UnbilledClientsSection component

Section fetches and displays unbilled clients grid:
- Responsive 3/2/1 column layout
- Count badge in heading
- Empty state with link to timesheets
- Loading and error states

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Integrate into BillingContent

Modify the existing billing page to include the new section.

**Files:**
- Modify: `app/src/components/billing/BillingContent.tsx`

### Step 1: Add UnbilledClientsSection import and integration

Update BillingContent.tsx:

```typescript
// At the top, add import:
import { UnbilledClientsSection } from "./UnbilledClientsSection";

// In the return statement, add section before the "Service Descriptions" heading:
// After the page title/button div, before TableFilters

// Find this section in the existing code:
//       </div>
//
//       <TableFilters

// And add the UnbilledClientsSection:
//       </div>
//
//       <UnbilledClientsSection onCreateServiceDescription={handleCreate} />
//
//       <div className="mt-8">
//         <h2 className="font-heading text-lg font-semibold text-[var(--text-primary)] mb-4">
//           Service Descriptions
//         </h2>
//         <TableFilters
```

### Step 2: Update handleCreate to return the created ID

The handleCreate function needs to be modified to work with the card click flow. Update it to return and navigate:

```typescript
  const handleCreateFromCard = useCallback(async (clientId: string, periodStart: string, periodEnd: string) => {
    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, periodStart, periodEnd }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create service description");
      }

      router.push(`/billing/${data.id}`);
    } catch (error) {
      console.error("Failed to create service description:", error);
      throw error;
    }
  }, [router]);
```

### Step 3: Run existing tests to ensure no regressions

Run: `cd app && npm run test -- --run`
Expected: All existing tests PASS

### Step 4: Commit

```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/billing-unbilled-clients
git add app/src/components/billing/BillingContent.tsx
git commit -m "$(cat <<'EOF'
feat(billing): integrate UnbilledClientsSection into billing page

Adds unbilled clients cards section above service descriptions list.
Cards allow one-click creation or continuation of service descriptions.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Final Integration Testing

Verify everything works together.

### Step 1: Run all tests

Run: `cd app && npm run test -- --run`
Expected: All tests PASS

### Step 2: Run linter

Run: `cd app && npm run lint`
Expected: No errors

### Step 3: Run build

Run: `cd app && npm run build`
Expected: Build succeeds

### Step 4: Manual testing checklist

1. Navigate to /billing
2. Verify "Clients Ready to Bill" section appears (if unbilled hours exist)
3. Verify cards show correct: value, hours, date range
4. Click a card without draft → creates SD and navigates
5. Create a draft, go back to /billing → card shows DRAFT badge
6. Click card with draft → navigates to existing draft
7. Verify empty state appears when all clients are billed
8. Verify responsive layout (3/2/1 columns)

### Step 5: Final commit (if any fixes needed)

```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/billing-unbilled-clients
git add -A
git commit -m "$(cat <<'EOF'
fix(billing): integration fixes from testing

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

---

## Summary

| Task | Files | Tests |
|------|-------|-------|
| 1. API Endpoint | `api/billing/unbilled-summary/route.ts` | 8 tests |
| 2. Card Component | `components/billing/UnbilledClientCard.tsx` | 10 tests |
| 3. Section Component | `components/billing/UnbilledClientsSection.tsx` | 5 tests |
| 4. Integration | `components/billing/BillingContent.tsx` | Existing tests |
| 5. Final Testing | - | All tests + manual |

**Total new tests:** ~23
**Total commits:** 5
