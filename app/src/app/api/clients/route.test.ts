import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser, createMockClient } from "@/test/mocks/factories";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireAuth, mockRequireWriteAccess, mockDb } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequireWriteAccess: vi.fn(),
  mockDb: {
    query: {
      clients: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
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
    requireWriteAccess: mockRequireWriteAccess,
  };
});

// Import route after mocks are set up
import { GET, POST, PATCH, DELETE } from "./route";

describe("GET /api/clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "GET",
        url: "/api/clients",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("Happy Path", () => {
    it("returns all clients", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const clients = [
        {
          id: "client-1",
          name: "Client One",
          invoicedName: null,
          invoiceAttn: null,
          email: "client1@example.com",
          secondaryEmails: null,
          hourlyRate: "150.00",
          status: "ACTIVE",
          notes: null,
          createdAt: "2024-12-20T10:00:00.000Z",
        },
        {
          id: "client-2",
          name: "Client Two",
          invoicedName: "Client Two LLC",
          invoiceAttn: "John Doe",
          email: "client2@example.com",
          secondaryEmails: "billing@client2.com",
          hourlyRate: "200.00",
          status: "ACTIVE",
          notes: "VIP client",
          createdAt: "2024-12-19T10:00:00.000Z",
        },
      ];

      mockDb.query.clients.findMany.mockResolvedValue(clients);

      const request = createMockRequest({
        method: "GET",
        url: "/api/clients",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe("Client One");
      expect(data[1].name).toBe("Client Two");
    });

    it("serializes hourlyRate decimal to number", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const clients = [
        {
          id: "client-1",
          name: "Client One",
          invoicedName: null,
          invoiceAttn: null,
          email: null,
          secondaryEmails: null,
          hourlyRate: "150.50",
          status: "ACTIVE",
          notes: null,
          createdAt: "2024-12-20T10:00:00.000Z",
        },
      ];

      mockDb.query.clients.findMany.mockResolvedValue(clients);

      const request = createMockRequest({
        method: "GET",
        url: "/api/clients",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(typeof data[0].hourlyRate).toBe("number");
      expect(data[0].hourlyRate).toBe(150.5);
    });

    it("handles null hourlyRate", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const clients = [
        {
          id: "client-1",
          name: "Client One",
          invoicedName: null,
          invoiceAttn: null,
          email: null,
          secondaryEmails: null,
          hourlyRate: null,
          status: "ACTIVE",
          notes: null,
          createdAt: "2024-12-20T10:00:00.000Z",
        },
      ];

      mockDb.query.clients.findMany.mockResolvedValue(clients);

      const request = createMockRequest({
        method: "GET",
        url: "/api/clients",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data[0].hourlyRate).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.clients.findMany.mockRejectedValue(new Error("Database connection failed"));

      const request = createMockRequest({
        method: "GET",
        url: "/api/clients",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch clients");
    });
  });
});

describe("POST /api/clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validBody = {
    name: "New Client",
    email: "newclient@example.com",
    hourlyRate: 150,
    status: "ACTIVE",
  };

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireWriteAccess.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 403 when user lacks write access", async () => {
      mockRequireWriteAccess.mockResolvedValue({ error: "Forbidden", status: 403 });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });
  });

  describe("Validation", () => {
    it("returns 400 for invalid JSON body", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = new NextRequest("http://localhost:3000/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json }",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON");
    });

    it("returns 400 when name is missing", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: { ...validBody, name: undefined },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name is required");
    });

    it("returns 400 when name is empty string", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: { ...validBody, name: "   " },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name is required");
    });

    it("returns 400 when name exceeds max length", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: { ...validBody, name: "A".repeat(256) },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("cannot exceed");
    });

    it("returns 400 for invalid email format", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: { ...validBody, email: "not-an-email" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid email format");
    });

    it("returns 400 for negative hourly rate", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: { ...validBody, hourlyRate: -50 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Hourly rate must be a positive number");
    });

    it("returns 400 for invalid status", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: { ...validBody, status: "INVALID_STATUS" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid status value");
    });
  });

  describe("Happy Path", () => {
    it("creates client with valid data", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const createdClient = {
        id: "client-123",
        name: "New Client",
        invoicedName: null,
        invoiceAttn: null,
        email: "newclient@example.com",
        secondaryEmails: null,
        hourlyRate: "150",
        status: "ACTIVE",
        notes: null,
        createdAt: "2024-12-20T10:00:00.000Z",
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdClient]),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("client-123");
      expect(data.name).toBe("New Client");
      expect(data.email).toBe("newclient@example.com");
      expect(data.hourlyRate).toBe(150); // Serialized to number
    });

    it("allows creating client without email", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const createdClient = {
        id: "client-123",
        name: "New Client",
        invoicedName: null,
        invoiceAttn: null,
        email: null,
        secondaryEmails: null,
        hourlyRate: "150",
        status: "ACTIVE",
        notes: null,
        createdAt: "2024-12-20T10:00:00.000Z",
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdClient]),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: { name: "New Client", hourlyRate: 150 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.email).toBeNull();
    });

    it("defaults status to ACTIVE when not provided", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const createdClient = {
        id: "client-123",
        name: "New Client",
        invoicedName: null,
        invoiceAttn: null,
        email: null,
        secondaryEmails: null,
        hourlyRate: null,
        status: "ACTIVE",
        notes: null,
        createdAt: "2024-12-20T10:00:00.000Z",
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdClient]),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: { name: "New Client" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("ACTIVE");
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error("Database connection failed")),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/clients",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to create client");
    });
  });
});

