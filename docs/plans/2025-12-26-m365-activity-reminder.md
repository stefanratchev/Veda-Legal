# M365 Activity Reminder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a button to the timesheets page that fetches calendar events and emails from Microsoft 365 to help employees recall their activities when filling in timesheets.

**Architecture:** Button in WeekStrip triggers API call to `/api/m365/activity`. API route uses the user's Azure AD access token to query Microsoft Graph API for calendar events and emails. Results display in a collapsible panel between WeekStrip and EntryForm.

**Tech Stack:** Next.js API routes, Microsoft Graph API, NextAuth.js token refresh, React components with Tailwind CSS

---

## Task 1: Add M365 Types

**Files:**
- Create: `src/types/m365.ts`

**Step 1: Create type definitions**

```typescript
// src/types/m365.ts

/**
 * Calendar event from Microsoft 365.
 */
export interface M365CalendarEvent {
  subject: string;
  start: string;           // ISO timestamp
  durationMinutes: number;
  attendees: string[];     // Display names or emails
}

/**
 * Email from Microsoft 365.
 */
export interface M365Email {
  subject: string;
  timestamp: string;       // ISO timestamp
  from: string;            // Sender
  to: string[];            // Recipients
  direction: 'sent' | 'received';
}

/**
 * Response from /api/m365/activity endpoint.
 */
export interface M365ActivityResponse {
  calendar: M365CalendarEvent[];
  emails: M365Email[];
}

/**
 * Error response from /api/m365/activity endpoint.
 */
export interface M365ActivityError {
  error: string;
  code?: 'SESSION_EXPIRED' | 'GRAPH_ERROR' | 'NETWORK_ERROR';
}
```

**Step 2: Export from types index**

In `src/types/index.ts`, add at the end:

```typescript
// M365 Activity types
export type {
  M365CalendarEvent,
  M365Email,
  M365ActivityResponse,
  M365ActivityError,
} from './m365';
```

**Step 3: Verify types compile**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/types/m365.ts src/types/index.ts
git commit -m "feat(m365): add type definitions for M365 activity"
```

---

## Task 2: Extend NextAuth Types for Access Token

**Files:**
- Create: `src/types/next-auth.d.ts`

**Step 1: Create NextAuth type extensions**

```typescript
// src/types/next-auth.d.ts
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: "RefreshTokenError";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: "RefreshTokenError";
  }
}
```

**Step 2: Verify types compile**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/types/next-auth.d.ts
git commit -m "feat(auth): extend NextAuth types for access token"
```

---

## Task 3: Update Auth Scopes and Add Token Refresh

**Files:**
- Modify: `src/lib/auth.ts`

**Step 1: Add Calendars.Read and Mail.Read scopes**

In `src/lib/auth.ts`, update the authorization params:

```typescript
authorization: {
  params: {
    scope: "openid profile email User.Read Calendars.Read Mail.Read offline_access",
  },
},
```

Note: `offline_access` is required to receive a refresh token.

**Step 2: Update jwt callback with token refresh logic**

Replace the existing `jwt` callback with:

