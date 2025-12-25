import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import {
  createMockUser,
  MockUser,
} from "@/test/mocks/factories";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireAuth, mockGetUserFromSession, mockCanViewTeamTimesheets, mockDb } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockGetUserFromSession: vi.fn(),
  mockCanViewTeamTimesheets: vi.fn(),
  mockDb: {
    query: {
      timeEntries: {
        findMany: vi.fn(),
      },
    },
    select: vi.fn(),
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
