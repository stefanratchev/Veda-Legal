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

// Helper to create params as Promise (Next.js 15+ pattern)
function createParams(userId: string): Promise<{ userId: string }> {
  return Promise.resolve({ userId });
}

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
      expect(data.error).toBe("You don't have permission to view team timesheets");
    });

    it("allows ADMIN to view team entries", async () => {
      const user = createMockUser({ position: "ADMIN" });
      const entries = [
        createMockTimeEntry({ userId: "team-member-1", hours: "2.5" }),
      ];

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/team/team-member-1?date=2024-12-20",
      });

      const response = await GET(request, { params: createParams("team-member-1") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it("allows PARTNER to view team entries", async () => {
      const user = createMockUser({ position: "PARTNER" });
      const entries = [
        createMockTimeEntry({ userId: "team-member-1", hours: "3.0" }),
      ];

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/team/team-member-1?date=2024-12-20",
      });

      const response = await GET(request, { params: createParams("team-member-1") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
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
      const teamMemberId = "team-member-1";
      const entries = [
        createMockTimeEntry({ userId: teamMemberId, hours: "2.5" }),
        createMockTimeEntry({ userId: teamMemberId, hours: "1.0" }),
      ];

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: `/api/timesheets/team/${teamMemberId}?date=2024-12-20`,
      });

      const response = await GET(request, { params: createParams(teamMemberId) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      expect(data[0].hours).toBe(2.5);
      expect(data[1].hours).toBe(1);
    });

    it("returns entries with client details", async () => {
      const user = createMockUser({ position: "ADMIN" });
      const teamMemberId = "team-member-1";
      const entries = [
        createMockTimeEntry({
          userId: teamMemberId,
          client: { id: "client-1", name: "Acme Corp" },
        }),
      ];

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: `/api/timesheets/team/${teamMemberId}?date=2024-12-20`,
      });

      const response = await GET(request, { params: createParams(teamMemberId) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data[0].client).toEqual({ id: "client-1", name: "Acme Corp" });
    });

    it("returns empty array when no entries", async () => {
      const user = createMockUser({ position: "ADMIN" });
      const teamMemberId = "team-member-1";

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: `/api/timesheets/team/${teamMemberId}?date=2024-12-20`,
      });

      const response = await GET(request, { params: createParams(teamMemberId) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });
  });
});
