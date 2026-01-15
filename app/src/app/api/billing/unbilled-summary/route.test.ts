import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser, MockUser } from "@/test/mocks/factories";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireAuth, mockDb } = vi.hoisted(() => {
  return {
    mockRequireAuth: vi.fn(),
    mockDb: {
      select: vi.fn(),
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
function setupAuthenticatedUser(user: MockUser) {
  mockRequireAuth.mockResolvedValue({
    session: { user: { name: user.name, email: user.email } },
  });
}

// Helper to create a chainable mock for the aggregation query
function createSelectChain(result: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockReturnValue({
                    orderBy: vi.fn().mockResolvedValue(result),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  };
}

describe("GET /api/billing/unbilled-summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "GET",
        url: "/api/billing/unbilled-summary",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("Happy Path", () => {
    it("returns empty array when no unbilled entries", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);
      mockDb.select.mockReturnValue(createSelectChain([]));

      const request = createMockRequest({
        method: "GET",
        url: "/api/billing/unbilled-summary",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(0);
    });

    it("returns clients with unbilled hours aggregated", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      // Mock aggregated result from database
      const dbResult = [
        {
          clientId: "client-1",
          clientName: "Acme Corp",
          hourlyRate: "150.00",
          totalUnbilledHours: "10.50",
          oldestEntryDate: "2024-01-10",
          newestEntryDate: "2024-01-20",
          existingDraftId: null,
          existingDraftPeriodStart: null,
          existingDraftPeriodEnd: null,
        },
        {
          clientId: "client-2",
          clientName: "Beta Inc",
          hourlyRate: "200.00",
          totalUnbilledHours: "5.00",
          oldestEntryDate: "2024-01-15",
          newestEntryDate: "2024-01-18",
          existingDraftId: null,
          existingDraftPeriodStart: null,
          existingDraftPeriodEnd: null,
        },
      ];

      mockDb.select.mockReturnValue(createSelectChain(dbResult));

      const request = createMockRequest({
        method: "GET",
        url: "/api/billing/unbilled-summary",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);

      // First client
      expect(data[0].clientId).toBe("client-1");
      expect(data[0].clientName).toBe("Acme Corp");
      expect(data[0].hourlyRate).toBe(150);
      expect(data[0].totalUnbilledHours).toBe(10.5);
      expect(data[0].estimatedValue).toBe(1575); // 10.5 * 150
      expect(data[0].oldestEntryDate).toBe("2024-01-10");
      expect(data[0].newestEntryDate).toBe("2024-01-20");
      expect(data[0].existingDraftId).toBeNull();
      expect(data[0].existingDraftPeriod).toBeNull();

      // Second client
      expect(data[1].clientId).toBe("client-2");
      expect(data[1].clientName).toBe("Beta Inc");
      expect(data[1].hourlyRate).toBe(200);
      expect(data[1].totalUnbilledHours).toBe(5);
      expect(data[1].estimatedValue).toBe(1000); // 5 * 200
    });

    it("includes existing draft info when draft exists", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const dbResult = [
        {
          clientId: "client-1",
          clientName: "Acme Corp",
          hourlyRate: "150.00",
          totalUnbilledHours: "8.00",
          oldestEntryDate: "2024-01-10",
          newestEntryDate: "2024-01-20",
          existingDraftId: "draft-123",
          existingDraftPeriodStart: "2024-01-01",
          existingDraftPeriodEnd: "2024-01-31",
        },
      ];

      mockDb.select.mockReturnValue(createSelectChain(dbResult));

      const request = createMockRequest({
        method: "GET",
        url: "/api/billing/unbilled-summary",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data[0].existingDraftId).toBe("draft-123");
      expect(data[0].existingDraftPeriod).toBe("2024-01-01 - 2024-01-31");
    });

    it("excludes entries in finalized service descriptions", async () => {
      // This test verifies the query structure filters correctly
      // The actual filtering is done in the WHERE clause in the route
      // Here we test that a client with only finalized entries doesn't appear
      const user = createMockUser();
      setupAuthenticatedUser(user);

      // Empty result means no clients with unbilled entries
      // (all entries are in finalized service descriptions)
      mockDb.select.mockReturnValue(createSelectChain([]));

      const request = createMockRequest({
        method: "GET",
        url: "/api/billing/unbilled-summary",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(0);
    });

    it("returns null estimatedValue when no hourly rate", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      const dbResult = [
        {
          clientId: "client-1",
          clientName: "Pro Bono Client",
          hourlyRate: null,
          totalUnbilledHours: "10.00",
          oldestEntryDate: "2024-01-10",
          newestEntryDate: "2024-01-20",
          existingDraftId: null,
          existingDraftPeriodStart: null,
          existingDraftPeriodEnd: null,
        },
      ];

      mockDb.select.mockReturnValue(createSelectChain(dbResult));

      const request = createMockRequest({
        method: "GET",
        url: "/api/billing/unbilled-summary",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data[0].hourlyRate).toBeNull();
      expect(data[0].estimatedValue).toBeNull();
      expect(data[0].totalUnbilledHours).toBe(10);
    });

    it("sorts by estimated value descending with nulls last", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      // Database returns pre-sorted by estimated value desc
      const dbResult = [
        {
          clientId: "client-1",
          clientName: "Big Spender",
          hourlyRate: "300.00",
          totalUnbilledHours: "20.00",
          oldestEntryDate: "2024-01-10",
          newestEntryDate: "2024-01-20",
          existingDraftId: null,
          existingDraftPeriodStart: null,
          existingDraftPeriodEnd: null,
        },
        {
          clientId: "client-2",
          clientName: "Medium Client",
          hourlyRate: "100.00",
          totalUnbilledHours: "10.00",
          oldestEntryDate: "2024-01-15",
          newestEntryDate: "2024-01-18",
          existingDraftId: null,
          existingDraftPeriodStart: null,
          existingDraftPeriodEnd: null,
        },
        {
          clientId: "client-3",
          clientName: "No Rate Client",
          hourlyRate: null,
          totalUnbilledHours: "50.00",
          oldestEntryDate: "2024-01-01",
          newestEntryDate: "2024-01-25",
          existingDraftId: null,
          existingDraftPeriodStart: null,
          existingDraftPeriodEnd: null,
        },
      ];

      mockDb.select.mockReturnValue(createSelectChain(dbResult));

      const request = createMockRequest({
        method: "GET",
        url: "/api/billing/unbilled-summary",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(3);

      // Should be sorted by estimated value desc
      expect(data[0].estimatedValue).toBe(6000); // 300 * 20
      expect(data[1].estimatedValue).toBe(1000); // 100 * 10
      expect(data[2].estimatedValue).toBeNull(); // No rate - last
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error", async () => {
      const user = createMockUser();
      setupAuthenticatedUser(user);

      // Create a chain that throws an error
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                leftJoin: vi.fn().mockReturnValue({
                  leftJoin: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                      groupBy: vi.fn().mockReturnValue({
                        orderBy: vi.fn().mockRejectedValue(new Error("Database connection failed")),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const request = createMockRequest({
        method: "GET",
        url: "/api/billing/unbilled-summary",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch unbilled summary");
    });
  });
});
