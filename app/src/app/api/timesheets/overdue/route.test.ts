import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser, MockUser } from "@/test/mocks/factories";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireAuth, mockGetUserFromSession, mockHasAdminAccess, mockRequiresTimesheetSubmission, mockDb } = vi.hoisted(() => {
  return {
    mockRequireAuth: vi.fn(),
    mockGetUserFromSession: vi.fn(),
    mockHasAdminAccess: vi.fn(),
    mockRequiresTimesheetSubmission: vi.fn(),
    mockDb: {
      query: {
        users: {
          findMany: vi.fn(),
        },
        timesheetSubmissions: {
          findMany: vi.fn(),
        },
        leavePeriods: {
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
    hasAdminAccess: mockHasAdminAccess,
    requiresTimesheetSubmission: mockRequiresTimesheetSubmission,
  };
});

// Import route after mocks are set up
import { GET } from "./route";

// Positions that require timesheet submission
const SUBMISSION_REQUIRED_POSITIONS = ["PARTNER", "SENIOR_ASSOCIATE", "ASSOCIATE"];

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
  // Mock requiresTimesheetSubmission based on position
  mockRequiresTimesheetSubmission.mockReturnValue(
    SUBMISSION_REQUIRED_POSITIONS.includes(user.position)
  );
}

describe("GET /api/timesheets/overdue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set time to Wednesday 2026-01-28 at 11:00 UTC
    // This means:
    // - Monday 2026-01-26 deadline passed (Tuesday 10am)
    // - Tuesday 2026-01-27 deadline passed (Wednesday 10am)
    // - Wednesday 2026-01-28 deadline NOT passed yet (Thursday 10am)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-28T11:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/overdue",
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
        url: "/api/timesheets/overdue",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });

  describe("Regular users", () => {
    it("returns own overdue dates only", async () => {
      const user = createMockUser({ position: "ASSOCIATE" });
      setupAuthenticatedUser(user);
      mockHasAdminAccess.mockReturnValue(false);

      // No submissions - user hasn't submitted anything
      mockDb.query.timesheetSubmissions.findMany.mockResolvedValue([]);
      // No leave periods
      mockDb.query.leavePeriods.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/overdue",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should include weekdays from past 30 days where deadline has passed
      // At 2026-01-28 11:00 UTC:
      // - Monday 2026-01-26 is overdue (deadline was Tuesday 10am)
      // - Tuesday 2026-01-27 is overdue (deadline was Wednesday 10am)
      // Plus all weekdays going back 30 days
      expect(data.overdue).toBeInstanceOf(Array);
      expect(data.overdue).toContain("2026-01-26");
      expect(data.overdue).toContain("2026-01-27");
      // Wednesday 2026-01-28 should NOT be included (deadline is Thursday 10am)
      expect(data.overdue).not.toContain("2026-01-28");
    });

    it("returns empty array when all submitted", async () => {
      const user = createMockUser({ position: "ASSOCIATE" });
      setupAuthenticatedUser(user);
      mockHasAdminAccess.mockReturnValue(false);

      // Generate submissions for all weekdays in the past 30 days
      const submissions = [];
      for (let i = 30; i >= 0; i--) {
        const date = new Date("2026-01-28");
        date.setDate(date.getDate() - i);
        const day = date.getDay();
        // Only weekdays
        if (day >= 1 && day <= 5) {
          submissions.push({
            id: `sub-${i}`,
            userId: user.id,
            date: date.toISOString().split("T")[0],
            submittedAt: "2026-01-28T10:00:00.000Z",
          });
        }
      }

      mockDb.query.timesheetSubmissions.findMany.mockResolvedValue(submissions);
      // No leave periods
      mockDb.query.leavePeriods.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/overdue",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.overdue).toEqual([]);
    });

    it("excludes dates that have been submitted", async () => {
      const user = createMockUser({ position: "ASSOCIATE" });
      setupAuthenticatedUser(user);
      mockHasAdminAccess.mockReturnValue(false);

      // User submitted Monday but not Tuesday
      mockDb.query.timesheetSubmissions.findMany.mockResolvedValue([
        {
          id: "sub-1",
          userId: user.id,
          date: "2026-01-26", // Monday
          submittedAt: "2026-01-27T09:00:00.000Z",
        },
      ]);
      // No leave periods
      mockDb.query.leavePeriods.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/overdue",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Monday is submitted, should not be in overdue
      expect(data.overdue).not.toContain("2026-01-26");
      // Tuesday is not submitted, should be overdue
      expect(data.overdue).toContain("2026-01-27");
    });

    it("returns empty array for CONSULTANT (not required to submit)", async () => {
      const user = createMockUser({ position: "CONSULTANT" });
      setupAuthenticatedUser(user);
      mockHasAdminAccess.mockReturnValue(false);

      // No submissions
      mockDb.query.timesheetSubmissions.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/overdue",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.overdue).toEqual([]);
    });

    it("returns empty array for ADMIN when not viewing team (not required to submit)", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);
      // Simulate non-admin path by returning false
      mockHasAdminAccess.mockReturnValue(false);

      mockDb.query.timesheetSubmissions.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/overdue",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.overdue).toEqual([]);
    });
  });

  describe("Admins and Partners", () => {
    it("returns all employees' overdue dates grouped by user", async () => {
      const adminUser = createMockUser({ position: "ADMIN", name: "Admin User" });
      setupAuthenticatedUser(adminUser);
      mockHasAdminAccess.mockReturnValue(true);

      // Mock requiresTimesheetSubmission to filter by position
      mockRequiresTimesheetSubmission.mockImplementation((position: string) =>
        SUBMISSION_REQUIRED_POSITIONS.includes(position)
      );

      // Mock active users
      const user1 = createMockUser({ id: "user-1", name: "John Doe", position: "ASSOCIATE" });
      const user2 = createMockUser({ id: "user-2", name: "Jane Smith", position: "SENIOR_ASSOCIATE" });

      mockDb.query.users.findMany.mockResolvedValue([
        { id: user1.id, name: user1.name, email: user1.email, position: user1.position, status: "ACTIVE" },
        { id: user2.id, name: user2.name, email: user2.email, position: user2.position, status: "ACTIVE" },
        { id: adminUser.id, name: adminUser.name, email: adminUser.email, position: adminUser.position, status: "ACTIVE" },
      ]);

      // User 1 submitted Monday only, User 2 submitted nothing
      // Admin submitted everything (but we want to verify admin sees all users)
      mockDb.query.timesheetSubmissions.findMany.mockResolvedValue([
        { id: "sub-1", userId: user1.id, date: "2026-01-26", submittedAt: "2026-01-27T09:00:00.000Z" },
      ]);
      // No leave periods
      mockDb.query.leavePeriods.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/overdue",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.overdue).toBeInstanceOf(Array);

      // Find user entries
      const user1Entry = data.overdue.find((e: { userId: string }) => e.userId === user1.id);
      const user2Entry = data.overdue.find((e: { userId: string }) => e.userId === user2.id);

      // User 1 submitted Monday, so only Tuesday should be overdue
      expect(user1Entry).toBeDefined();
      expect(user1Entry.name).toBe("John Doe");
      expect(user1Entry.dates).not.toContain("2026-01-26");
      expect(user1Entry.dates).toContain("2026-01-27");

      // User 2 submitted nothing, so both days should be overdue
      expect(user2Entry).toBeDefined();
      expect(user2Entry.name).toBe("Jane Smith");
      expect(user2Entry.dates).toContain("2026-01-26");
      expect(user2Entry.dates).toContain("2026-01-27");
    });

    it("excludes ADMIN and CONSULTANT from team overdue list", async () => {
      const adminUser = createMockUser({ position: "ADMIN", name: "Admin User" });
      setupAuthenticatedUser(adminUser);
      mockHasAdminAccess.mockReturnValue(true);

      // Mock requiresTimesheetSubmission to return true only for ASSOCIATE
      mockRequiresTimesheetSubmission.mockImplementation((position: string) =>
        SUBMISSION_REQUIRED_POSITIONS.includes(position)
      );

      // Mock active users including ADMIN and CONSULTANT
      const associate = createMockUser({ id: "user-1", name: "John Associate", position: "ASSOCIATE" });
      const consultant = createMockUser({ id: "user-2", name: "Jane Consultant", position: "CONSULTANT" });
      const otherAdmin = createMockUser({ id: "user-3", name: "Other Admin", position: "ADMIN" });

      mockDb.query.users.findMany.mockResolvedValue([
        { id: associate.id, name: associate.name, email: associate.email, position: associate.position, status: "ACTIVE" },
        { id: consultant.id, name: consultant.name, email: consultant.email, position: consultant.position, status: "ACTIVE" },
        { id: otherAdmin.id, name: otherAdmin.name, email: otherAdmin.email, position: otherAdmin.position, status: "ACTIVE" },
        { id: adminUser.id, name: adminUser.name, email: adminUser.email, position: adminUser.position, status: "ACTIVE" },
      ]);

      // No submissions - everyone would have overdue if they're tracked
      mockDb.query.timesheetSubmissions.findMany.mockResolvedValue([]);
      // No leave periods
      mockDb.query.leavePeriods.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/overdue",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      // Only ASSOCIATE should appear in overdue list
      expect(data.overdue).toHaveLength(1);
      expect(data.overdue[0].userId).toBe(associate.id);
      expect(data.overdue[0].name).toBe("John Associate");

      // CONSULTANT and ADMINs should NOT appear
      const consultantEntry = data.overdue.find((e: { userId: string }) => e.userId === consultant.id);
      const adminEntry = data.overdue.find((e: { userId: string }) => e.userId === adminUser.id);
      const otherAdminEntry = data.overdue.find((e: { userId: string }) => e.userId === otherAdmin.id);

      expect(consultantEntry).toBeUndefined();
      expect(adminEntry).toBeUndefined();
      expect(otherAdminEntry).toBeUndefined();
    });

    it("excludes users with no overdue dates from response", async () => {
      const adminUser = createMockUser({ position: "PARTNER", name: "Partner User" });
      setupAuthenticatedUser(adminUser);
      mockHasAdminAccess.mockReturnValue(true);

      // Mock requiresTimesheetSubmission to filter by position
      mockRequiresTimesheetSubmission.mockImplementation((position: string) =>
        SUBMISSION_REQUIRED_POSITIONS.includes(position)
      );

      const user1 = createMockUser({ id: "user-1", name: "John Doe" });

      mockDb.query.users.findMany.mockResolvedValue([
        { id: user1.id, name: user1.name, email: user1.email, position: user1.position, status: "ACTIVE" },
        { id: adminUser.id, name: adminUser.name, email: adminUser.email, position: adminUser.position, status: "ACTIVE" },
      ]);

      // Generate submissions for all weekdays for user1 in the past 30 days
      const submissions = [];
      for (let i = 30; i >= 0; i--) {
        const date = new Date("2026-01-28");
        date.setDate(date.getDate() - i);
        const day = date.getDay();
        if (day >= 1 && day <= 5) {
          submissions.push({
            id: `sub-${i}`,
            userId: user1.id,
            date: date.toISOString().split("T")[0],
            submittedAt: "2026-01-28T10:00:00.000Z",
          });
        }
      }

      mockDb.query.timesheetSubmissions.findMany.mockResolvedValue(submissions);
      // No leave periods
      mockDb.query.leavePeriods.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/timesheets/overdue",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // User1 has no overdue dates, should not appear in response
      const user1Entry = data.overdue.find((e: { userId: string }) => e.userId === user1.id);
      expect(user1Entry).toBeUndefined();
    });
  });
});