describe("PATCH /api/clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireWriteAccess.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/clients",
        body: { id: "client-123", name: "Updated Name" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 403 when user lacks write access", async () => {
      mockRequireWriteAccess.mockResolvedValue({ error: "Forbidden", status: 403 });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/clients",
        body: { id: "client-123", name: "Updated Name" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });
  });

  describe("Validation", () => {
    it("returns 400 for invalid JSON body", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = new NextRequest("http://localhost:3000/api/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json }",
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON");
    });

    it("returns 400 when client ID is missing", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/clients",
        body: { name: "Updated Name" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Client ID is required");
    });

    it("returns 400 when name is empty string", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/clients",
        body: { id: "client-123", name: "   " },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name cannot be empty");
    });

    it("returns 400 when name exceeds max length", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/clients",
        body: { id: "client-123", name: "A".repeat(256) },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("cannot exceed");
    });

    it("returns 400 for invalid email format", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/clients",
        body: { id: "client-123", email: "not-an-email" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid email format");
    });

    it("returns 400 for negative hourly rate", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/clients",
        body: { id: "client-123", hourlyRate: -50 },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Hourly rate must be a positive number");
    });

    it("returns 400 for invalid status", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/clients",
        body: { id: "client-123", status: "INVALID_STATUS" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid status value");
    });
  });

  describe("Happy Path", () => {
    it("updates client with valid data", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const updatedClient = {
        id: "client-123",
        name: "Updated Client Name",
        invoicedName: null,
        invoiceAttn: null,
        email: "updated@example.com",
        secondaryEmails: null,
        hourlyRate: "200.00",
        status: "ACTIVE",
        notes: null,
        createdAt: "2024-12-20T10:00:00.000Z",
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedClient]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/clients",
        body: { id: "client-123", name: "Updated Client Name", email: "updated@example.com", hourlyRate: 200 },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("client-123");
      expect(data.name).toBe("Updated Client Name");
      expect(data.email).toBe("updated@example.com");
      expect(data.hourlyRate).toBe(200); // Serialized to number
    });

    it("updates only specific fields", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const updatedClient = {
        id: "client-123",
        name: "Original Name",
        invoicedName: null,
        invoiceAttn: null,
        email: "original@example.com",
        secondaryEmails: null,
        hourlyRate: "175.00",
        status: "ACTIVE",
        notes: null,
        createdAt: "2024-12-20T10:00:00.000Z",
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedClient]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/clients",
        body: { id: "client-123", hourlyRate: 175 },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hourlyRate).toBe(175);
    });

    it("can set optional fields to null", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const updatedClient = {
        id: "client-123",
        name: "Client Name",
        invoicedName: null,
        invoiceAttn: null,
        email: null,
        secondaryEmails: null,
        hourlyRate: null,
        status: "ACTIVE",
        notes: null,
        createdAt: "2024-12-20T10:00:00.000Z",
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedClient]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/clients",
        body: { id: "client-123", email: "", hourlyRate: "" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.email).toBeNull();
      expect(data.hourlyRate).toBeNull();
    });
  });

  describe("Not Found", () => {
    it("returns 404 when client not found", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/clients",
        body: { id: "nonexistent-id", name: "Updated Name" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Client not found");
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue(new Error("Database connection failed")),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/clients",
        body: { id: "client-123", name: "Updated Name" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to update client");
    });
  });
});

describe("DELETE /api/clients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireWriteAccess.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/clients?id=client-123",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 403 when user lacks write access", async () => {
      mockRequireWriteAccess.mockResolvedValue({ error: "Forbidden", status: 403 });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/clients?id=client-123",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });
  });

  describe("Validation", () => {
    it("returns 400 when client ID is missing", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/clients",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Client ID is required");
    });
  });

  describe("Not Found", () => {
    it("returns 404 when client not found", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.clients.findFirst.mockResolvedValue(null);

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/clients?id=nonexistent-id",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Client not found");
    });
  });

  describe("Business Rules", () => {
    it("returns 400 when client has existing time entries", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.clients.findFirst.mockResolvedValue({
        id: "client-123",
        name: "Client with entries",
        timeEntries: [{ id: "entry-1" }], // Has time entries
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/clients?id=client-123",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot delete client with existing time entries");
    });
  });

  describe("Happy Path", () => {
    it("deletes client and returns success", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.clients.findFirst.mockResolvedValue({
        id: "client-123",
        name: "Client without entries",
        timeEntries: [], // No time entries
      });

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/clients?id=client-123",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error during lookup", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.clients.findFirst.mockRejectedValue(new Error("Database connection failed"));

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/clients?id=client-123",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to delete client");
    });

    it("returns 500 on database error during delete", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.clients.findFirst.mockResolvedValue({
        id: "client-123",
        name: "Client without entries",
        timeEntries: [],
      });

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error("Database connection failed")),
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/clients?id=client-123",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to delete client");
    });
  });
});
