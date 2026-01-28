import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser, MockUser } from "@/test/mocks/factories";

const { mockRequireAuth, mockGetUserFromSession, mockDb } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockGetUserFromSession: vi.fn(),
  mockDb: {
    query: {
      leavePeriods: {
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
  };
});

import { GET } from "./route";

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

describe("GET /api/leave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({ method: "GET", url: "/api/leave" });
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

      const request = createMockRequest({ method: "GET", url: "/api/leave" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });

  describe("Regular user access", () => {
    it("returns own leave periods for regular user", async () => {
      const user = createMockUser({ position: "ASSOCIATE" });
      setupAuthenticatedUser(user);

      const mockLeave = [{
        id: "leave-1",
        userId: user.id,
        startDate: "2024-12-23",
        endDate: "2024-12-27",
        leaveType: "VACATION",
        status: "APPROVED",
        reason: "Holiday break",
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,
        createdAt: "2024-12-01T10:00:00.000Z",
        updatedAt: "2024-12-01T10:00:00.000Z",
        user: { name: user.name },
        reviewedBy: null,
      }];
      mockDb.query.leavePeriods.findMany.mockResolvedValue(mockLeave);

      const request = createMockRequest({ method: "GET", url: "/api/leave" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.leavePeriods).toHaveLength(1);
      expect(data.leavePeriods[0].id).toBe("leave-1");
      expect(data.leavePeriods[0].userName).toBe(user.name);
    });
  });

  describe("Admin access", () => {
    it("returns all leave periods for admin", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);

      const mockLeave = [
        { id: "leave-1", userId: "user-1", user: { name: "User 1" }, reviewedBy: null, startDate: "2024-12-23", endDate: "2024-12-27", leaveType: "VACATION", status: "PENDING", reason: null, reviewedById: null, reviewedAt: null, rejectionReason: null, createdAt: "2024-12-01T10:00:00.000Z", updatedAt: "2024-12-01T10:00:00.000Z" },
        { id: "leave-2", userId: "user-2", user: { name: "User 2" }, reviewedBy: null, startDate: "2024-12-20", endDate: "2024-12-21", leaveType: "SICK_LEAVE", status: "APPROVED", reason: null, reviewedById: null, reviewedAt: null, rejectionReason: null, createdAt: "2024-12-02T10:00:00.000Z", updatedAt: "2024-12-02T10:00:00.000Z" },
      ];
      mockDb.query.leavePeriods.findMany.mockResolvedValue(mockLeave);

      const request = createMockRequest({ method: "GET", url: "/api/leave" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.leavePeriods).toHaveLength(2);
    });

    it("returns all leave periods for partner", async () => {
      const user = createMockUser({ position: "PARTNER" });
      setupAuthenticatedUser(user);

      const mockLeave = [
        { id: "leave-1", userId: "user-1", user: { name: "User 1" }, reviewedBy: null, startDate: "2024-12-23", endDate: "2024-12-27", leaveType: "VACATION", status: "PENDING", reason: null, reviewedById: null, reviewedAt: null, rejectionReason: null, createdAt: "2024-12-01T10:00:00.000Z", updatedAt: "2024-12-01T10:00:00.000Z" },
      ];
      mockDb.query.leavePeriods.findMany.mockResolvedValue(mockLeave);

      const request = createMockRequest({ method: "GET", url: "/api/leave" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.leavePeriods).toHaveLength(1);
    });
  });

  describe("Query parameters", () => {
    it("filters by status when provided", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);

      const mockLeave = [
        { id: "leave-1", userId: "user-1", user: { name: "User 1" }, reviewedBy: null, startDate: "2024-12-23", endDate: "2024-12-27", leaveType: "VACATION", status: "PENDING", reason: null, reviewedById: null, reviewedAt: null, rejectionReason: null, createdAt: "2024-12-01T10:00:00.000Z", updatedAt: "2024-12-01T10:00:00.000Z" },
      ];
      mockDb.query.leavePeriods.findMany.mockResolvedValue(mockLeave);

      const request = createMockRequest({ method: "GET", url: "/api/leave?status=PENDING" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.leavePeriods).toHaveLength(1);
      // Verify findMany was called (status filter is applied in the where clause)
      expect(mockDb.query.leavePeriods.findMany).toHaveBeenCalled();
    });

    it("filters by userId when admin provides it", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);

      const mockLeave = [
        { id: "leave-1", userId: "specific-user", user: { name: "Specific User" }, reviewedBy: null, startDate: "2024-12-23", endDate: "2024-12-27", leaveType: "VACATION", status: "PENDING", reason: null, reviewedById: null, reviewedAt: null, rejectionReason: null, createdAt: "2024-12-01T10:00:00.000Z", updatedAt: "2024-12-01T10:00:00.000Z" },
      ];
      mockDb.query.leavePeriods.findMany.mockResolvedValue(mockLeave);

      const request = createMockRequest({ method: "GET", url: "/api/leave?userId=specific-user" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.leavePeriods).toHaveLength(1);
      expect(mockDb.query.leavePeriods.findMany).toHaveBeenCalled();
    });
  });

  describe("Response transformation", () => {
    it("includes reviewedBy name when available", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);

      const mockLeave = [{
        id: "leave-1",
        userId: "user-1",
        startDate: "2024-12-23",
        endDate: "2024-12-27",
        leaveType: "VACATION",
        status: "APPROVED",
        reason: "Holiday break",
        reviewedById: "admin-1",
        reviewedAt: "2024-12-05T10:00:00.000Z",
        rejectionReason: null,
        createdAt: "2024-12-01T10:00:00.000Z",
        updatedAt: "2024-12-05T10:00:00.000Z",
        user: { name: "Employee Name" },
        reviewedBy: { name: "Admin Name" },
      }];
      mockDb.query.leavePeriods.findMany.mockResolvedValue(mockLeave);

      const request = createMockRequest({ method: "GET", url: "/api/leave" });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.leavePeriods[0].userName).toBe("Employee Name");
      expect(data.leavePeriods[0].reviewedByName).toBe("Admin Name");
    });
  });
});
