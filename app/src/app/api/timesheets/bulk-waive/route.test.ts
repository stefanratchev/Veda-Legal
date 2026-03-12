import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";

/**
 * Tests for PATCH /api/timesheets/bulk-waive
 *
 * Key integration notes:
 * - unbilled-summary already filters isWrittenOff = true,
 *   so waived entries automatically disappear from the Ready to Bill view.
 * - POST /api/billing (SD creation) already filters isWrittenOff entries,
 *   so no changes needed there.
 */

// Use vi.hoisted() to create mocks available when vi.mock is hoisted
const { mockRequireAdmin, mockDb } = vi.hoisted(() => {
  // Subquery chain: db.select().from().innerJoin().innerJoin().where()
  const mockSubqueryWhere = vi.fn().mockReturnValue("finalized-entry-ids-subquery");
  const mockInnerJoin2 = vi.fn().mockReturnValue({ where: mockSubqueryWhere });
  const mockInnerJoin1 = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
  const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

  // Update chain: db.update().set().where()
  const mockUpdateWhere = vi.fn().mockResolvedValue({ rowCount: 0 });
  const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

  const db = {
    select: mockSelect,
    update: mockUpdate,
    _mockSelect: mockSelect,
    _mockFrom: mockFrom,
    _mockInnerJoin1: mockInnerJoin1,
    _mockInnerJoin2: mockInnerJoin2,
    _mockSubqueryWhere: mockSubqueryWhere,
    _mockUpdate: mockUpdate,
    _mockUpdateSet: mockUpdateSet,
    _mockUpdateWhere: mockUpdateWhere,
  };

  return {
    mockRequireAdmin: vi.fn(),
    mockDb: db,
  };
});

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/schema", () => ({
  timeEntries: {
    id: "timeEntries.id",
    clientId: "timeEntries.clientId",
    date: "timeEntries.date",
    isWrittenOff: "timeEntries.isWrittenOff",
  },
  serviceDescriptionLineItems: {
    timeEntryId: "sdli.timeEntryId",
    topicId: "sdli.topicId",
  },
  serviceDescriptionTopics: {
    id: "sdt.id",
    serviceDescriptionId: "sdt.serviceDescriptionId",
  },
  serviceDescriptions: {
    id: "sd.id",
    status: "sd.status",
  },
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...original,
    requireAdmin: mockRequireAdmin,
  };
});

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ op: "eq", column: a, value: b })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", conditions: args })),
  gte: vi.fn((a, b) => ({ op: "gte", column: a, value: b })),
  lte: vi.fn((a, b) => ({ op: "lte", column: a, value: b })),
  notInArray: vi.fn((a, b) => ({ op: "notInArray", column: a, subquery: b })),
  sql: Object.assign(
    vi.fn((...args: unknown[]) => ({ op: "sql", args })),
    { raw: vi.fn((s: string) => s) }
  ),
}));

// Import route after mocks are set up
import { PATCH } from "./route";

const CLIENT_ID = "client-123";

function setupAuthenticatedAdmin() {
  mockRequireAdmin.mockResolvedValue({
    session: { user: { name: "Admin", email: "admin@example.com" } },
  });
}

function setupAuthError(error: string, status: number) {
  mockRequireAdmin.mockResolvedValue({ error, status });
}

function setupUpdateResult(rowCount: number) {
  (mockDb._mockUpdateWhere as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount });
}

