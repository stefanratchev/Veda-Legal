import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
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
        findFirst: vi.fn(),
      },
      clients: {
        findFirst: vi.fn(),
      },
      subtopics: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
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
import { GET, POST } from "./route";

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

describe("POST /api/timesheets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Valid request body for reuse in tests
  const validBody = {
    date: "2024-12-20",
    clientId: "client-123",
    subtopicId: "subtopic-123",
    hours: 2.5,
    description: "Test work",
  };

  // Mock active client
  const mockActiveClient = {
    id: "client-123",
    name: "Test Client",
    status: "ACTIVE",
  };

  // Mock active subtopic with active topic
  const mockActiveSubtopic = {
    id: "subtopic-123",
    name: "Drafting documents",
    status: "ACTIVE",
    topic: {
      name: "M&A Advisory",
      status: "ACTIVE",
    },
  };

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: validBody,
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
        url: "/api/timesheets",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });

  describe("Validation", () => {
    it("returns 400 for invalid JSON body", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      // Create a request with invalid JSON using NextRequest directly
      const request = new NextRequest("http://localhost:3000/api/timesheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json }",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON");
    });

    it("returns 400 when date is missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { ...validBody, date: undefined },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Date is required");
    });

    it("returns 400 when date is invalid format", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { ...validBody, date: "not-a-date" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid date format");
    });

    it("returns 400 when date is in future", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      // Create a date well in the future
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split("T")[0];

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { ...validBody, date: futureDateStr },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot log time for future dates");
    });

    it("returns 400 when clientId is missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { ...validBody, clientId: undefined },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Client is required");
    });

    it("returns 404 when client not found", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue(null);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Client not found");
    });

    it("returns 400 when client is inactive", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue({
        id: "client-123",
        status: "INACTIVE",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot log time for inactive clients");
    });

    it("returns 400 when subtopicId is missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue(mockActiveClient);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { ...validBody, subtopicId: undefined },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Subtopic is required");
    });

    it("returns 404 when subtopic not found", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue(mockActiveClient);
      mockDb.query.subtopics.findFirst.mockResolvedValue(null);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Subtopic not found");
    });

    it("returns 400 when subtopic is inactive", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue(mockActiveClient);
      mockDb.query.subtopics.findFirst.mockResolvedValue({
        ...mockActiveSubtopic,
        status: "INACTIVE",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot log time with inactive subtopic");
    });

    it("returns 400 when topic is inactive", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue(mockActiveClient);
      mockDb.query.subtopics.findFirst.mockResolvedValue({
        ...mockActiveSubtopic,
        topic: { name: "M&A Advisory", status: "INACTIVE" },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot log time with inactive topic");
    });

    it("returns 400 when hours is missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue(mockActiveClient);
      mockDb.query.subtopics.findFirst.mockResolvedValue(mockActiveSubtopic);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { ...validBody, hours: undefined },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Hours is required");
    });

    it("returns 400 when hours is zero", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue(mockActiveClient);
      mockDb.query.subtopics.findFirst.mockResolvedValue(mockActiveSubtopic);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { ...validBody, hours: 0 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Hours must be between 0 and 12");
    });

    it("returns 400 when hours exceeds maximum", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue(mockActiveClient);
      mockDb.query.subtopics.findFirst.mockResolvedValue(mockActiveSubtopic);

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: { ...validBody, hours: 13 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Hours must be between 0 and 12");
    });
  });

  describe("Happy Path", () => {
    it("creates entry with valid data", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue(mockActiveClient);
      mockDb.query.subtopics.findFirst.mockResolvedValue(mockActiveSubtopic);

      const createdEntry = {
        id: "entry-123",
        date: "2024-12-20",
        hours: "2.5",
        description: "Test work",
        clientId: "client-123",
        subtopicId: "subtopic-123",
        topicName: "M&A Advisory",
        subtopicName: "Drafting documents",
        createdAt: "2024-12-20T10:00:00.000Z",
        updatedAt: "2024-12-20T10:00:00.000Z",
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdEntry]),
        }),
      });

      // Second call to findFirst for client (for response)
      mockDb.query.clients.findFirst
        .mockResolvedValueOnce(mockActiveClient)  // First call during validation
        .mockResolvedValueOnce({ id: "client-123", name: "Test Client" });  // Second call for response

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("entry-123");
      expect(data.hours).toBe(2.5);  // Serialized to number
      expect(data.client).toEqual({ id: "client-123", name: "Test Client" });
    });

    it("stores denormalized topic and subtopic names", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.clients.findFirst.mockResolvedValue(mockActiveClient);
      mockDb.query.subtopics.findFirst.mockResolvedValue(mockActiveSubtopic);

      const createdEntry = {
        id: "entry-123",
        date: "2024-12-20",
        hours: "2.5",
        description: "Test work",
        clientId: "client-123",
        subtopicId: "subtopic-123",
        topicName: "M&A Advisory",
        subtopicName: "Drafting documents",
        createdAt: "2024-12-20T10:00:00.000Z",
        updatedAt: "2024-12-20T10:00:00.000Z",
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdEntry]),
        }),
      });

      // Second call to findFirst for client (for response)
      mockDb.query.clients.findFirst
        .mockResolvedValueOnce(mockActiveClient)
        .mockResolvedValueOnce({ id: "client-123", name: "Test Client" });

      const request = createMockRequest({
        method: "POST",
        url: "/api/timesheets",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.topicName).toBe("M&A Advisory");
      expect(data.subtopicName).toBe("Drafting documents");
    });
  });
});
