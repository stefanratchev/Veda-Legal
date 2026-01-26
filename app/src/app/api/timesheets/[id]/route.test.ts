import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import {
  createMockUser,
  createMockTimeEntry,
  createMockSubtopic,
  MockUser,
} from "@/test/mocks/factories";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireAuth, mockGetUserFromSession, mockDb, mockSelectResult, mockHoursResult } = vi.hoisted(() => {
  const mockSelectResult = vi.fn();
  const mockHoursResult = vi.fn().mockResolvedValue([{ totalHours: "10" }]); // Default: 10 hours (above threshold)

  // Create chainable mock that supports both billing check (innerJoin) and hours aggregation (direct where)
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      // Support billing check chain (innerJoin)
      innerJoin: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: mockSelectResult,
          }),
        }),
      }),
      // Support hours aggregation chain (direct where)
      where: mockHoursResult,
    }),
  });

  return {
    mockRequireAuth: vi.fn(),
    mockGetUserFromSession: vi.fn(),
    mockSelectResult,
    mockHoursResult,
    mockDb: {
      query: {
        timeEntries: {
          findFirst: vi.fn(),
        },
        subtopics: {
          findFirst: vi.fn(),
        },
        clients: {
          findFirst: vi.fn(),
        },
        timesheetSubmissions: {
          findFirst: vi.fn(),
        },
      },
      update: vi.fn(),
      select: mockSelect,
      delete: vi.fn(),
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
import { PATCH } from "./route";

// Helper to create params as Promise (Next.js 15+ pattern)
function createParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
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
}

describe("PATCH /api/timesheets/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: entry is not billed (empty array means no finalized service description)
    mockSelectResult.mockResolvedValue([]);
    // Default: 10 hours total (above submission threshold)
    mockHoursResult.mockResolvedValue([{ totalHours: "10" }]);
    // Default: no existing submission
    mockDb.query.timesheetSubmissions.findFirst.mockResolvedValue(null);
    // Default: delete returns successfully
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    // Default: client lookup returns a client for response serialization
    mockDb.query.clients.findFirst.mockResolvedValue({
      id: "test-client",
      name: "Test Client Ltd",
    });
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { hours: 2.5 },
      });

      const response = await PATCH(request, { params: createParams("entry-1") });
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
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { hours: 2.5 },
      });

      const response = await PATCH(request, { params: createParams("entry-1") });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });

  describe("Authorization", () => {
    it("returns 404 when entry not found", async () => {
      const user = createMockUser({ id: "user-1" });
      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue(null);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/nonexistent",
        body: { hours: 2.5 },
      });

      const response = await PATCH(request, { params: createParams("nonexistent") });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Entry not found");
    });

    it("returns 403 when editing another user's entry", async () => {
      const user = createMockUser({ id: "user-1" });
      const otherUserEntry = createMockTimeEntry({ userId: "other-user" });

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue(otherUserEntry);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { hours: 2.5 },
      });

      const response = await PATCH(request, { params: createParams("entry-1") });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("You can only edit your own entries");
    });

    it("returns 403 when entry is linked to finalized service description", async () => {
      const user = createMockUser({ id: "user-1" });
      const entry = createMockTimeEntry({ userId: user.id });

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue(entry);
      // Mock the billing check to return a result (entry IS billed)
      mockSelectResult.mockResolvedValue([{ status: "FINALIZED" }]);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { hours: 2.5 },
      });

      const response = await PATCH(request, { params: createParams("entry-1") });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Cannot edit entries that have been billed");
    });
  });

  describe("Validation", () => {
    it("returns 400 when hours is zero", async () => {
      const user = createMockUser({ id: "user-1" });
      const entry = createMockTimeEntry({ userId: user.id });

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue(entry);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { hours: 0 },
      });

      const response = await PATCH(request, { params: createParams("entry-1") });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Hours must be between 0 and 12");
    });

    it("returns 400 when hours exceeds maximum (12)", async () => {
      const user = createMockUser({ id: "user-1" });
      const entry = createMockTimeEntry({ userId: user.id });

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue(entry);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { hours: 13 },
      });

      const response = await PATCH(request, { params: createParams("entry-1") });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Hours must be between 0 and 12");
    });

    it("returns 400 when hours is negative", async () => {
      const user = createMockUser({ id: "user-1" });
      const entry = createMockTimeEntry({ userId: user.id });

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue(entry);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { hours: -1 },
      });

      const response = await PATCH(request, { params: createParams("entry-1") });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Hours must be between 0 and 12");
    });

    it("returns 404 when clientId does not exist", async () => {
      const user = createMockUser({ id: "user-1" });
      const entry = createMockTimeEntry({ userId: user.id });

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue(entry);
      mockDb.query.clients.findFirst.mockResolvedValue(null);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { clientId: "nonexistent-client" },
      });

      const response = await PATCH(request, { params: createParams("entry-1") });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Client not found");
    });

    it("returns 400 when client is inactive", async () => {
      const user = createMockUser({ id: "user-1" });
      const entry = createMockTimeEntry({ userId: user.id });

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue(entry);
      mockDb.query.clients.findFirst.mockResolvedValue({
        id: "inactive-client",
        status: "INACTIVE",
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { clientId: "inactive-client" },
      });

      const response = await PATCH(request, { params: createParams("entry-1") });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot assign entry to inactive client");
    });
  });

  describe("Happy Path", () => {
    it("updates entry with new hours", async () => {
      const user = createMockUser({ id: "user-1" });
      const entry = createMockTimeEntry({
        id: "entry-1",
        userId: user.id,
        hours: "2.5",
      });

      const updatedEntry = {
        ...entry,
        hours: "3.0",
        updatedAt: new Date().toISOString(),
      };

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue(entry);
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedEntry]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { hours: 3.0 },
      });

      const response = await PATCH(request, { params: createParams("entry-1") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hours).toBe(3.0);
    });

    it("updates topicName and subtopicName when subtopicId changes", async () => {
      const user = createMockUser({ id: "user-1" });
      const entry = createMockTimeEntry({
        id: "entry-1",
        userId: user.id,
        subtopicId: "old-subtopic",
        topicName: "Old Topic",
        subtopicName: "Old Subtopic",
      });

      const newSubtopic = createMockSubtopic({
        id: "new-subtopic",
        name: "New Subtopic",
        topic: { name: "New Topic", status: "ACTIVE" },
      });

      const updatedEntry = {
        ...entry,
        subtopicId: "new-subtopic",
        topicName: "New Topic",
        subtopicName: "New Subtopic",
        updatedAt: new Date().toISOString(),
      };

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue(entry);
      mockDb.query.subtopics.findFirst.mockResolvedValue(newSubtopic);
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedEntry]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { subtopicId: "new-subtopic" },
      });

      const response = await PATCH(request, { params: createParams("entry-1") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.topicName).toBe("New Topic");
      expect(data.subtopicName).toBe("New Subtopic");
    });

    it("updates description", async () => {
      const user = createMockUser({ id: "user-1" });
      const entry = createMockTimeEntry({
        id: "entry-1",
        userId: user.id,
        description: "Old description",
      });

      const updatedEntry = {
        ...entry,
        description: "New description",
        updatedAt: new Date().toISOString(),
      };

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue(entry);
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedEntry]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { description: "New description" },
      });

      const response = await PATCH(request, { params: createParams("entry-1") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.description).toBe("New description");
    });

    it("updates clientId when client exists and is active", async () => {
      const user = createMockUser({ id: "user-1" });
      const entry = createMockTimeEntry({
        id: "entry-1",
        userId: user.id,
        clientId: "old-client",
      });

      const updatedEntry = {
        ...entry,
        clientId: "new-client",
        updatedAt: new Date().toISOString(),
      };

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue(entry);
      mockDb.query.clients.findFirst.mockResolvedValue({
        id: "new-client",
        status: "ACTIVE",
      });
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedEntry]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { clientId: "new-client" },
      });

      const response = await PATCH(request, { params: createParams("entry-1") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.clientId).toBe("new-client");
    });
  });

  describe("Submission Revocation", () => {
    it("revokes submission when updating hours causes total to drop below 8", async () => {
      const user = createMockUser({ id: "user-1" });
      const entry = createMockTimeEntry({
        id: "entry-1",
        userId: user.id,
        date: "2024-01-15",
        hours: "5",
      });

      const updatedEntry = {
        ...entry,
        hours: "2",
        updatedAt: new Date().toISOString(),
      };

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue(entry);
      // Mock hours query to return 5 (below 8 threshold after update)
      mockHoursResult.mockResolvedValue([{ totalHours: "5" }]);
      // Mock existing submission for the date
      mockDb.query.timesheetSubmissions.findFirst.mockResolvedValue({
        id: "submission-1",
        userId: user.id,
        date: "2024-01-15",
      });
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedEntry]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { hours: 2 },
      });

      const response = await PATCH(request, { params: createParams("entry-1") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.submissionRevoked).toBe(true);
      expect(data.remainingHours).toBe(5);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it("does not revoke submission when hours remain above threshold after update", async () => {
      const user = createMockUser({ id: "user-1" });
      const entry = createMockTimeEntry({
        id: "entry-1",
        userId: user.id,
        date: "2024-01-15",
        hours: "5",
      });

      const updatedEntry = {
        ...entry,
        hours: "4",
        updatedAt: new Date().toISOString(),
      };

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue(entry);
      // Mock hours query to return 10 (above 8 threshold)
      mockHoursResult.mockResolvedValue([{ totalHours: "10" }]);
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedEntry]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { hours: 4 },
      });

      const response = await PATCH(request, { params: createParams("entry-1") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.submissionRevoked).toBe(false);
      // remainingHours should not be present when no revocation
      expect(data.remainingHours).toBeUndefined();
      // delete should not have been called for submission (only in beforeEach setup)
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it("does not revoke submission when no submission exists for the date", async () => {
      const user = createMockUser({ id: "user-1" });
      const entry = createMockTimeEntry({
        id: "entry-1",
        userId: user.id,
        date: "2024-01-15",
        hours: "5",
      });

      const updatedEntry = {
        ...entry,
        hours: "2",
        updatedAt: new Date().toISOString(),
      };

      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findFirst.mockResolvedValue(entry);
      // Mock hours query to return 5 (below 8 threshold)
      mockHoursResult.mockResolvedValue([{ totalHours: "5" }]);
      // Mock no existing submission for the date
      mockDb.query.timesheetSubmissions.findFirst.mockResolvedValue(null);
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedEntry]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/entry-1",
        body: { hours: 2 },
      });

      const response = await PATCH(request, { params: createParams("entry-1") });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.submissionRevoked).toBe(false);
      // remainingHours should not be present when no revocation
      expect(data.remainingHours).toBeUndefined();
      // delete should not have been called
      expect(mockDb.delete).not.toHaveBeenCalled();
    });
  });
});
