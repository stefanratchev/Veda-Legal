import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";

const { mockRequireAdmin, mockGetUserFromSession, mockDb } = vi.hoisted(() => {
  return {
    mockRequireAdmin: vi.fn(),
    mockGetUserFromSession: vi.fn(),
    mockDb: {
      query: {
        serviceDescriptions: { findFirst: vi.fn() },
        serviceDescriptionTopics: { findMany: vi.fn() },
        serviceDescriptionLineItems: { findFirst: vi.fn() },
      },
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(null)),
    },
  };
});

vi.mock("@/lib/db", () => ({
  db: mockDb,
  serviceDescriptions: { id: "id", status: "status", finalizedAt: "finalizedAt", finalizedById: "finalizedById", updatedAt: "updatedAt", discountType: "discountType", discountValue: "discountValue" },
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...original,
    requireAdmin: mockRequireAdmin,
    getUserFromSession: mockGetUserFromSession,
  };
});

// Import route after mocks
import { GET, PATCH, DELETE } from "./route";

describe("GET /api/billing/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAdmin.mockResolvedValue({ error: "Not authenticated", status: 401 });
    const request = createMockRequest({ method: "GET", url: "/api/billing/sd-1" });
    const response = await GET(request, { params: Promise.resolve({ id: "sd-1" }) });
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Not authenticated");
  });

  it("returns 404 when service description not found", async () => {
    mockRequireAdmin.mockResolvedValue({ session: { user: { email: "admin@test.com" } } });
    mockDb.query.serviceDescriptions.findFirst.mockResolvedValue(null);

    const request = createMockRequest({ method: "GET", url: "/api/billing/sd-1" });
    const response = await GET(request, { params: Promise.resolve({ id: "sd-1" }) });

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("Service description not found");
  });

  it("returns serialized service description with nested data", async () => {
    mockRequireAdmin.mockResolvedValue({ session: { user: { email: "admin@test.com" } } });

    const mockSd = {
      id: "sd-1",
      clientId: "client-1",
      client: {
        id: "client-1",
        name: "Test Client",
        invoicedName: null,
        invoiceAttn: null,
        hourlyRate: "150.00",
        notes: "Billing preference: summarize by topic",
      },
      periodStart: "2024-01-01",
      periodEnd: "2024-01-31",
      status: "DRAFT",
      finalizedAt: null,
      discountType: "PERCENTAGE",
      discountValue: "10.00",
      topics: [
        {
          id: "topic-1",
          topicName: "Corporate Law",
          displayOrder: 0,
          pricingMode: "HOURLY",
          hourlyRate: "200.00",
          fixedFee: null,
          capHours: "50.00",
          discountType: null,
          discountValue: null,
          lineItems: [
            {
              id: "line-1",
              timeEntryId: "entry-1",
              date: "2024-01-15",
              description: "Legal research",
              hours: "2.50",
              displayOrder: 0,
              timeEntry: {
                description: "Original description",
                hours: "2.50",
                user: { name: "John Doe" },
              },
            },
          ],
        },
      ],
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    mockDb.query.serviceDescriptions.findFirst.mockResolvedValue(mockSd);

    const request = createMockRequest({ method: "GET", url: "/api/billing/sd-1" });
    const response = await GET(request, { params: Promise.resolve({ id: "sd-1" }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.id).toBe("sd-1");
    expect(json.client.name).toBe("Test Client");
    expect(json.client.hourlyRate).toBe(150);
    expect(json.client.notes).toBe("Billing preference: summarize by topic");
    expect(json.discountType).toBe("PERCENTAGE");
    expect(json.discountValue).toBe(10);
    expect(json.topics).toHaveLength(1);
    expect(json.topics[0].topicName).toBe("Corporate Law");
    expect(json.topics[0].hourlyRate).toBe(200);
    expect(json.topics[0].capHours).toBe(50);
    expect(json.topics[0].lineItems).toHaveLength(1);
    expect(json.topics[0].lineItems[0].hours).toBe(2.5);
    expect(json.topics[0].lineItems[0].employeeName).toBe("John Doe");
    expect(json.topics[0].lineItems[0].originalDescription).toBe("Original description");
  });
});

describe("PATCH /api/billing/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAdmin.mockResolvedValue({ error: "Not authenticated", status: 401 });
    const request = createMockRequest({
      method: "PATCH",
      url: "/api/billing/sd-1",
      body: { status: "FINALIZED" },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "sd-1" }) });
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Not authenticated");
  });

  it("returns 400 for invalid JSON", async () => {
    mockRequireAdmin.mockResolvedValue({ session: { user: { email: "admin@test.com" } } });

    // Create a request with invalid JSON by modifying the body
    const request = new Request("http://localhost:3000/api/billing/sd-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "invalid json{",
    });

    const response = await PATCH(request as any, { params: Promise.resolve({ id: "sd-1" }) });
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid JSON");
  });

  it("returns 400 for invalid status value", async () => {
    mockRequireAdmin.mockResolvedValue({ session: { user: { email: "admin@test.com" } } });
    const request = createMockRequest({
      method: "PATCH",
      url: "/api/billing/sd-1",
      body: { status: "INVALID_STATUS" },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "sd-1" }) });
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Invalid status");
  });

  it("returns 400 when no update fields provided", async () => {
    mockRequireAdmin.mockResolvedValue({ session: { user: { email: "admin@test.com" } } });
    const request = createMockRequest({
      method: "PATCH",
      url: "/api/billing/sd-1",
      body: {},
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "sd-1" }) });
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("No update fields provided");
  });

  it("returns 404 when service description not found", async () => {
    mockRequireAdmin.mockResolvedValue({ session: { user: { email: "admin@test.com" } } });
    mockDb.query.serviceDescriptions.findFirst.mockResolvedValue(null);

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/billing/sd-1",
      body: { status: "FINALIZED" },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "sd-1" }) });

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("Service description not found");
  });

  it("returns 400 when trying to change discount on finalized service description", async () => {
    mockRequireAdmin.mockResolvedValue({ session: { user: { email: "admin@test.com" } } });
    mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
      status: "FINALIZED",
      discountType: "PERCENTAGE",
      discountValue: "10.00",
    });

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/billing/sd-1",
      body: { discountType: "AMOUNT", discountValue: 100 },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "sd-1" }) });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Cannot modify finalized service description");
  });

  it("returns 400 when discountValue provided without discountType", async () => {
    mockRequireAdmin.mockResolvedValue({ session: { user: { email: "admin@test.com" } } });
    mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
      status: "DRAFT",
      discountType: null,
      discountValue: null,
    });

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/billing/sd-1",
      body: { discountValue: 10 },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "sd-1" }) });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("discountValue requires a discountType");
  });

  it("returns 400 when discountValue is not positive", async () => {
    mockRequireAdmin.mockResolvedValue({ session: { user: { email: "admin@test.com" } } });
    mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
      status: "DRAFT",
      discountType: null,
      discountValue: null,
    });

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/billing/sd-1",
      body: { discountType: "PERCENTAGE", discountValue: -10 },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "sd-1" }) });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("discountValue must be a positive number");
  });

  it("returns 400 when percentage discount exceeds 100", async () => {
    mockRequireAdmin.mockResolvedValue({ session: { user: { email: "admin@test.com" } } });
    mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
      status: "DRAFT",
      discountType: null,
      discountValue: null,
    });

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/billing/sd-1",
      body: { discountType: "PERCENTAGE", discountValue: 150 },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "sd-1" }) });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Percentage discount cannot exceed 100");
  });

  it("finalizes service description with timestamp and user ID", async () => {
    mockRequireAdmin.mockResolvedValue({ session: { user: { email: "admin@test.com" } } });
    mockGetUserFromSession.mockResolvedValue({ id: "user-123" });
    mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
      status: "DRAFT",
      discountType: null,
      discountValue: null,
    });

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: "sd-1",
            status: "FINALIZED",
            finalizedAt: "2024-01-15T10:00:00.000Z",
          }]),
        }),
      }),
    });
    mockDb.update = mockUpdate;

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/billing/sd-1",
      body: { status: "FINALIZED" },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "sd-1" }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.id).toBe("sd-1");
    expect(json.status).toBe("FINALIZED");
    expect(json.finalizedAt).toBe("2024-01-15T10:00:00.000Z");

    // Verify the update call includes finalized fields
    expect(mockUpdate).toHaveBeenCalled();
    const updateCall = mockUpdate.mock.results[0].value.set.mock.calls[0][0];
    expect(updateCall.status).toBe("FINALIZED");
    expect(updateCall.finalizedAt).toBeDefined();
    expect(updateCall.finalizedById).toBe("user-123");
  });

  it("unlocks service description by clearing finalized fields", async () => {
    mockRequireAdmin.mockResolvedValue({ session: { user: { email: "admin@test.com" } } });
    mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
      status: "FINALIZED",
      discountType: null,
      discountValue: null,
    });

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: "sd-1",
            status: "DRAFT",
            finalizedAt: null,
          }]),
        }),
      }),
    });
    mockDb.update = mockUpdate;

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/billing/sd-1",
      body: { status: "DRAFT" },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "sd-1" }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.id).toBe("sd-1");
    expect(json.status).toBe("DRAFT");
    expect(json.finalizedAt).toBe(null);

    // Verify the update call clears finalized fields
    expect(mockUpdate).toHaveBeenCalled();
    const updateCall = mockUpdate.mock.results[0].value.set.mock.calls[0][0];
    expect(updateCall.status).toBe("DRAFT");
    expect(updateCall.finalizedAt).toBe(null);
    expect(updateCall.finalizedById).toBe(null);
  });

  it("updates discount on draft service description", async () => {
    mockRequireAdmin.mockResolvedValue({ session: { user: { email: "admin@test.com" } } });
    mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
      status: "DRAFT",
      discountType: null,
      discountValue: null,
    });

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: "sd-1",
            status: "DRAFT",
            finalizedAt: null,
          }]),
        }),
      }),
    });
    mockDb.update = mockUpdate;

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/billing/sd-1",
      body: { discountType: "PERCENTAGE", discountValue: 15 },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "sd-1" }) });

    expect(response.status).toBe(200);

    // Verify the update call includes discount fields
    expect(mockUpdate).toHaveBeenCalled();
    const updateCall = mockUpdate.mock.results[0].value.set.mock.calls[0][0];
    expect(updateCall.discountType).toBe("PERCENTAGE");
    expect(updateCall.discountValue).toBe("15");
  });

  it("clears discount when discountType is set to null", async () => {
    mockRequireAdmin.mockResolvedValue({ session: { user: { email: "admin@test.com" } } });
    mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
      status: "DRAFT",
      discountType: "PERCENTAGE",
      discountValue: "10.00",
    });

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: "sd-1",
            status: "DRAFT",
            finalizedAt: null,
          }]),
        }),
      }),
    });
    mockDb.update = mockUpdate;

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/billing/sd-1",
      body: { discountType: null, discountValue: null },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "sd-1" }) });

    expect(response.status).toBe(200);

    // Verify the update call clears discount fields
    expect(mockUpdate).toHaveBeenCalled();
    const updateCall = mockUpdate.mock.results[0].value.set.mock.calls[0][0];
    expect(updateCall.discountType).toBe(null);
    expect(updateCall.discountValue).toBe(null);
  });
});

