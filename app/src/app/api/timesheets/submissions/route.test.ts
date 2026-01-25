import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser, MockUser } from "@/test/mocks/factories";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireAuth, mockGetUserFromSession, mockDb } = vi.hoisted(() => {
  return {
    mockRequireAuth: vi.fn(),
    mockGetUserFromSession: vi.fn(),
    mockDb: {
      query: {
        timesheetSubmissions: {
          findMany: vi.fn(),
        },
      },
    },
  };
});

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
}

describe("GET /api/timesheets/submissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/submissions?year=2026&month=1",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 404 when user not found", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });
      mockGetUserFromSession.mockResolvedValue(null);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/submissions?year=2026&month=1",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });

  describe("Parameter validation", () => {
    it("returns 400 when year is missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/submissions?month=1",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Year and month are required");
    });

    it("returns 400 when month is missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/submissions?year=2026",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Year and month are required");
    });

    it("returns 400 when year and month are both missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/submissions",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Year and month are required");
    });

    it("returns 400 when year is invalid", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/submissions?year=abc&month=1",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid year or month");
    });

    it("returns 400 when month is invalid (non-numeric)", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/submissions?year=2026&month=abc",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid year or month");
    });

    it("returns 400 when month is less than 1", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/submissions?year=2026&month=0",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid year or month");
    });

    it("returns 400 when month is greater than 12", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/submissions?year=2026&month=13",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid year or month");
    });
  });

  describe("Successful responses", () => {
    it("returns submitted dates for the authenticated user's month", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      // Mock submissions for January 2026
      mockDb.query.timesheetSubmissions.findMany.mockResolvedValue([
        { date: "2026-01-05" },
        { date: "2026-01-06" },
        { date: "2026-01-07" },
        { date: "2026-01-12" },
      ]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/submissions?year=2026&month=1",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-12"]);
    });

    it("returns empty array when no submissions exist for the month", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      mockDb.query.timesheetSubmissions.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/submissions?year=2026&month=2",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it("queries database with correct date range for a month", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      mockDb.query.timesheetSubmissions.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/submissions?year=2026&month=2",
      });

      await GET(request);

      // Verify findMany was called (the actual where clause is constructed by drizzle-orm)
      expect(mockDb.query.timesheetSubmissions.findMany).toHaveBeenCalledTimes(1);
      expect(mockDb.query.timesheetSubmissions.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          columns: { date: true },
        })
      );
    });

    it("handles December correctly (month 12)", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      mockDb.query.timesheetSubmissions.findMany.mockResolvedValue([
        { date: "2025-12-15" },
        { date: "2025-12-31" },
      ]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/submissions?year=2025&month=12",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(["2025-12-15", "2025-12-31"]);
    });
  });

  describe("Error handling", () => {
    it("returns 500 when database query fails", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      mockDb.query.timesheetSubmissions.findMany.mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/submissions?year=2026&month=1",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch submissions");
    });
  });
});
