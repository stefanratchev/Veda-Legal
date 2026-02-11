import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";

const { mockRequireAdmin, mockDb } = vi.hoisted(() => {
  return {
    mockRequireAdmin: vi.fn(),
    mockDb: {
      query: {
        serviceDescriptions: { findFirst: vi.fn() },
      },
      insert: vi.fn(),
    },
  };
});

vi.mock("@/lib/db", () => ({
  db: mockDb,
  serviceDescriptions: { id: "id" },
  serviceDescriptionTopics: {
    id: "id",
    serviceDescriptionId: "sdId",
    topicName: "topicName",
    displayOrder: "displayOrder",
    pricingMode: "pricingMode",
    hourlyRate: "hourlyRate",
    fixedFee: "fixedFee",
    capHours: "capHours",
    discountType: "discountType",
    discountValue: "discountValue",
  },
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...original,
    requireAdmin: mockRequireAdmin,
  };
});

vi.mock("@paralleldrive/cuid2", () => ({ createId: () => "mock-topic-id" }));

// Import route after mocks
import { POST } from "./route";

describe("POST /api/billing/[id]/topics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create successful admin auth
  const mockAdminAuth = () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
  };

  // Helper to create service description mock with topics
  const mockServiceDescription = (overrides?: {
    status?: "DRAFT" | "FINALIZED";
    topics?: Array<{ displayOrder: number }>;
  }) => {
    mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
      status: overrides?.status || "DRAFT",
      topics: overrides?.topics || [],
    });
  };

  // Helper to create successful insert mock
  const mockInsertSuccess = (topicData: {
    id?: string;
    topicName: string;
    displayOrder: number;
    pricingMode: "HOURLY" | "FIXED";
    hourlyRate?: string | null;
    fixedFee?: string | null;
    capHours?: string | null;
    discountType?: string | null;
    discountValue?: string | null;
  }) => {
    const result = {
      id: topicData.id || "mock-topic-id",
      topicName: topicData.topicName,
      displayOrder: topicData.displayOrder,
      pricingMode: topicData.pricingMode,
      hourlyRate: topicData.hourlyRate || null,
      fixedFee: topicData.fixedFee || null,
      capHours: topicData.capHours || null,
      discountType: topicData.discountType || null,
      discountValue: topicData.discountValue || null,
    };

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([result]),
      }),
    });
  };

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAdmin.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: { topicName: "Legal Research" },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: "Unauthorized" });
    });
  });

  describe("Input validation", () => {
    beforeEach(() => {
      mockAdminAuth();
      mockServiceDescription();
    });

    it("returns 400 on invalid JSON", async () => {
      const request = new Request("http://localhost:3000/api/billing/sd-1/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json{",
      }) as any;

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Invalid JSON" });
    });

    it("returns 400 when topicName is missing", async () => {
      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: { pricingMode: "HOURLY" },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Topic name is required" });
    });

    it("returns 400 when topicName is empty string", async () => {
      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: { topicName: "   " },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Topic name is required" });
    });

    it("returns 400 when topicName is not a string", async () => {
      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: { topicName: 123 },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Topic name is required" });
    });
  });

  describe("Discount validation", () => {
    beforeEach(() => {
      mockAdminAuth();
      mockServiceDescription();
    });

    it("returns 400 when discountValue provided without discountType", async () => {
      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: {
          topicName: "Legal Research",
          discountValue: 10,
        },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "discountValue requires a discountType" });
    });

    it("returns 400 when discountValue is not positive", async () => {
      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: {
          topicName: "Legal Research",
          discountType: "AMOUNT",
          discountValue: 0,
        },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "discountValue must be a positive number" });
    });

    it("returns 400 when discountValue is negative", async () => {
      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: {
          topicName: "Legal Research",
          discountType: "AMOUNT",
          discountValue: -5,
        },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "discountValue must be a positive number" });
    });

    it("returns 400 when percentage discount exceeds 100", async () => {
      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: {
          topicName: "Legal Research",
          discountType: "PERCENTAGE",
          discountValue: 150,
        },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Percentage discount cannot exceed 100" });
    });

    it("returns 400 when discountType is invalid", async () => {
      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: {
          topicName: "Legal Research",
          discountType: "INVALID",
          discountValue: 10,
        },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "discountType must be PERCENTAGE or AMOUNT" });
    });
  });

  describe("capHours validation", () => {
    beforeEach(() => {
      mockAdminAuth();
      mockServiceDescription();
    });

    it("returns 400 when capHours is not positive", async () => {
      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: {
          topicName: "Legal Research",
          pricingMode: "HOURLY",
          capHours: 0,
        },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "capHours must be a positive number" });
    });

    it("returns 400 when capHours is negative", async () => {
      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: {
          topicName: "Legal Research",
          pricingMode: "HOURLY",
          capHours: -10,
        },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "capHours must be a positive number" });
    });

    it("returns 400 when capHours is not a number", async () => {
      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: {
          topicName: "Legal Research",
          pricingMode: "HOURLY",
          capHours: "invalid",
        },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "capHours must be a positive number" });
    });
  });

  describe("Service description checks", () => {
    beforeEach(() => {
      mockAdminAuth();
    });

    it("returns 404 when service description not found", async () => {
      mockDb.query.serviceDescriptions.findFirst.mockResolvedValue(null);

      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: { topicName: "Legal Research" },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "Service description not found" });
    });

    it("returns 400 when service description is FINALIZED", async () => {
      mockServiceDescription({ status: "FINALIZED" });

      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: { topicName: "Legal Research" },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Cannot modify finalized service description" });
    });
  });

  describe("Pricing mode handling", () => {
    beforeEach(() => {
      mockAdminAuth();
      mockServiceDescription();
    });

    it("defaults to HOURLY when pricingMode is missing", async () => {
      mockInsertSuccess({
        topicName: "Legal Research",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: "150",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: {
          topicName: "Legal Research",
          hourlyRate: 150,
        },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pricingMode).toBe("HOURLY");

      // Verify the insert was called with HOURLY
      const mockInsert = mockDb.insert.mock.results[0].value;
      const valuesArg = mockInsert.values.mock.calls[0][0];
      expect(valuesArg.pricingMode).toBe("HOURLY");
    });

    it("defaults to HOURLY when pricingMode is invalid", async () => {
      mockInsertSuccess({
        topicName: "Legal Research",
        displayOrder: 1,
        pricingMode: "HOURLY",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: {
          topicName: "Legal Research",
          pricingMode: "INVALID",
        },
      });

      await POST(request, { params: Promise.resolve({ id: "sd-1" }) });

      // Verify the insert was called with HOURLY
      const mockInsert = mockDb.insert.mock.results[0].value;
      const mockValues = mockInsert.values.mock.results[0].value;
      const mockReturning = mockValues.returning.mock.calls[0];

      // Check the values passed to insert
      const valuesArg = mockInsert.values.mock.calls[0][0];
      expect(valuesArg.pricingMode).toBe("HOURLY");
    });

    it("clears capHours when pricingMode is FIXED", async () => {
      mockInsertSuccess({
        topicName: "Legal Research",
        displayOrder: 1,
        pricingMode: "FIXED",
        fixedFee: "5000",
        capHours: null,
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: {
          topicName: "Legal Research",
          pricingMode: "FIXED",
          fixedFee: 5000,
          capHours: 50, // Should be cleared
        },
      });

      await POST(request, { params: Promise.resolve({ id: "sd-1" }) });

      // Verify capHours was set to null in the insert
      const mockInsert = mockDb.insert.mock.results[0].value;
      const valuesArg = mockInsert.values.mock.calls[0][0];
      expect(valuesArg.capHours).toBe(null);
    });
  });

  describe("Display order auto-increment", () => {
    beforeEach(() => {
      mockAdminAuth();
    });

    it("sets displayOrder to 1 when no existing topics", async () => {
      mockServiceDescription({ topics: [] });
      mockInsertSuccess({
        topicName: "Legal Research",
        displayOrder: 1,
        pricingMode: "HOURLY",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: { topicName: "Legal Research" },
      });

      await POST(request, { params: Promise.resolve({ id: "sd-1" }) });

      // Verify displayOrder is 1
      const mockInsert = mockDb.insert.mock.results[0].value;
      const valuesArg = mockInsert.values.mock.calls[0][0];
      expect(valuesArg.displayOrder).toBe(1);
    });

    it("increments displayOrder from max existing order", async () => {
      mockServiceDescription({
        topics: [
          { displayOrder: 1 },
          { displayOrder: 3 },
          { displayOrder: 2 },
        ],
      });
      mockInsertSuccess({
        topicName: "Legal Research",
        displayOrder: 4,
        pricingMode: "HOURLY",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: { topicName: "Legal Research" },
      });

      await POST(request, { params: Promise.resolve({ id: "sd-1" }) });

      // Verify displayOrder is maxOrder + 1 (3 + 1 = 4)
      const mockInsert = mockDb.insert.mock.results[0].value;
      const valuesArg = mockInsert.values.mock.calls[0][0];
      expect(valuesArg.displayOrder).toBe(4);
    });
  });

  describe("Happy path - HOURLY pricing", () => {
    beforeEach(() => {
      mockAdminAuth();
      mockServiceDescription();
    });

    it("creates topic with hourly rate successfully", async () => {
      mockInsertSuccess({
        topicName: "Legal Research",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: "150",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: {
          topicName: "Legal Research",
          pricingMode: "HOURLY",
          hourlyRate: 150,
        },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        id: "mock-topic-id",
        topicName: "Legal Research",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: 150,
        fixedFee: null,
        capHours: null,
        discountType: null,
        discountValue: null,
        lineItems: [],
      });
    });

    it("creates topic with capHours successfully", async () => {
      mockInsertSuccess({
        topicName: "Legal Research",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: "150",
        capHours: "50",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: {
          topicName: "Legal Research",
          pricingMode: "HOURLY",
          hourlyRate: 150,
          capHours: 50,
        },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        id: "mock-topic-id",
        topicName: "Legal Research",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: 150,
        fixedFee: null,
        capHours: 50,
        discountType: null,
        discountValue: null,
        lineItems: [],
      });
    });

    it("trims topicName whitespace", async () => {
      mockInsertSuccess({
        topicName: "Legal Research",
        displayOrder: 1,
        pricingMode: "HOURLY",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: {
          topicName: "  Legal Research  ",
        },
      });

      await POST(request, { params: Promise.resolve({ id: "sd-1" }) });

      // Verify trimmed value was used
      const mockInsert = mockDb.insert.mock.results[0].value;
      const valuesArg = mockInsert.values.mock.calls[0][0];
      expect(valuesArg.topicName).toBe("Legal Research");
    });
  });

  describe("Happy path - FIXED pricing", () => {
    beforeEach(() => {
      mockAdminAuth();
      mockServiceDescription();
    });

    it("creates topic with fixed fee successfully", async () => {
      mockInsertSuccess({
        topicName: "Contract Review",
        displayOrder: 1,
        pricingMode: "FIXED",
        fixedFee: "5000",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: {
          topicName: "Contract Review",
          pricingMode: "FIXED",
          fixedFee: 5000,
        },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        id: "mock-topic-id",
        topicName: "Contract Review",
        displayOrder: 1,
        pricingMode: "FIXED",
        hourlyRate: null,
        fixedFee: 5000,
        capHours: null,
        discountType: null,
        discountValue: null,
        lineItems: [],
      });
    });
  });

  describe("Happy path - with discount", () => {
    beforeEach(() => {
      mockAdminAuth();
      mockServiceDescription();
    });

    it("creates topic with percentage discount successfully", async () => {
      mockInsertSuccess({
        topicName: "Legal Research",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: "150",
        discountType: "PERCENTAGE",
        discountValue: "10",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: {
          topicName: "Legal Research",
          pricingMode: "HOURLY",
          hourlyRate: 150,
          discountType: "PERCENTAGE",
          discountValue: 10,
        },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        id: "mock-topic-id",
        topicName: "Legal Research",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: 150,
        fixedFee: null,
        capHours: null,
        discountType: "PERCENTAGE",
        discountValue: 10,
        lineItems: [],
      });
    });

    it("creates topic with amount discount successfully", async () => {
      mockInsertSuccess({
        topicName: "Legal Research",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: "150",
        discountType: "AMOUNT",
        discountValue: "500",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: {
          topicName: "Legal Research",
          pricingMode: "HOURLY",
          hourlyRate: 150,
          discountType: "AMOUNT",
          discountValue: 500,
        },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        id: "mock-topic-id",
        topicName: "Legal Research",
        displayOrder: 1,
        pricingMode: "HOURLY",
        hourlyRate: 150,
        fixedFee: null,
        capHours: null,
        discountType: "AMOUNT",
        discountValue: 500,
        lineItems: [],
      });
    });
  });

  describe("Database errors", () => {
    beforeEach(() => {
      mockAdminAuth();
      mockServiceDescription();
    });

    it("returns 500 on database error during insert", async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error("Database connection failed")),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: { topicName: "Legal Research" },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Failed to create topic" });
    });

    it("returns 500 on database error during findFirst", async () => {
      mockDb.query.serviceDescriptions.findFirst.mockRejectedValue(
        new Error("Database connection failed")
      );

      const request = createMockRequest({
        method: "POST",
        url: "/api/billing/sd-1/topics",
        body: { topicName: "Legal Research" },
      });

      const response = await POST(request, { params: Promise.resolve({ id: "sd-1" }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Failed to create topic" });
    });
  });
});
