import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireAdmin, mockDb } = vi.hoisted(() => {
  return {
    mockRequireAdmin: vi.fn(),
    mockDb: {
      query: {
        serviceDescriptions: { findFirst: vi.fn() },
        serviceDescriptionTopics: { findFirst: vi.fn() },
        serviceDescriptionLineItems: { findMany: vi.fn(), findFirst: vi.fn() },
      },
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    },
  };
});

vi.mock("@/lib/db", () => ({
  db: mockDb,
  serviceDescriptions: { id: "id", status: "status" },
  serviceDescriptionTopics: {
    id: "id",
    serviceDescriptionId: "serviceDescriptionId",
    discountType: "discountType",
    discountValue: "discountValue",
    topicName: "topicName",
    displayOrder: "displayOrder",
    pricingMode: "pricingMode",
    hourlyRate: "hourlyRate",
    fixedFee: "fixedFee",
    capHours: "capHours",
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

// Import routes after mocks are set up
import { PATCH, DELETE } from "./route";

// Helper to set up authenticated admin
function setupAuthenticatedAdmin() {
  mockRequireAdmin.mockResolvedValue({
    session: { user: { name: "Admin", email: "admin@example.com" } },
  });
}

// Helper to create chainable mock for update query
function createUpdateChain(result: unknown) {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([result]),
      }),
    }),
  };
}

// Helper to create chainable mock for delete query
function createDeleteChain() {
  return {
    where: vi.fn().mockResolvedValue(undefined),
  };
}

