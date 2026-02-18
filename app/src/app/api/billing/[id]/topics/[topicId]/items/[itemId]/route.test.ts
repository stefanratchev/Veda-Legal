import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireAdmin, mockDb } = vi.hoisted(() => {
  const mockWhere = vi.fn();
  const mockReturning = vi.fn();
  const mockSet = vi.fn();
  // Second update chain (for time entry update)
  const mockTimeEntryWhere = vi.fn();
  const mockTimeEntrySet = vi.fn();

  const db: Record<string, unknown> = {
    query: {
      serviceDescriptionLineItems: { findFirst: vi.fn() },
    },
    update: vi.fn().mockReturnValue({
      set: mockSet.mockReturnValue({
        where: mockWhere.mockReturnValue({
          returning: mockReturning,
        }),
      }),
    }),
    _mockSet: mockSet,
    _mockWhere: mockWhere,
    _mockReturning: mockReturning,
    _mockTimeEntrySet: mockTimeEntrySet,
    _mockTimeEntryWhere: mockTimeEntryWhere,
  };

  // transaction: execute callback with the mock db itself as tx
  db.transaction = vi.fn(async (cb: (tx: typeof db) => Promise<unknown>) => cb(db));

  return {
    mockRequireAdmin: vi.fn(),
    mockDb: db,
  };
});

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/schema", () => ({
  serviceDescriptionLineItems: {
    id: "id",
    timeEntryId: "timeEntryId",
    date: "date",
    description: "description",
    hours: "hours",
    displayOrder: "displayOrder",
    waiveMode: "waiveMode",
  },
  timeEntries: {
    id: "id",
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
  eq: vi.fn((a, b) => ({ column: a, value: b })),
  and: vi.fn((...args: unknown[]) => args),
  ne: vi.fn((a, b) => ({ ne: a, value: b })),
  isNotNull: vi.fn((a) => ({ isNotNull: a })),
}));

// Import route after mocks are set up
import { PATCH } from "./route";

const SD_ID = "sd-1";
const TOPIC_ID = "topic-1";
const ITEM_ID = "item-1";
const TIME_ENTRY_ID = "te-1";

type RouteParams = { params: Promise<{ id: string; topicId: string; itemId: string }> };

function makeParams(): RouteParams {
  return { params: Promise.resolve({ id: SD_ID, topicId: TOPIC_ID, itemId: ITEM_ID }) };
}

function setupAuthenticatedAdmin() {
  mockRequireAdmin.mockResolvedValue({
    session: { user: { name: "Admin", email: "admin@example.com" } },
  });
}

function setupValidItem() {
  (mockDb.query as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
    .serviceDescriptionLineItems.findFirst.mockResolvedValue({
      id: ITEM_ID,
      topic: {
        id: TOPIC_ID,
        serviceDescription: {
          id: SD_ID,
          status: "DRAFT",
        },
      },
    });
}

function setupReturning(overrides: Record<string, unknown> = {}) {
  (mockDb._mockReturning as ReturnType<typeof vi.fn>).mockResolvedValue([{
    id: ITEM_ID,
    timeEntryId: null,
    date: null,
    description: "Test item",
    hours: null,
    displayOrder: 0,
    waiveMode: null,
    ...overrides,
  }]);
}

function setupUpdateChain() {
  // Reset the chain — first call returns the line item chain, second call returns the time entry chain
  let callCount = 0;
  const mockSet = mockDb._mockSet as ReturnType<typeof vi.fn>;
  const mockWhere = mockDb._mockWhere as ReturnType<typeof vi.fn>;
  const mockReturning = mockDb._mockReturning as ReturnType<typeof vi.fn>;
  const mockTESet = mockDb._mockTimeEntrySet as ReturnType<typeof vi.fn>;
  const mockTEWhere = mockDb._mockTimeEntryWhere as ReturnType<typeof vi.fn>;

  (mockDb.update as ReturnType<typeof vi.fn>).mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      return {
        set: mockSet.mockReturnValue({
          where: mockWhere.mockReturnValue({
            returning: mockReturning,
          }),
        }),
      };
    }
    return {
      set: mockTESet.mockReturnValue({
        where: mockTEWhere.mockResolvedValue(undefined),
      }),
    };
  });
}

