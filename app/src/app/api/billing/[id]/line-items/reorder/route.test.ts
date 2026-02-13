import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireAdmin, mockDb } = vi.hoisted(() => {
  return {
    mockRequireAdmin: vi.fn(),
    mockDb: {
      query: {
        serviceDescriptions: { findFirst: vi.fn() },
        serviceDescriptionTopics: { findMany: vi.fn() },
      },
      transaction: vi.fn(),
      update: vi.fn(),
    },
  };
});

vi.mock("@/lib/db", () => ({
  db: mockDb,
  serviceDescriptions: { id: "id", status: "status" },
  serviceDescriptionTopics: {
    id: "id",
    serviceDescriptionId: "serviceDescriptionId",
  },
  serviceDescriptionLineItems: {
    id: "id",
    topicId: "topicId",
    displayOrder: "displayOrder",
    updatedAt: "updatedAt",
  },
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...original,
    requireAdmin: mockRequireAdmin,
  };
});

// Import route after mocks are set up
import { PATCH } from "./route";

// Helper to set up authenticated admin
function setupAuthenticatedAdmin() {
  mockRequireAdmin.mockResolvedValue({
    session: { user: { name: "Admin", email: "admin@example.com" } },
  });
}

describe("PATCH /api/billing/[id]/line-items/reorder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAdmin.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/line-items/reorder",
        body: { items: [{ id: "item-1", topicId: "topic-1", displayOrder: 0 }] },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("Service Description Validation", () => {
    it("returns 404 when service description not found", async () => {
      setupAuthenticatedAdmin();
      mockDb.query.serviceDescriptions.findFirst.mockResolvedValue(null);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/line-items/reorder",
        body: { items: [{ id: "item-1", topicId: "topic-1", displayOrder: 0 }] },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Service description not found");
    });

    it("returns 400 when service description is finalized", async () => {
      setupAuthenticatedAdmin();
      mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
        status: "FINALIZED",
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/line-items/reorder",
        body: { items: [{ id: "item-1", topicId: "topic-1", displayOrder: 0 }] },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot modify finalized service description");
    });
  });

  describe("Body Validation", () => {
    beforeEach(() => {
      setupAuthenticatedAdmin();
      mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
        status: "DRAFT",
      });
    });

    it("returns 400 when items array is missing", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/line-items/reorder",
        body: {},
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Items array is required");
    });

    it("returns 400 when items array is empty", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/line-items/reorder",
        body: { items: [] },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Items array is required");
    });

    it("returns 400 when item has missing id", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/line-items/reorder",
        body: { items: [{ id: "", topicId: "topic-1", displayOrder: 0 }] },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Each item must have a valid id");
    });

    it("returns 400 when item has missing topicId", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/line-items/reorder",
        body: { items: [{ id: "item-1", topicId: "", displayOrder: 0 }] },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Each item must have a valid topicId");
    });

    it("returns 400 when item has negative displayOrder", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/line-items/reorder",
        body: { items: [{ id: "item-1", topicId: "topic-1", displayOrder: -1 }] },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Each item must have a valid displayOrder");
    });
  });

  describe("Topic Ownership Validation", () => {
    beforeEach(() => {
      setupAuthenticatedAdmin();
      mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
        status: "DRAFT",
      });
    });

    it("returns 400 when topicId does not belong to the service description", async () => {
      mockDb.query.serviceDescriptionTopics.findMany.mockResolvedValue([
        { id: "topic-1" },
      ]);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/line-items/reorder",
        body: {
          items: [{ id: "item-1", topicId: "foreign-topic", displayOrder: 0 }],
        },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid topicId - does not belong to this service description");
    });
  });

  describe("Happy Path", () => {
    beforeEach(() => {
      setupAuthenticatedAdmin();
      mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
        status: "DRAFT",
      });
      mockDb.query.serviceDescriptionTopics.findMany.mockResolvedValue([
        { id: "topic-1" },
        { id: "topic-2" },
      ]);
      mockDb.transaction.mockImplementation(async (fn) => {
        await fn(mockDb);
      });
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });
    });

    it("reorders items within the same topic", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/line-items/reorder",
        body: {
          items: [
            { id: "item-1", topicId: "topic-1", displayOrder: 0 },
            { id: "item-2", topicId: "topic-1", displayOrder: 1 },
            { id: "item-3", topicId: "topic-1", displayOrder: 2 },
          ],
        },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it("reorders items across different topics", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/line-items/reorder",
        body: {
          items: [
            { id: "item-1", topicId: "topic-1", displayOrder: 0 },
            { id: "item-2", topicId: "topic-2", displayOrder: 0 },
            { id: "item-3", topicId: "topic-2", displayOrder: 1 },
          ],
        },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("returns 500 when transaction throws", async () => {
      setupAuthenticatedAdmin();
      mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
        status: "DRAFT",
      });
      mockDb.query.serviceDescriptionTopics.findMany.mockResolvedValue([
        { id: "topic-1" },
      ]);
      mockDb.transaction.mockRejectedValue(new Error("Database error"));

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/line-items/reorder",
        body: {
          items: [{ id: "item-1", topicId: "topic-1", displayOrder: 0 }],
        },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to reorder line items");
    });
  });
});
