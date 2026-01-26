import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser, MockUser } from "@/test/mocks/factories";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireAuth, mockGetUserFromSession, mockDb } = vi.hoisted(() => {
  // Create a chainable mock for select queries
  const mockSelectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };

  return {
    mockRequireAuth: vi.fn(),
    mockGetUserFromSession: vi.fn(),
    mockDb: {
      query: {
        timesheetSubmissions: {
          findFirst: vi.fn(),
        },
      },
      select: vi.fn().mockReturnValue(mockSelectChain),
      insert: vi.fn(),
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
import { POST } from "./route";

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

describe("POST /api/timesheets/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets/submit",
        body: { date: "2024-12-20" },
      });

      const response = await POST(request);
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
        method: "POST",
        url: "/api/timesheets/submit",
        body: { date: "2024-12-20" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });

  describe("Validation", () => {
    it("returns 400 when date is missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets/submit",
        body: {},
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Date is required");
    });

    it("returns 400 when date format is invalid", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets/submit",
        body: { date: "not-a-date" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid date format");
    });

    it("returns 400 when hours are less than 8", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      // Mock the sum query to return less than 8 hours
      const selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ totalHours: "4.5" }]),
        }),
      };
      mockDb.select.mockReturnValue(selectChain);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets/submit",
        body: { date: "2024-12-20" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Minimum 8 hours required for submission");
    });

    it("returns 400 when already submitted", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      // Mock the sum query to return enough hours
      const selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ totalHours: "8.5" }]),
        }),
      };
      mockDb.select.mockReturnValue(selectChain);

      // Mock existing submission
      mockDb.query.timesheetSubmissions.findFirst.mockResolvedValue({
        id: "existing-submission",
        userId: user.id,
        date: "2024-12-20",
        submittedAt: "2024-12-20T10:00:00.000Z",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets/submit",
        body: { date: "2024-12-20" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Already submitted for this date");
    });
  });

  describe("Happy Path", () => {
    it("creates submission and returns success with 201 status", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      // Mock the sum query to return enough hours
      const selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ totalHours: "8.5" }]),
        }),
      };
      mockDb.select.mockReturnValue(selectChain);

      // Mock no existing submission
      mockDb.query.timesheetSubmissions.findFirst.mockResolvedValue(null);

      // Mock the insert
      const createdSubmission = {
        id: "submission-123",
        userId: user.id,
        date: "2024-12-20",
        submittedAt: "2024-12-20T15:00:00.000Z",
      };
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdSubmission]),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets/submit",
        body: { date: "2024-12-20" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe("submission-123");
      expect(data.date).toBe("2024-12-20");
      expect(data.submittedAt).toBe("2024-12-20T15:00:00.000Z");
    });
  });
});