```typescript
async jwt({ token, account, profile, user }) {
  // Initial sign-in: store all token info
  if (account) {
    token.accessToken = account.access_token;
    token.refreshToken = account.refresh_token;
    token.expiresAt = account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000;
  }

  // Set email/name from user or profile on first sign-in
  const azureProfile = profile as { email?: string; preferred_username?: string; name?: string } | undefined;

  if (user?.email) {
    token.email = user.email;
  }
  if (user?.name) {
    token.name = user.name;
  }
  if (azureProfile?.email) {
    token.email = azureProfile.email;
  } else if (azureProfile?.preferred_username) {
    token.email = azureProfile.preferred_username;
  }
  if (azureProfile?.name) {
    token.name = azureProfile.name;
  }

  // Return existing token if not expired (with 5min buffer)
  if (token.expiresAt && Date.now() < token.expiresAt - 5 * 60 * 1000) {
    return token;
  }

  // Token expired or about to expire - refresh it
  if (token.refreshToken) {
    try {
      const response = await fetch(
        `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.AZURE_AD_CLIENT_ID!,
            client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
            grant_type: "refresh_token",
            refresh_token: token.refreshToken,
          }),
        }
      );

      const refreshed = await response.json();

      if (!response.ok) {
        console.error("Token refresh failed:", refreshed);
        return { ...token, error: "RefreshTokenError" as const };
      }

      return {
        ...token,
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token ?? token.refreshToken,
        expiresAt: Date.now() + refreshed.expires_in * 1000,
        error: undefined,
      };
    } catch (error) {
      console.error("Token refresh error:", error);
      return { ...token, error: "RefreshTokenError" as const };
    }
  }

  return token;
},
```

**Step 3: Update session callback to expose accessToken**

Replace the existing `session` callback with:

```typescript
async session({ session, token }) {
  if (session.user) {
    session.user.name = token.name as string;
    session.user.email = token.email as string;
  }
  session.accessToken = token.accessToken as string | undefined;
  session.error = token.error;
  return session;
},
```

**Step 4: Verify build passes**

Run: `cd app && npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat(auth): add M365 scopes and token refresh logic"
```

---

## Task 4: Create M365 Activity API Route Tests

**Files:**
- Create: `src/app/api/m365/activity/route.test.ts`

**Step 1: Create test file with mocks**

```typescript
// src/app/api/m365/activity/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";

// Use vi.hoisted() to create mocks
const { mockGetServerSession } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
}));

// Mock global fetch for Graph API calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

// Import route after mocks are set up
import { GET } from "./route";