describe("DELETE /api/billing/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAdmin.mockResolvedValue({ error: "Not authenticated", status: 401 });
    const request = createMockRequest({ method: "DELETE", url: "/api/billing/sd-1" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "sd-1" }) });
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Not authenticated");
  });

  it("returns 404 when service description not found", async () => {
    mockRequireAdmin.mockResolvedValue({ session: { user: { email: "admin@test.com" } } });
    mockDb.query.serviceDescriptions.findFirst.mockResolvedValue(null);

    const request = createMockRequest({ method: "DELETE", url: "/api/billing/sd-1" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "sd-1" }) });

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("Service description not found");
  });

  it("returns 400 when trying to delete finalized service description", async () => {
    mockRequireAdmin.mockResolvedValue({ session: { user: { email: "admin@test.com" } } });
    mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
      status: "FINALIZED",
    });

    const request = createMockRequest({ method: "DELETE", url: "/api/billing/sd-1" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "sd-1" }) });

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Cannot delete finalized service description");
  });

  it("successfully deletes draft service description", async () => {
    mockRequireAdmin.mockResolvedValue({ session: { user: { email: "admin@test.com" } } });
    mockDb.query.serviceDescriptions.findFirst.mockResolvedValue({
      status: "DRAFT",
    });

    const mockDelete = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    // Transaction mock: pass a tx with query, delete, and update methods
    mockDb.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        query: {
          serviceDescriptionTopics: {
            findMany: vi.fn().mockResolvedValue([]),  // No written-off items
          },
          serviceDescriptionLineItems: { findFirst: vi.fn() },
        },
        delete: mockDelete,
        update: mockUpdate,
      };
      return cb(tx);
    });

    const request = createMockRequest({ method: "DELETE", url: "/api/billing/sd-1" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "sd-1" }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });
});