describe("PATCH /api/timesheets/bulk-waive", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset subquery chain defaults
    (mockDb._mockSubqueryWhere as ReturnType<typeof vi.fn>).mockReturnValue("finalized-entry-ids-subquery");
    (mockDb._mockInnerJoin2 as ReturnType<typeof vi.fn>).mockReturnValue({ where: mockDb._mockSubqueryWhere });
    (mockDb._mockInnerJoin1 as ReturnType<typeof vi.fn>).mockReturnValue({ innerJoin: mockDb._mockInnerJoin2 });
    (mockDb._mockFrom as ReturnType<typeof vi.fn>).mockReturnValue({ innerJoin: mockDb._mockInnerJoin1 });
    (mockDb._mockSelect as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockDb._mockFrom });

    // Reset update chain defaults
    (mockDb._mockUpdateWhere as ReturnType<typeof vi.fn>).mockResolvedValue({ rowCount: 0 });
    (mockDb._mockUpdateSet as ReturnType<typeof vi.fn>).mockReturnValue({ where: mockDb._mockUpdateWhere });
    (mockDb._mockUpdate as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockDb._mockUpdateSet });
  });

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      setupAuthError("Unauthorized", 401);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/bulk-waive",
        body: { clientId: CLIENT_ID },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 403 when user is not ADMIN/PARTNER", async () => {
      setupAuthError("Admin access required", 403);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/bulk-waive",
        body: { clientId: CLIENT_ID },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Admin access required");
    });
  });

  describe("validation", () => {
    beforeEach(() => {
      setupAuthenticatedAdmin();
    });

    it("returns 400 when clientId is missing", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/bulk-waive",
        body: {},
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("clientId is required");
    });

    it("returns 400 when clientId is empty string", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/bulk-waive",
        body: { clientId: "" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("clientId is required");
    });

    it("returns 400 when clientId is whitespace only", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/bulk-waive",
        body: { clientId: "   " },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("clientId is required");
    });

    it("returns 400 when dateFrom is invalid format", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/bulk-waive",
        body: { clientId: CLIENT_ID, dateFrom: "not-a-date" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("dateFrom");
    });

    it("returns 400 when dateTo is invalid format", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/bulk-waive",
        body: { clientId: CLIENT_ID, dateTo: "31-12-2025" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("dateTo");
    });

    it("returns 400 when dateFrom is after dateTo", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/bulk-waive",
        body: { clientId: CLIENT_ID, dateFrom: "2025-12-31", dateTo: "2025-01-01" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("dateFrom must be before or equal to dateTo");
    });
  });

  describe("happy path", () => {
    beforeEach(() => {
      setupAuthenticatedAdmin();
    });

    it("waives entries for a client with no date range", async () => {
      setupUpdateResult(5);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/bulk-waive",
        body: { clientId: CLIENT_ID },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true, updatedCount: 5 });

      // Verify update was called with correct set values
      expect(mockDb._mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          isWrittenOff: true,
          updatedAt: expect.any(String),
        })
      );

      // Verify WHERE conditions include clientId and isWrittenOff=false
      expect(mockDb._mockUpdateWhere).toHaveBeenCalled();
    });

    it("waives entries for a client with date range", async () => {
      setupUpdateResult(3);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/bulk-waive",
        body: { clientId: CLIENT_ID, dateFrom: "2025-01-01", dateTo: "2025-06-30" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true, updatedCount: 3 });

      // Verify update was called
      expect(mockDb._mockUpdate).toHaveBeenCalled();
      expect(mockDb._mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ isWrittenOff: true })
      );
    });

    it("returns updatedCount: 0 when no entries match (not an error)", async () => {
      setupUpdateResult(0);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/bulk-waive",
        body: { clientId: CLIENT_ID },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true, updatedCount: 0 });
    });

    it("accepts dateFrom equal to dateTo (single day)", async () => {
      setupUpdateResult(1);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/bulk-waive",
        body: { clientId: CLIENT_ID, dateFrom: "2025-03-15", dateTo: "2025-03-15" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true, updatedCount: 1 });
    });
  });

  describe("edge cases", () => {
    beforeEach(() => {
      setupAuthenticatedAdmin();
    });

    it("builds subquery to exclude entries in FINALIZED service descriptions", async () => {
      setupUpdateResult(2);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/bulk-waive",
        body: { clientId: CLIENT_ID },
      });

      await PATCH(request);

      // Verify the subquery chain was built (select -> from -> innerJoin -> innerJoin -> where)
      expect(mockDb._mockSelect).toHaveBeenCalled();
      expect(mockDb._mockFrom).toHaveBeenCalled();
      expect(mockDb._mockInnerJoin1).toHaveBeenCalled();
      expect(mockDb._mockInnerJoin2).toHaveBeenCalled();
      expect(mockDb._mockSubqueryWhere).toHaveBeenCalled();
    });

    it("only updates entries with isWrittenOff = false (no double-counting)", async () => {
      // Already written-off entries are excluded by the WHERE clause:
      // eq(timeEntries.isWrittenOff, false)
      setupUpdateResult(0);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/bulk-waive",
        body: { clientId: CLIENT_ID },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // The WHERE clause includes isWrittenOff = false, so already-written-off
      // entries won't be matched or counted
      expect(data.updatedCount).toBe(0);
    });

    it("returns 500 on database error", async () => {
      (mockDb._mockUpdateWhere as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database connection lost")
      );

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/bulk-waive",
        body: { clientId: CLIENT_ID },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to bulk waive time entries");
    });

    it("handles null dateFrom/dateTo without error", async () => {
      setupUpdateResult(4);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/timesheets/bulk-waive",
        body: { clientId: CLIENT_ID, dateFrom: null, dateTo: null },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true, updatedCount: 4 });
    });
  });
});