describe("GET /api/m365/activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const request = createMockRequest({
      method: "GET",
      url: "/api/m365/activity?date=2024-12-20",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 401 with SESSION_EXPIRED when token refresh failed", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: "test@example.com" },
      error: "RefreshTokenError",
    });

    const request = createMockRequest({
      method: "GET",
      url: "/api/m365/activity?date=2024-12-20",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Session expired. Please refresh the page.");
    expect(data.code).toBe("SESSION_EXPIRED");
  });

  it("returns 401 when no access token available", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: "test@example.com" },
      accessToken: undefined,
    });

    const request = createMockRequest({
      method: "GET",
      url: "/api/m365/activity?date=2024-12-20",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No access token available");
  });

  it("returns 400 when date parameter is missing", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: "test@example.com" },
      accessToken: "valid-token",
    });

    const request = createMockRequest({
      method: "GET",
      url: "/api/m365/activity",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Date parameter is required");
  });

  it("returns 400 when date parameter is invalid", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: "test@example.com" },
      accessToken: "valid-token",
    });

    const request = createMockRequest({
      method: "GET",
      url: "/api/m365/activity?date=invalid-date",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid date format. Use YYYY-MM-DD");
  });

  it("returns calendar events and emails for valid date", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: "test@example.com" },
      accessToken: "valid-token",
    });

    // Mock Graph API responses
    mockFetch
      // Calendar response
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              subject: "Client Meeting",
              start: { dateTime: "2024-12-20T09:00:00", timeZone: "UTC" },
              end: { dateTime: "2024-12-20T10:00:00", timeZone: "UTC" },
              attendees: [
                { emailAddress: { name: "John Doe", address: "john@client.com" } },
              ],
            },
          ],
        }),
      })
      // Sent emails response
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              subject: "Re: Contract Review",
              sentDateTime: "2024-12-20T11:30:00Z",
              toRecipients: [
                { emailAddress: { name: "Jane", address: "jane@client.com" } },
              ],
            },
          ],
        }),
      })
      // Received emails response
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            {
              subject: "Q3 Update",
              receivedDateTime: "2024-12-20T14:00:00Z",
              from: { emailAddress: { name: "Boss", address: "boss@firm.com" } },
              toRecipients: [
                { emailAddress: { name: "Test", address: "test@example.com" } },
              ],
            },
          ],
        }),
      });

    const request = createMockRequest({
      method: "GET",
      url: "/api/m365/activity?date=2024-12-20",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.calendar).toHaveLength(1);
    expect(data.calendar[0].subject).toBe("Client Meeting");
    expect(data.calendar[0].durationMinutes).toBe(60);
    expect(data.calendar[0].attendees).toContain("John Doe");

    expect(data.emails).toHaveLength(2);
    const sentEmail = data.emails.find((e: { direction: string }) => e.direction === "sent");
    const receivedEmail = data.emails.find((e: { direction: string }) => e.direction === "received");
    expect(sentEmail.subject).toBe("Re: Contract Review");
    expect(receivedEmail.subject).toBe("Q3 Update");
  });

  it("handles Graph API errors gracefully", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: "test@example.com" },
      accessToken: "valid-token",
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: "Internal Server Error" } }),
    });

    const request = createMockRequest({
      method: "GET",
      url: "/api/m365/activity?date=2024-12-20",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(502);
    expect(data.error).toBe("Couldn't reach Microsoft 365. Try again.");
    expect(data.code).toBe("GRAPH_ERROR");
  });

  it("returns empty arrays when no data for date", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { email: "test@example.com" },
      accessToken: "valid-token",
    });

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: [] }) });

    const request = createMockRequest({
      method: "GET",
      url: "/api/m365/activity?date=2024-12-20",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.calendar).toEqual([]);
    expect(data.emails).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd app && npm run test -- route.test.ts --run 2>&1 | head -50`
Expected: FAIL - module not found (route doesn't exist yet)

**Step 3: Commit test file**

```bash
git add src/app/api/m365/activity/route.test.ts
git commit -m "test(m365): add API route tests for M365 activity"
```

---

## Task 5: Implement M365 Activity API Route

**Files:**
- Create: `src/app/api/m365/activity/route.ts`

**Step 1: Create the API route**

```typescript
// src/app/api/m365/activity/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { M365ActivityResponse, M365CalendarEvent, M365Email } from "@/types";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

interface GraphCalendarEvent {
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees: Array<{
    emailAddress: { name: string; address: string };
  }>;
}

interface GraphEmail {
  subject: string;
  sentDateTime?: string;
  receivedDateTime?: string;
  from?: { emailAddress: { name: string; address: string } };
  toRecipients: Array<{
    emailAddress: { name: string; address: string };
  }>;
}

function isValidDateFormat(date: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(date)) return false;
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

function calculateDurationMinutes(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
}

async function fetchCalendarEvents(
  accessToken: string,
  date: string
): Promise<M365CalendarEvent[]> {
  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59`;

  const url = new URL(`${GRAPH_BASE_URL}/me/calendarView`);
  url.searchParams.set("startDateTime", startOfDay);
  url.searchParams.set("endDateTime", endOfDay);
  url.searchParams.set("$select", "subject,start,end,attendees");
  url.searchParams.set("$orderby", "start/dateTime");

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Calendar API error: ${response.status}`);
  }

  const data = await response.json();
  const events: GraphCalendarEvent[] = data.value || [];

  return events.map((event) => ({
    subject: event.subject || "(No subject)",
    start: event.start.dateTime,
    durationMinutes: calculateDurationMinutes(event.start.dateTime, event.end.dateTime),
    attendees: event.attendees?.map((a) => a.emailAddress.name || a.emailAddress.address) || [],
  }));
}