describe("PATCH /api/billing/[id]/topics/[topicId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAdmin.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { topicName: "Updated Topic" },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
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
        url: "/api/billing/sd-1/topics/topic-1",
        body: { topicName: "Updated Topic" },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
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
        url: "/api/billing/sd-1/topics/topic-1",
        body: { topicName: "Updated Topic" },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot modify finalized service description");
    });
  });

  describe("Topic Validation", () => {
    it("returns 404 when topic not found", async () => {
      setupAuthenticatedAdmin();
      mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
        status: "DRAFT",
      });
      mockDb.query.serviceDescriptionTopics.findFirst.mockResolvedValue(null);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { topicName: "Updated Topic" },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Topic not found");
    });
  });

  describe("Discount Validation", () => {
    beforeEach(() => {
      setupAuthenticatedAdmin();
      mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
        status: "DRAFT",
      });
    });

    it("returns 400 for invalid discount type", async () => {
      mockDb.query.serviceDescriptionTopics.findFirst.mockResolvedValue({
        discountType: null,
        discountValue: null,
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { discountType: "INVALID" },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("discountType must be PERCENTAGE or AMOUNT");
    });

    it("returns 400 for discount value without type", async () => {
      mockDb.query.serviceDescriptionTopics.findFirst.mockResolvedValue({
        discountType: null,
        discountValue: null,
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { discountValue: 100 },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("discountValue requires a discountType");
    });

    it("returns 400 for negative discount value", async () => {
      mockDb.query.serviceDescriptionTopics.findFirst.mockResolvedValue({
        discountType: null,
        discountValue: null,
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { discountType: "PERCENTAGE", discountValue: -10 },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("discountValue must be a positive number");
    });

    it("returns 400 for zero discount value", async () => {
      mockDb.query.serviceDescriptionTopics.findFirst.mockResolvedValue({
        discountType: null,
        discountValue: null,
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { discountType: "AMOUNT", discountValue: 0 },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("discountValue must be a positive number");
    });

    it("returns 400 for percentage discount over 100", async () => {
      mockDb.query.serviceDescriptionTopics.findFirst.mockResolvedValue({
        discountType: null,
        discountValue: null,
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { discountType: "PERCENTAGE", discountValue: 150 },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Percentage discount cannot exceed 100");
    });

    it("allows discount type without value", async () => {
      setupAuthenticatedAdmin();
      mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
        status: "DRAFT",
      });
      mockDb.query.serviceDescriptionTopics.findFirst.mockResolvedValue({
        discountType: null,
        discountValue: null,
      });

      const updatedTopic = {
        id: "topic-1",
        topicName: "Tax Advisory",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: "200.00",
        fixedFee: null,
        capHours: null,
        discountType: "PERCENTAGE",
        discountValue: null,
      };

      mockDb.update.mockReturnValue(createUpdateChain(updatedTopic));

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { discountType: "PERCENTAGE" },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.discountType).toBe("PERCENTAGE");
      expect(data.discountValue).toBeNull();
    });

    it("merges discount value with existing type from DB", async () => {
      setupAuthenticatedAdmin();
      mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
        status: "DRAFT",
      });
      mockDb.query.serviceDescriptionTopics.findFirst.mockResolvedValue({
        discountType: "PERCENTAGE",
        discountValue: null,
      });

      const updatedTopic = {
        id: "topic-1",
        topicName: "Tax Advisory",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: "200.00",
        fixedFee: null,
        capHours: null,
        discountType: "PERCENTAGE",
        discountValue: "15.00",
      };

      mockDb.update.mockReturnValue(createUpdateChain(updatedTopic));

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { discountValue: 15 },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.discountType).toBe("PERCENTAGE");
      expect(data.discountValue).toBe(15);
    });
  });

  describe("capHours Validation", () => {
    beforeEach(() => {
      setupAuthenticatedAdmin();
      mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
        status: "DRAFT",
      });
      mockDb.query.serviceDescriptionTopics.findFirst.mockResolvedValue({
        discountType: null,
        discountValue: null,
      });
    });

    it("returns 400 for negative capHours", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { capHours: -10 },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("capHours must be a positive number");
    });

    it("returns 400 for zero capHours", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { capHours: 0 },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("capHours must be a positive number");
    });

    it("returns 400 for non-numeric capHours", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { capHours: "invalid" },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("capHours must be a positive number");
    });

    it("accepts valid positive capHours", async () => {
      const updatedTopic = {
        id: "topic-1",
        topicName: "Tax Advisory",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: "200.00",
        fixedFee: null,
        capHours: "50.00",
        discountType: null,
        discountValue: null,
      };

      mockDb.update.mockReturnValue(createUpdateChain(updatedTopic));

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { capHours: 50 },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.capHours).toBe(50);
    });
  });

  describe("pricingMode Validation", () => {
    beforeEach(() => {
      setupAuthenticatedAdmin();
      mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
        status: "DRAFT",
      });
      mockDb.query.serviceDescriptionTopics.findFirst.mockResolvedValue({
        discountType: null,
        discountValue: null,
      });
    });

    it("returns 400 for invalid pricingMode", async () => {
      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { pricingMode: "INVALID" },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("pricingMode must be HOURLY or FIXED");
    });

    it("clears capHours when pricingMode is FIXED", async () => {
      const updatedTopic = {
        id: "topic-1",
        topicName: "Tax Advisory",
        displayOrder: 1,
        pricingMode: "FIXED",
        hourlyRate: null,
        fixedFee: "5000.00",
        capHours: null,
        discountType: null,
        discountValue: null,
      };

      mockDb.update.mockReturnValue(createUpdateChain(updatedTopic));

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { pricingMode: "FIXED", capHours: 50 }, // Trying to set capHours with FIXED mode
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pricingMode).toBe("FIXED");
      expect(data.capHours).toBeNull(); // Should be null despite being sent in body
    });
  });

  describe("Happy Path", () => {
    beforeEach(() => {
      setupAuthenticatedAdmin();
      mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
        status: "DRAFT",
      });
      mockDb.query.serviceDescriptionTopics.findFirst.mockResolvedValue({
        discountType: null,
        discountValue: null,
      });
    });

    it("updates topic successfully with all fields", async () => {
      const updatedTopic = {
        id: "topic-1",
        topicName: "Updated Topic Name",
        displayOrder: 5,
        pricingMode: "HOURLY",
        hourlyRate: "250.00",
        fixedFee: null,
        capHours: "100.00",
        discountType: "PERCENTAGE",
        discountValue: "10.00",
      };

      mockDb.update.mockReturnValue(createUpdateChain(updatedTopic));

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: {
          topicName: "Updated Topic Name",
          displayOrder: 5,
          pricingMode: "HOURLY",
          hourlyRate: 250,
          capHours: 100,
          discountType: "PERCENTAGE",
          discountValue: 10,
        },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("topic-1");
      expect(data.topicName).toBe("Updated Topic Name");
      expect(data.displayOrder).toBe(5);
      expect(data.pricingMode).toBe("HOURLY");
      expect(data.hourlyRate).toBe(250);
      expect(data.capHours).toBe(100);
      expect(data.discountType).toBe("PERCENTAGE");
      expect(data.discountValue).toBe(10);
    });

    it("serializes decimal fields to numbers", async () => {
      const updatedTopic = {
        id: "topic-1",
        topicName: "Tax Advisory",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: "200.00",
        fixedFee: null,
        capHours: "50.50",
        discountType: "AMOUNT",
        discountValue: "100.25",
      };

      mockDb.update.mockReturnValue(createUpdateChain(updatedTopic));

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { capHours: 50.5, discountType: "AMOUNT", discountValue: 100.25 },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hourlyRate).toBe(200);
      expect(data.capHours).toBe(50.5);
      expect(data.discountValue).toBe(100.25);
    });

    it("handles null values for optional fields", async () => {
      const updatedTopic = {
        id: "topic-1",
        topicName: "Tax Advisory",
        displayOrder: 1,
        pricingMode: "FIXED",
        hourlyRate: null,
        fixedFee: "5000.00",
        capHours: null,
        discountType: null,
        discountValue: null,
      };

      mockDb.update.mockReturnValue(createUpdateChain(updatedTopic));

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { pricingMode: "FIXED", fixedFee: 5000 },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hourlyRate).toBeNull();
      expect(data.capHours).toBeNull();
      expect(data.discountType).toBeNull();
      expect(data.discountValue).toBeNull();
    });

    it("trims topicName whitespace", async () => {
      const updatedTopic = {
        id: "topic-1",
        topicName: "Trimmed Topic",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: "200.00",
        fixedFee: null,
        capHours: null,
        discountType: null,
        discountValue: null,
      };

      mockDb.update.mockReturnValue(createUpdateChain(updatedTopic));

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { topicName: "  Trimmed Topic  " },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });

      // Verify that the update was called with trimmed value
      expect(mockDb.update).toHaveBeenCalled();
      const setCall = mockDb.update.mock.results[0].value.set;
      expect(setCall).toHaveBeenCalledWith(
        expect.objectContaining({
          topicName: "Trimmed Topic",
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("returns 400 for invalid JSON", async () => {
      setupAuthenticatedAdmin();

      // Create a request with malformed JSON
      const request = new Request("http://localhost:3000/api/billing/sd-1/topics/topic-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json",
      });

      const response = await PATCH(request as any, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON");
    });

    it("returns 500 on database error", async () => {
      setupAuthenticatedAdmin();
      mockDb.query.serviceDescriptions.findFirst.mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/billing/sd-1/topics/topic-1",
        body: { topicName: "Updated Topic" },
      });

      const response = await PATCH(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to update topic");
    });
  });
});

