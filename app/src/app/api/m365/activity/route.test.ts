import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockGetServerSession, mockFetch } = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

// Mock global fetch for Graph API calls
vi.stubGlobal("fetch", mockFetch);

// Import route after mocks are set up
import { GET } from "./route";

describe("GET /api/m365/activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
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
        user: { email: "test@example.com", name: "Test User" },
        error: "RefreshTokenError",
      });

      const request = createMockRequest({
        method: "GET",
        url: "/api/m365/activity?date=2024-12-20",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Session expired. Please sign in again.");
      expect(data.code).toBe("SESSION_EXPIRED");
    });

    it("returns 401 when no access token available", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "test@example.com", name: "Test User" },
        // accessToken is undefined
      });

      const request = createMockRequest({
        method: "GET",
        url: "/api/m365/activity?date=2024-12-20",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("No access token available. Please sign in again.");
      expect(data.code).toBe("NO_ACCESS_TOKEN");
    });
  });

  describe("Validation", () => {
    it("returns 400 when date parameter is missing", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "test@example.com", name: "Test User" },
        accessToken: "valid-access-token",
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
        user: { email: "test@example.com", name: "Test User" },
        accessToken: "valid-access-token",
      });

      const request = createMockRequest({
        method: "GET",
        url: "/api/m365/activity?date=not-a-date",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid date format");
    });
  });

  describe("Happy Path", () => {
    it("returns calendar events and emails for valid date", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "test@example.com", name: "Test User" },
        accessToken: "valid-access-token",
      });

      // Mock calendar events response (Graph API returns dateTime WITHOUT Z suffix)
      const calendarEvents = {
        value: [
          {
            subject: "Client Meeting",
            start: { dateTime: "2024-12-20T10:00:00.0000000" },
            end: { dateTime: "2024-12-20T11:00:00.0000000" },
            attendees: [
              { emailAddress: { name: "John Doe", address: "john@example.com" } },
              { emailAddress: { name: "Jane Smith", address: "jane@example.com" } },
            ],
          },
          {
            subject: "Team Standup",
            start: { dateTime: "2024-12-20T09:00:00.0000000" },
            end: { dateTime: "2024-12-20T09:30:00.0000000" },
            attendees: [],
          },
        ],
      };

      // Mock inbox (received) emails response
      const inboxEmails = {
        value: [
          {
            subject: "Re: Contract Review",
            from: { emailAddress: { name: "Client A", address: "client@example.com" } },
            toRecipients: [{ emailAddress: { name: "Test User", address: "test@example.com" } }],
            receivedDateTime: "2024-12-20T14:30:00.000Z",
          },
        ],
      };

      // Mock sent emails response
      const sentEmails = {
        value: [
          {
            subject: "Invoice Attached",
            from: { emailAddress: { name: "Test User", address: "test@example.com" } },
            toRecipients: [{ emailAddress: { name: "Client B", address: "clientb@example.com" } }],
            sentDateTime: "2024-12-20T16:00:00.000Z",
          },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(calendarEvents),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(inboxEmails),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(sentEmails),
        });

      const request = createMockRequest({
        method: "GET",
        url: "/api/m365/activity?date=2024-12-20",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("calendar");
      expect(data).toHaveProperty("emails");
      expect(data.calendar).toHaveLength(2);
      expect(data.emails).toHaveLength(2);

      // Verify calendar event structure (M365CalendarEvent)
      // Z suffix should be appended by the route for unambiguous UTC parsing
      expect(data.calendar[0]).toHaveProperty("subject", "Client Meeting");
      expect(data.calendar[0]).toHaveProperty("start", "2024-12-20T10:00:00.0000000Z");
      expect(data.calendar[0]).toHaveProperty("durationMinutes", 60);
      expect(data.calendar[0]).toHaveProperty("attendees");
      expect(data.calendar[0].attendees).toEqual(["John Doe", "Jane Smith"]);

      // Verify email structure (M365Email)
      // Emails are sorted by timestamp, so received (14:30) comes before sent (16:00)
      expect(data.emails[0]).toHaveProperty("subject", "Re: Contract Review");
      expect(data.emails[0]).toHaveProperty("direction", "received");
      expect(data.emails[0]).toHaveProperty("from", "Client A");
      expect(data.emails[0]).toHaveProperty("to");
      expect(data.emails[0].to).toEqual(["Test User"]);

      expect(data.emails[1]).toHaveProperty("subject", "Invoice Attached");
      expect(data.emails[1]).toHaveProperty("direction", "sent");
    });

    it("returns empty arrays when no data for date", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "test@example.com", name: "Test User" },
        accessToken: "valid-access-token",
      });

      // Mock empty responses (calendar, inbox, sent)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ value: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ value: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ value: [] }),
        });

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

  describe("Timezone handling", () => {
    it("sends Prefer: outlook.timezone header on calendar request", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "test@example.com", name: "Test User" },
        accessToken: "valid-access-token",
      });

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ value: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ value: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ value: [] }) });

      const request = createMockRequest({
        method: "GET",
        url: "/api/m365/activity?date=2024-12-20",
      });

      await GET(request);

      // First fetch call is the calendar request
      const calendarCall = mockFetch.mock.calls[0];
      const calendarUrl = calendarCall[0] as string;
      const calendarOptions = calendarCall[1] as RequestInit;

      expect(calendarUrl).toContain("calendarView");
      expect(calendarOptions.headers).toHaveProperty("Prefer", 'outlook.timezone="UTC"');
    });

    it("uses Sofia-timezone-aligned date range for queries", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "test@example.com", name: "Test User" },
        accessToken: "valid-access-token",
      });

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ value: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ value: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ value: [] }) });

      const request = createMockRequest({
        method: "GET",
        url: "/api/m365/activity?date=2024-12-20",
      });

      await GET(request);

      // December = EET (UTC+2), so Sofia midnight = 22:00 UTC previous day
      const calendarUrl = mockFetch.mock.calls[0][0] as string;
      expect(calendarUrl).toContain("startDateTime=2024-12-19T22%3A00%3A00.000Z");
      expect(calendarUrl).toContain("endDateTime=2024-12-20T22%3A00%3A00.000Z");
    });

    it("appends Z suffix to calendar event start times from Graph API", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "test@example.com", name: "Test User" },
        accessToken: "valid-access-token",
      });

      const calendarEvents = {
        value: [
          {
            subject: "Meeting",
            start: { dateTime: "2024-12-20T10:00:00.0000000" },
            end: { dateTime: "2024-12-20T11:00:00.0000000" },
            attendees: [],
          },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(calendarEvents) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ value: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ value: [] }) });

      const request = createMockRequest({
        method: "GET",
        url: "/api/m365/activity?date=2024-12-20",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.calendar[0].start).toBe("2024-12-20T10:00:00.0000000Z");
    });

    it("does not double-append Z if already present", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "test@example.com", name: "Test User" },
        accessToken: "valid-access-token",
      });

      const calendarEvents = {
        value: [
          {
            subject: "Meeting",
            start: { dateTime: "2024-12-20T10:00:00.000Z" },
            end: { dateTime: "2024-12-20T11:00:00.000Z" },
            attendees: [],
          },
        ],
      };

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(calendarEvents) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ value: [] }) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ value: [] }) });

      const request = createMockRequest({
        method: "GET",
        url: "/api/m365/activity?date=2024-12-20",
      });

      const response = await GET(request);
      const data = await response.json();

      // Should NOT become "...ZZ"
      expect(data.calendar[0].start).toBe("2024-12-20T10:00:00.000Z");
    });
  });

  describe("Error Handling", () => {
    it("handles Graph API errors gracefully", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "test@example.com", name: "Test User" },
        accessToken: "valid-access-token",
      });

      // Mock Graph API error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: () => Promise.resolve({ error: { message: "Graph API error" } }),
      });

      const request = createMockRequest({
        method: "GET",
        url: "/api/m365/activity?date=2024-12-20",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch M365 activity data");
    });
  });
});
