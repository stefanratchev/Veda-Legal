import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireAdmin, mockDb } = vi.hoisted(() => {
  const mockWhere = vi.fn();
  const mockReturning = vi.fn();
  const mockSet = vi.fn();

  return {
    mockRequireAdmin: vi.fn(),
    mockDb: {
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
    },
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
    fixedAmount: "fixedAmount",
    displayOrder: "displayOrder",
    waiveMode: "waiveMode",
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
}));

// Import route after mocks are set up
import { PATCH } from "./route";

const SD_ID = "sd-1";
const TOPIC_ID = "topic-1";
const ITEM_ID = "item-1";

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
  mockDb.query.serviceDescriptionLineItems.findFirst.mockResolvedValue({
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
  mockDb._mockReturning.mockResolvedValue([{
    id: ITEM_ID,
    timeEntryId: null,
    date: null,
    description: "Test item",
    hours: null,
    fixedAmount: null,
    displayOrder: 0,
    waiveMode: null,
    ...overrides,
  }]);
}

describe("PATCH /api/billing/[id]/topics/[topicId]/items/[itemId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup the chained mock methods after clearAllMocks
    mockDb.update.mockReturnValue({
      set: mockDb._mockSet.mockReturnValue({
        where: mockDb._mockWhere.mockReturnValue({
          returning: mockDb._mockReturning,
        }),
      }),
    });
  });

  describe("waiveMode updates", () => {
    beforeEach(() => {
      setupAuthenticatedAdmin();
      setupValidItem();
    });

    it("sets waiveMode to EXCLUDED — returns 200 with waiveMode: EXCLUDED", async () => {
      setupReturning({ waiveMode: "EXCLUDED" });

      const request = createMockRequest({
        method: "PATCH",
        url: `/api/billing/${SD_ID}/topics/${TOPIC_ID}/items/${ITEM_ID}`,
        body: { waiveMode: "EXCLUDED" },
      });

      const response = await PATCH(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.waiveMode).toBe("EXCLUDED");
    });

    it("sets waiveMode to ZERO — returns 200 with waiveMode: ZERO", async () => {
      setupReturning({ waiveMode: "ZERO" });

      const request = createMockRequest({
        method: "PATCH",
        url: `/api/billing/${SD_ID}/topics/${TOPIC_ID}/items/${ITEM_ID}`,
        body: { waiveMode: "ZERO" },
      });

      const response = await PATCH(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.waiveMode).toBe("ZERO");
    });

    it("clears waiveMode with null — returns 200 with waiveMode: null", async () => {
      setupReturning({ waiveMode: null });

      const request = createMockRequest({
        method: "PATCH",
        url: `/api/billing/${SD_ID}/topics/${TOPIC_ID}/items/${ITEM_ID}`,
        body: { waiveMode: null },
      });

      const response = await PATCH(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.waiveMode).toBe(null);
    });

    it("rejects invalid waiveMode value — returns 400", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: `/api/billing/${SD_ID}/topics/${TOPIC_ID}/items/${ITEM_ID}`,
        body: { waiveMode: "INVALID" },
      });

      const response = await PATCH(request, makeParams());
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("waiveMode must be EXCLUDED, ZERO, or null");
    });
  });
});