async function fetchSentEmails(
  accessToken: string,
  date: string
): Promise<M365Email[]> {
  const startOfDay = `${date}T00:00:00Z`;
  const endOfDay = `${date}T23:59:59Z`;

  const url = new URL(`${GRAPH_BASE_URL}/me/mailFolders/SentItems/messages`);
  url.searchParams.set("$filter", `sentDateTime ge ${startOfDay} and sentDateTime lt ${endOfDay}`);
  url.searchParams.set("$select", "subject,sentDateTime,toRecipients");
  url.searchParams.set("$orderby", "sentDateTime desc");
  url.searchParams.set("$top", "50");

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Sent mail API error: ${response.status}`);
  }

  const data = await response.json();
  const emails: GraphEmail[] = data.value || [];

  return emails.map((email) => ({
    subject: email.subject || "(No subject)",
    timestamp: email.sentDateTime!,
    from: "me",
    to: email.toRecipients?.map((r) => r.emailAddress.name || r.emailAddress.address) || [],
    direction: "sent" as const,
  }));
}

async function fetchReceivedEmails(
  accessToken: string,
  date: string
): Promise<M365Email[]> {
  const startOfDay = `${date}T00:00:00Z`;
  const endOfDay = `${date}T23:59:59Z`;

  const url = new URL(`${GRAPH_BASE_URL}/me/mailFolders/Inbox/messages`);
  url.searchParams.set("$filter", `receivedDateTime ge ${startOfDay} and receivedDateTime lt ${endOfDay}`);
  url.searchParams.set("$select", "subject,receivedDateTime,from,toRecipients");
  url.searchParams.set("$orderby", "receivedDateTime desc");
  url.searchParams.set("$top", "50");

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Inbox API error: ${response.status}`);
  }

  const data = await response.json();
  const emails: GraphEmail[] = data.value || [];

  return emails.map((email) => ({
    subject: email.subject || "(No subject)",
    timestamp: email.receivedDateTime!,
    from: email.from?.emailAddress.name || email.from?.emailAddress.address || "Unknown",
    to: email.toRecipients?.map((r) => r.emailAddress.name || r.emailAddress.address) || [],
    direction: "received" as const,
  }));
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.error === "RefreshTokenError") {
      return NextResponse.json(
        { error: "Session expired. Please refresh the page.", code: "SESSION_EXPIRED" },
        { status: 401 }
      );
    }

    if (!session.accessToken) {
      return NextResponse.json(
        { error: "No access token available" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        { error: "Date parameter is required" },
        { status: 400 }
      );
    }

    if (!isValidDateFormat(date)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Fetch all data in parallel
    const [calendar, sentEmails, receivedEmails] = await Promise.all([
      fetchCalendarEvents(session.accessToken, date),
      fetchSentEmails(session.accessToken, date),
      fetchReceivedEmails(session.accessToken, date),
    ]);

    // Merge and sort emails by timestamp
    const emails = [...sentEmails, ...receivedEmails].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const response: M365ActivityResponse = { calendar, emails };
    return NextResponse.json(response);
  } catch (error) {
    console.error("M365 activity error:", error);
    return NextResponse.json(
      { error: "Couldn't reach Microsoft 365. Try again.", code: "GRAPH_ERROR" },
      { status: 502 }
    );
  }
}
```

**Step 2: Run tests to verify they pass**

Run: `cd app && npm run test -- route.test.ts --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/app/api/m365/activity/route.ts
git commit -m "feat(m365): implement API route for M365 activity"
```

---

## Task 6: Create M365ActivityPanel Component Tests

**Files:**
- Create: `src/components/timesheets/M365ActivityPanel.test.tsx`

**Step 1: Create component test file**

```typescript
// src/components/timesheets/M365ActivityPanel.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { M365ActivityPanel } from "./M365ActivityPanel";
import type { M365ActivityResponse } from "@/types";