describe("DELETE /api/billing/[id]/topics/[topicId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAdmin.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/billing/sd-1/topics/topic-1",
      });

      const response = await DELETE(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
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
        method: "DELETE",
        url: "/api/billing/sd-1/topics/topic-1",
      });

      const response = await DELETE(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
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
        method: "DELETE",
        url: "/api/billing/sd-1/topics/topic-1",
      });

      const response = await DELETE(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot modify finalized service description");
    });
  });

  describe("Topic Validation", () => {
    it("returns 404 when topic not found", async () => {
      setupAuthenticatedAdmin();
      mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
        status: "DRAFT",
      });
      mockDb.query.serviceDescriptionTopics.findFirst.mockResolvedValue(null);

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/billing/sd-1/topics/topic-1",
      });

      const response = await DELETE(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Topic not found");
    });
  });

  describe("Happy Path", () => {
    it("deletes topic successfully", async () => {
      setupAuthenticatedAdmin();
      mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
        status: "DRAFT",
      });
      mockDb.query.serviceDescriptionTopics.findFirst.mockResolvedValue({
        id: "topic-1",
      });

      // Setup transaction mock — tx is the mockDb itself
      mockDb.transaction.mockImplementation(
        async (cb: (tx: typeof mockDb) => Promise<unknown>) => cb(mockDb)
      );

      // No written-off line items in this topic
      mockDb.query.serviceDescriptionLineItems.findMany.mockResolvedValue([]);
      mockDb.delete.mockReturnValue(createDeleteChain());

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/billing/sd-1/topics/topic-1",
      });

      const response = await DELETE(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error", async () => {
      setupAuthenticatedAdmin();
      mockDb.query.serviceDescriptions.findFirst.mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/billing/sd-1/topics/topic-1",
      });

      const response = await DELETE(request, {
        params: Promise.resolve({ id: "sd-1", topicId: "topic-1" }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to delete topic");
    });
  });
});