describe("PATCH /api/billing/[id]/topics/[topicId]/items/[itemId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockSet = mockDb._mockSet as ReturnType<typeof vi.fn>;
    const mockWhere = mockDb._mockWhere as ReturnType<typeof vi.fn>;
    const mockReturning = mockDb._mockReturning as ReturnType<typeof vi.fn>;

    // Re-setup transaction mock
    (mockDb.transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: (tx: typeof mockDb) => Promise<unknown>) => cb(mockDb)
    );
    // Default: single update chain (line item only)
    (mockDb.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: mockSet.mockReturnValue({
        where: mockWhere.mockReturnValue({
          returning: mockReturning,
        }),
      }),
    });
  });

  describe("writeOff actions", () => {
    beforeEach(() => {
      setupAuthenticatedAdmin();
      setupValidItem();
    });

    it("writeOff HIDDEN — sets waiveMode to EXCLUDED and updates time entry", async () => {
      setupUpdateChain();
      setupReturning({ waiveMode: "EXCLUDED", timeEntryId: TIME_ENTRY_ID });

      const request = createMockRequest({
        method: "PATCH",
        url: `/api/billing/${SD_ID}/topics/${TOPIC_ID}/items/${ITEM_ID}`,
        body: { writeOff: "HIDDEN" },
      });

      const response = await PATCH(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.waiveMode).toBe("EXCLUDED");
      expect(mockDb._mockSet as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
        expect.objectContaining({ waiveMode: "EXCLUDED" })
      );
      expect(mockDb._mockTimeEntrySet as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({ isWrittenOff: true });
    });

    it("writeOff VISIBLE — sets waiveMode to ZERO and updates time entry", async () => {
      setupUpdateChain();
      setupReturning({ waiveMode: "ZERO", timeEntryId: TIME_ENTRY_ID });

      const request = createMockRequest({
        method: "PATCH",
        url: `/api/billing/${SD_ID}/topics/${TOPIC_ID}/items/${ITEM_ID}`,
        body: { writeOff: "VISIBLE" },
      });

      const response = await PATCH(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.waiveMode).toBe("ZERO");
      expect(mockDb._mockSet as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
        expect.objectContaining({ waiveMode: "ZERO" })
      );
      expect(mockDb._mockTimeEntrySet as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({ isWrittenOff: true });
    });

    it("writeOff null — clears waiveMode and restores time entry", async () => {
      setupUpdateChain();
      setupReturning({ waiveMode: null, timeEntryId: TIME_ENTRY_ID });
      // Mock: no other waived references found during restore check
      (mockDb.query as Record<string, Record<string, ReturnType<typeof vi.fn>>>)
        .serviceDescriptionLineItems.findFirst.mockResolvedValueOnce({
          // First call: hierarchy check
          id: ITEM_ID,
          topic: { id: TOPIC_ID, serviceDescription: { id: SD_ID, status: "DRAFT" } },
        }).mockResolvedValueOnce(null); // Second call: no other waived items

      const request = createMockRequest({
        method: "PATCH",
        url: `/api/billing/${SD_ID}/topics/${TOPIC_ID}/items/${ITEM_ID}`,
        body: { writeOff: null },
      });

      const response = await PATCH(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.waiveMode).toBe(null);
      expect(mockDb._mockTimeEntrySet as ReturnType<typeof vi.fn>).toHaveBeenCalledWith({ isWrittenOff: false });
    });

    it("writeOff skips time entry update when no timeEntryId", async () => {
      setupReturning({ waiveMode: "EXCLUDED", timeEntryId: null });

      const request = createMockRequest({
        method: "PATCH",
        url: `/api/billing/${SD_ID}/topics/${TOPIC_ID}/items/${ITEM_ID}`,
        body: { writeOff: "HIDDEN" },
      });

      const response = await PATCH(request, makeParams());

      expect(response.status).toBe(200);
      // transaction is called, but only one update inside it (line item)
      expect(mockDb.update as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
    });

    it("rejects invalid writeOff value — returns 400", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: `/api/billing/${SD_ID}/topics/${TOPIC_ID}/items/${ITEM_ID}`,
        body: { writeOff: "INVALID" },
      });

      const response = await PATCH(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("writeOff must be VISIBLE, HIDDEN, or null");
    });
  });
});