const mockData: M365ActivityResponse = {
  calendar: [
    {
      subject: "Client Meeting",
      start: "2024-12-20T09:00:00",
      durationMinutes: 60,
      attendees: ["John Doe", "jane@client.com"],
    },
    {
      subject: "Internal Standup",
      start: "2024-12-20T11:30:00",
      durationMinutes: 15,
      attendees: ["team@veda.uk"],
    },
  ],
  emails: [
    {
      subject: "Re: Contract Review",
      timestamp: "2024-12-20T10:30:00Z",
      from: "me",
      to: ["john@client.com"],
      direction: "sent",
    },
    {
      subject: "Q3 Update",
      timestamp: "2024-12-20T14:00:00Z",
      from: "boss@firm.com",
      to: ["test@example.com"],
      direction: "received",
    },
  ],
};

describe("M365ActivityPanel", () => {
  it("renders calendar events with subject, time, duration, and attendees", () => {
    render(
      <M365ActivityPanel
        data={mockData}
        isLoading={false}
        error={null}
        onClose={() => {}}
        date="2024-12-20"
      />
    );

    expect(screen.getByText("Client Meeting")).toBeInTheDocument();
    expect(screen.getByText("(1hr)")).toBeInTheDocument();
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();

    expect(screen.getByText("Internal Standup")).toBeInTheDocument();
    expect(screen.getByText("(15min)")).toBeInTheDocument();
  });

  it("renders sent emails with arrow up icon and recipients", () => {
    render(
      <M365ActivityPanel
        data={mockData}
        isLoading={false}
        error={null}
        onClose={() => {}}
        date="2024-12-20"
      />
    );

    expect(screen.getByText("Re: Contract Review")).toBeInTheDocument();
    expect(screen.getByText(/To: john@client.com/)).toBeInTheDocument();
  });

  it("renders received emails with arrow down icon and sender", () => {
    render(
      <M365ActivityPanel
        data={mockData}
        isLoading={false}
        error={null}
        onClose={() => {}}
        date="2024-12-20"
      />
    );

    expect(screen.getByText("Q3 Update")).toBeInTheDocument();
    expect(screen.getByText(/From: boss@firm.com/)).toBeInTheDocument();
  });

  it("shows loading state while fetching", () => {
    render(
      <M365ActivityPanel
        data={null}
        isLoading={true}
        error={null}
        onClose={() => {}}
        date="2024-12-20"
      />
    );

    expect(screen.getByText("Loading M365 activity...")).toBeInTheDocument();
  });

  it("shows error message on failure", () => {
    render(
      <M365ActivityPanel
        data={null}
        isLoading={false}
        error="Couldn't reach Microsoft 365. Try again."
        onClose={() => {}}
        date="2024-12-20"
      />
    );

    expect(screen.getByText("Couldn't reach Microsoft 365. Try again.")).toBeInTheDocument();
  });

  it("shows empty state when no data", () => {
    render(
      <M365ActivityPanel
        data={{ calendar: [], emails: [] }}
        isLoading={false}
        error={null}
        onClose={() => {}}
        date="2024-12-20"
      />
    );

    expect(screen.getByText(/No M365 activity found/)).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <M365ActivityPanel
        data={mockData}
        isLoading={false}
        error={null}
        onClose={onClose}
        date="2024-12-20"
      />
    );

    await user.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd app && npm run test -- M365ActivityPanel.test.tsx --run 2>&1 | head -20`
Expected: FAIL - module not found

**Step 3: Commit test file**

```bash
git add src/components/timesheets/M365ActivityPanel.test.tsx
git commit -m "test(m365): add M365ActivityPanel component tests"
```

---

## Task 7: Implement M365ActivityPanel Component

**Files:**
- Create: `src/components/timesheets/M365ActivityPanel.tsx`

**Step 1: Create the component**

```typescript
// src/components/timesheets/M365ActivityPanel.tsx
"use client";

import type { M365ActivityResponse } from "@/types";

interface M365ActivityPanelProps {
  data: M365ActivityResponse | null;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
  date: string;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `(${minutes}min)`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `(${hours}hr)`;
  }
  return `(${hours}hr ${mins}min)`;
}

function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function M365ActivityPanel({
  data,
  isLoading,
  error,
  onClose,
  date,
}: M365ActivityPanelProps) {
  const isEmpty = data && data.calendar.length === 0 && data.emails.length === 0;

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-[13px] font-medium text-[var(--text-primary)]">
            M365 Activity for {formatDateDisplay(date)}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-all duration-200"
          aria-label="Close panel"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8 text-[var(--text-muted)] text-[13px]">
          <svg className="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading M365 activity...
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="flex items-center justify-center py-8 text-[var(--danger)] text-[13px]">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Empty State */}
      {isEmpty && !isLoading && !error && (
        <div className="flex items-center justify-center py-8 text-[var(--text-muted)] text-[13px]">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          No M365 activity found for {formatDateDisplay(date)}.
        </div>
      )}

      {/* Data Display */}
      {data && !isEmpty && !isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Calendar Column */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <svg className="w-3.5 h-3.5 text-[var(--info)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                Calendar ({data.calendar.length})
              </span>
            </div>
            <div className="space-y-2">
              {data.calendar.map((event, index) => (
                <div key={index} className="text-[12px]">
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--text-muted)] font-mono w-10 flex-shrink-0">
                      {formatTime(event.start)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[var(--text-primary)] truncate">{event.subject}</span>
                        <span className="text-[var(--text-muted)] flex-shrink-0">
                          {formatDuration(event.durationMinutes)}
                        </span>
                      </div>
                      {event.attendees.length > 0 && (
                        <div className="text-[var(--text-muted)] text-[11px] truncate">
                          with: {event.attendees.join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {data.calendar.length === 0 && (
                <div className="text-[12px] text-[var(--text-muted)] italic">No calendar events</div>
              )}
            </div>
          </div>

          {/* Emails Column */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <svg className="w-3.5 h-3.5 text-[var(--info)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                Emails ({data.emails.length})
              </span>
            </div>
            <div className="space-y-2">
              {data.emails.map((email, index) => (
                <div key={index} className="text-[12px] flex items-start gap-2">
                  {/* Direction Arrow */}
                  <span className={`flex-shrink-0 ${email.direction === "sent" ? "text-[var(--success)]" : "text-[var(--info)]"}`}>
                    {email.direction === "sent" ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                      </svg>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[var(--text-muted)] text-[11px]">
                      {email.direction === "sent"
                        ? `To: ${email.to.join(", ")}`
                        : `From: ${email.from}`}
                    </div>
                    <div className="text-[var(--text-primary)] truncate">{email.subject}</div>
                  </div>
                </div>
              ))}
              {data.emails.length === 0 && (
                <div className="text-[12px] text-[var(--text-muted)] italic">No emails</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Run tests to verify they pass**

Run: `cd app && npm run test -- M365ActivityPanel.test.tsx --run`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/components/timesheets/M365ActivityPanel.tsx
git commit -m "feat(m365): implement M365ActivityPanel component"
```

---

## Task 8: Update WeekStrip with M365 Button

**Files:**
- Modify: `src/components/timesheets/WeekStrip.tsx`

**Step 1: Add props for M365 button state**

Update the interface at the top of the file:

```typescript
interface WeekStripProps {
  selectedDate: Date;
  today: Date;
  datesWithEntries: Set<string>;
  onSelectDate: (date: Date) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToToday: () => void;
  // M365 Activity
  onFetchM365Activity: () => void;
  isM365Loading: boolean;
  isM365PanelOpen: boolean;
}
```

**Step 2: Destructure new props in component**

```typescript
export function WeekStrip({
  selectedDate,
  today,
  datesWithEntries,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  onGoToToday,
  onFetchM365Activity,
  isM365Loading,
  isM365PanelOpen,
}: WeekStripProps) {
```

**Step 3: Restructure right-side controls to 2-row layout**

Replace the calendar/today section (after the divider) with:

```typescript
{/* Calendar Picker & Today & M365 */}
<div className="flex flex-col gap-1.5">
  {/* Top row: Calendar + Today */}
  <div className="flex items-center gap-2">
    <div className="relative" ref={calendarRef}>
      {/* Calendar Icon Button */}
      <button
        onClick={handleCalendarOpen}
        className="p-1.5 rounded text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)] transition-all duration-200"
        title="Open calendar"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Mini Calendar Popup - keep existing code */}
      {isCalendarOpen && (
        // ... existing calendar popup code unchanged
      )}
    </div>

    <button
      onClick={onGoToToday}
      className="px-2 py-1 rounded text-[12px] font-medium text-[var(--accent-pink)] bg-[var(--accent-pink-glow)] border border-[var(--border-accent)] hover:bg-[var(--accent-pink)] hover:text-[var(--bg-deep)] transition-all duration-200"
    >
      Today
    </button>
  </div>

  {/* Bottom row: M365 Activity */}
  <button
    onClick={onFetchM365Activity}
    disabled={isM365Loading}
    className={`
      flex items-center justify-center gap-1.5 px-2 py-1 rounded text-[12px] font-medium
      transition-all duration-200
      ${isM365PanelOpen
        ? "bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-accent)]"
        : "text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]"
      }
      ${isM365Loading ? "opacity-60 cursor-not-allowed" : ""}
    `}
    title="Fetch calendar and email activity from Microsoft 365"
  >
    {isM365Loading ? (
      <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    ) : (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )}
    <span>M365</span>
  </button>
</div>
```

**Step 4: Verify build passes**

Run: `cd app && npm run build`
Expected: Build fails (TimesheetsContent doesn't pass new props yet - that's expected)

**Step 5: Commit**

```bash
git add src/components/timesheets/WeekStrip.tsx
git commit -m "feat(m365): add M365 Activity button to WeekStrip"
```

---

## Task 9: Integrate M365 Panel into TimesheetsContent

**Files:**
- Modify: `src/components/timesheets/TimesheetsContent.tsx`

**Step 1: Add imports**

At the top, add:

```typescript
import { M365ActivityPanel } from "./M365ActivityPanel";
import type { M365ActivityResponse } from "@/types";
```

**Step 2: Add state for M365 panel**

After the existing state declarations, add:

```typescript
// M365 Activity state
const [isM365PanelOpen, setIsM365PanelOpen] = useState(false);
const [isM365Loading, setIsM365Loading] = useState(false);
const [m365Data, setM365Data] = useState<M365ActivityResponse | null>(null);
const [m365Error, setM365Error] = useState<string | null>(null);
```

**Step 3: Add fetch function**

After the existing fetch functions, add:

```typescript
// Fetch M365 activity for selected date
const fetchM365Activity = useCallback(async () => {
  setIsM365Loading(true);
  setM365Error(null);
  setIsM365PanelOpen(true);

  try {
    const response = await fetch(`/api/m365/activity?date=${formatDateISO(selectedDate)}`);
    const data = await response.json();

    if (!response.ok) {
      setM365Error(data.error || "Failed to fetch M365 activity");
      setM365Data(null);
      return;
    }

    setM365Data(data);
  } catch {
    setM365Error("Connection failed. Check your internet.");
    setM365Data(null);
  } finally {
    setIsM365Loading(false);
  }
}, [selectedDate]);

// Close M365 panel
const closeM365Panel = useCallback(() => {
  setIsM365PanelOpen(false);
  setM365Data(null);
  setM365Error(null);
}, []);
```

**Step 4: Close panel on date change**

In the existing `useEffect` that handles date change (around line 69), add:

```typescript
// Fetch on date change
useEffect(() => {
  fetchEntries(selectedDate);
  // Close M365 panel when date changes
  setIsM365PanelOpen(false);
  setM365Data(null);
  setM365Error(null);
}, [selectedDate, fetchEntries]);
```

**Step 5: Update WeekStrip props**

Update the `<WeekStrip />` component to pass new props:

```typescript
<WeekStrip
  selectedDate={selectedDate}
  today={today}
  datesWithEntries={datesWithEntries}
  onSelectDate={setSelectedDate}
  onPrevWeek={goToPrevWeek}
  onNextWeek={goToNextWeek}
  onGoToToday={goToToday}
  onFetchM365Activity={fetchM365Activity}
  isM365Loading={isM365Loading}
  isM365PanelOpen={isM365PanelOpen}
/>
```

**Step 6: Add M365ActivityPanel between WeekStrip and EntryForm**

After `</WeekStrip>` and before `<EntryForm>`, add:

```typescript
{/* M365 Activity Panel */}
{isM365PanelOpen && (
  <M365ActivityPanel
    data={m365Data}
    isLoading={isM365Loading}
    error={m365Error}
    onClose={closeM365Panel}
    date={formatDateISO(selectedDate)}
  />
)}
```

**Step 7: Run tests to verify everything passes**

Run: `cd app && npm run test -- --run`
Expected: All tests pass

**Step 8: Verify build passes**

Run: `cd app && npm run build`
Expected: Build succeeds

**Step 9: Commit**

```bash
git add src/components/timesheets/TimesheetsContent.tsx
git commit -m "feat(m365): integrate M365 activity panel into timesheets page"
```

---

## Task 10: Manual Testing Checklist

**Note:** These steps require a running dev server and valid Azure AD configuration.

**Step 1: Start dev server**

Run: `cd app && npm run dev`

**Step 2: Test authentication flow**

1. Log out if already logged in
2. Log in via Microsoft 365
3. Should see consent prompt for Calendar and Mail permissions (first time only)
4. Verify login succeeds

**Step 3: Test M365 button**

1. Navigate to Timesheets page
2. Verify M365 button appears below Today button
3. Click M365 button
4. Verify loading spinner appears
5. Verify panel opens with calendar/email data

**Step 4: Test date navigation**

1. With panel open, click a different day
2. Verify panel closes
3. Click M365 button again
4. Verify data loads for new date

**Step 5: Test empty state**

1. Navigate to a date with no activity (e.g., a weekend)
2. Click M365 button
3. Verify empty state message appears

**Step 6: Test close button**

1. With panel open, click X button
2. Verify panel closes

**Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix(m365): address issues found during manual testing"
```

---

## Task 11: Final Verification

**Step 1: Run all tests**

Run: `cd app && npm run test -- --run`
Expected: All tests pass

**Step 2: Run linter**

Run: `cd app && npm run lint`
Expected: No errors

**Step 3: Run build**

Run: `cd app && npm run build`
Expected: Build succeeds

**Step 4: Create final commit if needed**

```bash
git status
# If any uncommitted changes:
git add -A
git commit -m "chore: final cleanup for M365 activity feature"
```

---

## Summary of Changes

| File | Action | Description |
|------|--------|-------------|
| `src/types/m365.ts` | Create | Type definitions for M365 activity |
| `src/types/index.ts` | Modify | Export M365 types |
| `src/types/next-auth.d.ts` | Create | NextAuth type extensions for access token |
| `src/lib/auth.ts` | Modify | Add scopes, implement token refresh |
| `src/app/api/m365/activity/route.ts` | Create | API endpoint for Graph API calls |
| `src/app/api/m365/activity/route.test.ts` | Create | API endpoint tests |
| `src/components/timesheets/M365ActivityPanel.tsx` | Create | Collapsible panel component |
| `src/components/timesheets/M365ActivityPanel.test.tsx` | Create | Panel component tests |
| `src/components/timesheets/WeekStrip.tsx` | Modify | Add M365 button, 2-row layout |
| `src/components/timesheets/TimesheetsContent.tsx` | Modify | Integrate panel, manage state |
