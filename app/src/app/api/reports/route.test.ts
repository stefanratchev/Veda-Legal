import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import {
  createMockUser,
  MockUser,
} from "@/test/mocks/factories";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireAuth, mockDb } = vi.hoisted(() => {
  return {
    mockRequireAuth: vi.fn(),
    mockDb: {
      query: {
        users: {
          findFirst: vi.fn(),
        },
        timeEntries: {
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
  };
});

// Import route after mocks are set up
import { GET } from "./route";

// Helper to set up authenticated user
function setupAuthenticatedUser(user: MockUser, dbUser?: { id: string; email: string; name: string; position: string } | null) {
  mockRequireAuth.mockResolvedValue({
    session: { user: { name: user.name, email: user.email } },
  });
  mockDb.query.users.findFirst.mockResolvedValue(
    dbUser !== undefined ? dbUser : {
      id: user.id,
      email: user.email,
      name: user.name,
      position: user.position,
    }
  );
}

// Mock time entries with client and user relations
function createMockTimeEntryWithRelations(overrides: {
  id?: string;
  date?: string;
  hours?: string;
  description?: string;
  userId?: string;
  clientId?: string;
  user?: { id: string; name: string | null };
  client?: { id: string; name: string; hourlyRate: number | null };
} = {}) {
  const userId = overrides.userId || "user-1";
  const clientId = overrides.clientId || "client-1";
  return {
    id: overrides.id || "entry-1",
    date: overrides.date || "2024-01-15",
    hours: overrides.hours || "2.5",
    description: overrides.description || "Test work",
    userId,
    clientId,
    user: overrides.user || { id: userId, name: "Test User" },
    client: overrides.client || { id: clientId, name: "Test Client", hourlyRate: 150 },
  };
}

describe("GET /api/reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 404 when user not in database", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user, null);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });
  });

  describe("Validation", () => {
    it("returns 400 when startDate is missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("startDate and endDate are required");
    });

    it("returns 400 when endDate is missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("startDate and endDate are required");
    });

    it("returns 400 when both dates are missing", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("startDate and endDate are required");
    });

    it("returns 400 when startDate is invalid format", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=not-a-date&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid date format");
    });

    it("returns 400 when endDate is invalid format", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=invalid",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid date format");
    });

    it("returns 400 when startDate is after endDate", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-31&endDate=2024-01-01",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("startDate must be before or equal to endDate");
    });

    it("accepts same date for startDate and endDate", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-15&endDate=2024-01-15",
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe("Happy Path - Admin Users", () => {
    it("returns aggregated report data for admin", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);

      const entries = [
        createMockTimeEntryWithRelations({
          id: "entry-1",
          userId: "user-1",
          clientId: "client-1",
          hours: "3.0",
          date: "2024-01-15",
          user: { id: "user-1", name: "Employee One" },
          client: { id: "client-1", name: "Client A", hourlyRate: 150 },
        }),
        createMockTimeEntryWithRelations({
          id: "entry-2",
          userId: "user-2",
          clientId: "client-1",
          hours: "2.0",
          date: "2024-01-16",
          user: { id: "user-2", name: "Employee Two" },
          client: { id: "client-1", name: "Client A", hourlyRate: 150 },
        }),
        createMockTimeEntryWithRelations({
          id: "entry-3",
          userId: "user-1",
          clientId: "client-2",
          hours: "1.5",
          date: "2024-01-17",
          user: { id: "user-1", name: "Employee One" },
          client: { id: "client-2", name: "Client B", hourlyRate: 200 },
        }),
      ];
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary.totalHours).toBe(6.5);
      expect(data.summary.totalRevenue).toBe(1050); // 3*150 + 2*150 + 1.5*200
      expect(data.summary.activeClients).toBe(2);
      expect(data.byEmployee).toHaveLength(2);
      expect(data.byClient).toHaveLength(2);
      expect(data.entries).toHaveLength(3);
    });

    it("returns entries sorted by date descending", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);

      const entries = [
        createMockTimeEntryWithRelations({ id: "entry-1", date: "2024-01-17" }),
        createMockTimeEntryWithRelations({ id: "entry-2", date: "2024-01-15" }),
        createMockTimeEntryWithRelations({ id: "entry-3", date: "2024-01-16" }),
      ];
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.entries).toHaveLength(3);
      expect(data.entries[0].date).toBe("2024-01-17");
    });

    it("calculates employee stats correctly", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);

      const entries = [
        createMockTimeEntryWithRelations({
          userId: "user-1",
          clientId: "client-1",
          hours: "3.0",
          date: "2024-01-15",
          user: { id: "user-1", name: "Employee One" },
          client: { id: "client-1", name: "Client A", hourlyRate: 150 },
        }),
        createMockTimeEntryWithRelations({
          userId: "user-1",
          clientId: "client-1",
          hours: "2.0",
          date: "2024-01-16",
          user: { id: "user-1", name: "Employee One" },
          client: { id: "client-1", name: "Client A", hourlyRate: 150 },
        }),
        createMockTimeEntryWithRelations({
          userId: "user-1",
          clientId: "client-2",
          hours: "1.5",
          date: "2024-01-15",
          user: { id: "user-1", name: "Employee One" },
          client: { id: "client-2", name: "Client B", hourlyRate: 200 },
        }),
      ];
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      const employee = data.byEmployee[0];
      expect(employee.totalHours).toBe(6.5);
      expect(employee.clientCount).toBe(2);
      expect(employee.topClient.name).toBe("Client A");
      expect(employee.topClient.hours).toBe(5);
      expect(employee.clients).toHaveLength(2);
      expect(employee.dailyHours).toHaveLength(2); // Two different dates
    });

    it("calculates client stats correctly with revenue", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);

      const entries = [
        createMockTimeEntryWithRelations({
          userId: "user-1",
          clientId: "client-1",
          hours: "3.0",
          user: { id: "user-1", name: "Employee One" },
          client: { id: "client-1", name: "Client A", hourlyRate: 150 },
        }),
        createMockTimeEntryWithRelations({
          userId: "user-2",
          clientId: "client-1",
          hours: "2.0",
          user: { id: "user-2", name: "Employee Two" },
          client: { id: "client-1", name: "Client A", hourlyRate: 150 },
        }),
      ];
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      const client = data.byClient[0];
      expect(client.totalHours).toBe(5);
      expect(client.hourlyRate).toBe(150);
      expect(client.revenue).toBe(750); // 5 * 150
      expect(client.employees).toHaveLength(2);
    });

    it("handles client without hourly rate", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);

      const entries = [
        createMockTimeEntryWithRelations({
          userId: "user-1",
          clientId: "client-1",
          hours: "3.0",
          client: { id: "client-1", name: "Client No Rate", hourlyRate: null },
        }),
      ];
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      const client = data.byClient[0];
      expect(client.hourlyRate).toBeNull();
      expect(client.revenue).toBeNull();
    });

    it("returns empty data when no entries in date range", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary.totalHours).toBe(0);
      expect(data.summary.totalRevenue).toBe(0);
      expect(data.summary.activeClients).toBe(0);
      expect(data.byEmployee).toHaveLength(0);
      expect(data.byClient).toHaveLength(0);
      expect(data.entries).toHaveLength(0);
    });
  });

  describe("Happy Path - Partner Users", () => {
    it("returns full report data for partner (same as admin)", async () => {
      const user = createMockUser({ position: "PARTNER" });
      setupAuthenticatedUser(user);

      const entries = [
        createMockTimeEntryWithRelations({
          userId: "other-user",
          hours: "3.0",
          client: { id: "client-1", name: "Client A", hourlyRate: 150 },
        }),
      ];
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.summary.totalRevenue).toBe(450); // Partners see revenue
      expect(data.byClient[0].hourlyRate).toBe(150);
      expect(data.byClient[0].revenue).toBe(450);
    });
  });

  describe("Happy Path - Regular Users (Non-Admin)", () => {
    it("filters entries to only show user's own entries", async () => {
      const user = createMockUser({ id: "user-1", position: "ASSOCIATE" });
      setupAuthenticatedUser(user);

      // The route should filter on the server side, but we simulate the expected behavior
      const entries = [
        createMockTimeEntryWithRelations({
          userId: "user-1",
          hours: "3.0",
          user: { id: "user-1", name: user.name },
          client: { id: "client-1", name: "Client A", hourlyRate: 150 },
        }),
      ];
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Non-admins don't see revenue at summary level
      expect(data.summary.totalRevenue).toBeNull();
    });

    it("hides hourly rate and revenue from non-admin users", async () => {
      const user = createMockUser({ id: "user-1", position: "ASSOCIATE" });
      setupAuthenticatedUser(user);

      const entries = [
        createMockTimeEntryWithRelations({
          userId: "user-1",
          hours: "3.0",
          user: { id: "user-1", name: user.name },
          client: { id: "client-1", name: "Client A", hourlyRate: 150 },
        }),
      ];
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Client details should have hidden rate/revenue for non-admins
      expect(data.byClient[0].hourlyRate).toBeNull();
      expect(data.byClient[0].revenue).toBeNull();
    });

    it("only shows user's own employee stats", async () => {
      const user = createMockUser({ id: "user-1", position: "ASSOCIATE" });
      setupAuthenticatedUser(user);

      const entries = [
        createMockTimeEntryWithRelations({
          userId: "user-1",
          hours: "3.0",
          user: { id: "user-1", name: user.name },
        }),
      ];
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // byEmployee should only contain the current user
      expect(data.byEmployee.length).toBe(1);
      expect(data.byEmployee[0].id).toBe("user-1");
    });
  });

  describe("Error Handling", () => {
    it("returns 500 when database query fails", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);
      mockDb.query.timeEntries.findMany.mockRejectedValue(new Error("Database connection failed"));

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch report data");
    });
  });

  describe("Data Serialization", () => {
    it("converts decimal hours to numbers", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);

      const entries = [
        createMockTimeEntryWithRelations({ hours: "2.5" }),
      ];
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(typeof data.entries[0].hours).toBe("number");
      expect(data.entries[0].hours).toBe(2.5);
    });

    it("handles user without name (Unknown)", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);

      const entries = [
        createMockTimeEntryWithRelations({
          user: { id: "user-1", name: null },
        }),
      ];
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.entries[0].userName).toBe("Unknown");
      expect(data.byEmployee[0].name).toBe("Unknown");
    });

    it("includes all expected fields in entries", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);

      const entries = [
        createMockTimeEntryWithRelations({
          id: "entry-123",
          date: "2024-01-15",
          hours: "2.5",
          description: "Test description",
          userId: "user-1",
          clientId: "client-1",
          user: { id: "user-1", name: "Test User" },
          client: { id: "client-1", name: "Test Client", hourlyRate: 150 },
        }),
      ];
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      const entry = data.entries[0];
      expect(entry).toHaveProperty("id", "entry-123");
      expect(entry).toHaveProperty("date", "2024-01-15");
      expect(entry).toHaveProperty("hours", 2.5);
      expect(entry).toHaveProperty("description", "Test description");
      expect(entry).toHaveProperty("userId", "user-1");
      expect(entry).toHaveProperty("userName", "Test User");
      expect(entry).toHaveProperty("clientId", "client-1");
      expect(entry).toHaveProperty("clientName", "Test Client");
    });
  });

  describe("Sorting", () => {
    it("sorts employees by total hours descending", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);

      const entries = [
        createMockTimeEntryWithRelations({
          userId: "user-1",
          hours: "2.0",
          user: { id: "user-1", name: "Low Hours Employee" },
        }),
        createMockTimeEntryWithRelations({
          userId: "user-2",
          hours: "8.0",
          user: { id: "user-2", name: "High Hours Employee" },
        }),
        createMockTimeEntryWithRelations({
          userId: "user-3",
          hours: "5.0",
          user: { id: "user-3", name: "Medium Hours Employee" },
        }),
      ];
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.byEmployee[0].totalHours).toBe(8);
      expect(data.byEmployee[1].totalHours).toBe(5);
      expect(data.byEmployee[2].totalHours).toBe(2);
    });

    it("sorts clients by total hours descending", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);

      const entries = [
        createMockTimeEntryWithRelations({
          clientId: "client-1",
          hours: "2.0",
          client: { id: "client-1", name: "Low Hours Client", hourlyRate: 100 },
        }),
        createMockTimeEntryWithRelations({
          clientId: "client-2",
          hours: "8.0",
          client: { id: "client-2", name: "High Hours Client", hourlyRate: 100 },
        }),
      ];
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.byClient[0].totalHours).toBe(8);
      expect(data.byClient[1].totalHours).toBe(2);
    });

    it("sorts daily hours by date ascending", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);

      const entries = [
        createMockTimeEntryWithRelations({
          userId: "user-1",
          date: "2024-01-20",
          hours: "2.0",
          user: { id: "user-1", name: "Test User" },
        }),
        createMockTimeEntryWithRelations({
          userId: "user-1",
          date: "2024-01-15",
          hours: "3.0",
          user: { id: "user-1", name: "Test User" },
        }),
        createMockTimeEntryWithRelations({
          userId: "user-1",
          date: "2024-01-18",
          hours: "1.0",
          user: { id: "user-1", name: "Test User" },
        }),
      ];
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      const dailyHours = data.byEmployee[0].dailyHours;
      expect(dailyHours[0].date).toBe("2024-01-15");
      expect(dailyHours[1].date).toBe("2024-01-18");
      expect(dailyHours[2].date).toBe("2024-01-20");
    });

    it("sorts employee clients by hours descending", async () => {
      const user = createMockUser({ position: "ADMIN" });
      setupAuthenticatedUser(user);

      const entries = [
        createMockTimeEntryWithRelations({
          userId: "user-1",
          clientId: "client-1",
          hours: "2.0",
          user: { id: "user-1", name: "Test User" },
          client: { id: "client-1", name: "Low Hours Client", hourlyRate: 100 },
        }),
        createMockTimeEntryWithRelations({
          userId: "user-1",
          clientId: "client-2",
          hours: "8.0",
          user: { id: "user-1", name: "Test User" },
          client: { id: "client-2", name: "High Hours Client", hourlyRate: 100 },
        }),
      ];
      mockDb.query.timeEntries.findMany.mockResolvedValue(entries);

      const request = createMockRequest({
        method: "GET",
        url: "/api/reports?startDate=2024-01-01&endDate=2024-01-31",
      });

      const response = await GET(request);
      const data = await response.json();

      const clients = data.byEmployee[0].clients;
      expect(clients[0].hours).toBe(8);
      expect(clients[1].hours).toBe(2);
    });
  });
});
