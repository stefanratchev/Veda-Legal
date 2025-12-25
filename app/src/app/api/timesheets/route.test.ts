import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import {
  createMockUser,
  createMockTimeEntry,
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
});
