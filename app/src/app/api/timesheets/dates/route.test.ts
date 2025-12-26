import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser, MockUser } from "@/test/mocks/factories";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireAuth, mockGetUserFromSession, mockDb } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockGetUserFromSession: vi.fn(),
  mockDb: {
    selectDistinct: vi.fn(),
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

// Helper to set up selectDistinct mock chain
function setupSelectDistinctMock(dates: { date: string }[]) {
  mockDb.selectDistinct.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(dates),
    }),
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
      setupSelectDistinctMock([
        { date: "2024-12-05" },
        { date: "2024-12-10" },
        { date: "2024-12-15" },
      ]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/dates?year=2024&month=12",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toEqual(["2024-12-05", "2024-12-10", "2024-12-15"]);
    });

    it("returns empty array when no entries", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      setupSelectDistinctMock([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/dates?year=2024&month=12",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });
  });
});
