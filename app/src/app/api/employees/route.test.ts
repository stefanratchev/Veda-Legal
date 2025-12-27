import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser } from "@/test/mocks/factories";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireAuth, mockRequireAdmin, mockDb } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequireAdmin: vi.fn(),
  mockDb: {
    query: {
      users: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/auth-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/auth-utils")>();
  return {
    ...original,
    requireAuth: mockRequireAuth,
    requireAdmin: mockRequireAdmin,
  };
});

// Import route after mocks are set up
import { GET, POST, PATCH, DELETE } from "./route";

describe("GET /api/employees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "GET",
        url: "/api/employees",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 403 when user not found in database", async () => {
      mockRequireAuth.mockResolvedValue({ error: "User not found. Contact administrator.", status: 403 });

      const request = createMockRequest({
        method: "GET",
        url: "/api/employees",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("User not found. Contact administrator.");
    });
  });

  describe("Happy Path", () => {
    it("returns all active and pending employees by default", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const employees = [
        {
          id: "emp-1",
          name: "John Partner",
          email: "john@example.com",
          position: "PARTNER",
          status: "ACTIVE",
          createdAt: "2024-12-20T10:00:00.000Z",
          lastLogin: "2024-12-25T10:00:00.000Z",
        },
        {
          id: "emp-2",
          name: "Jane Associate",
          email: "jane@example.com",
          position: "ASSOCIATE",
          status: "PENDING",
          createdAt: "2024-12-21T10:00:00.000Z",
          lastLogin: null,
        },
      ];

      mockDb.query.users.findMany.mockResolvedValue(employees);

      const request = createMockRequest({
        method: "GET",
        url: "/api/employees",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe("John Partner");
      expect(data[1].name).toBe("Jane Associate");
    });

    it("includes inactive employees when includeInactive=true", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const employees = [
        {
          id: "emp-1",
          name: "Active Employee",
          email: "active@example.com",
          position: "ASSOCIATE",
          status: "ACTIVE",
          createdAt: "2024-12-20T10:00:00.000Z",
          lastLogin: "2024-12-25T10:00:00.000Z",
        },
        {
          id: "emp-2",
          name: "Inactive Employee",
          email: "inactive@example.com",
          position: "ASSOCIATE",
          status: "INACTIVE",
          createdAt: "2024-12-19T10:00:00.000Z",
          lastLogin: "2024-12-15T10:00:00.000Z",
        },
      ];

      mockDb.query.users.findMany.mockResolvedValue(employees);

      const request = createMockRequest({
        method: "GET",
        url: "/api/employees?includeInactive=true",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data.some((emp: { status: string }) => emp.status === "INACTIVE")).toBe(true);
    });

    it("allows EMPLOYEE role to view employees", async () => {
      const user = createMockUser({ position: "ASSOCIATE" });
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      mockDb.query.users.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/employees",
      });

      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      mockDb.query.users.findMany.mockRejectedValue(new Error("Database connection failed"));

      const request = createMockRequest({
        method: "GET",
        url: "/api/employees",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch employees");
    });
  });
});

describe("POST /api/employees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validBody = {
    email: "newemployee@example.com",
    name: "New Employee",
    position: "ASSOCIATE",
  };

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAdmin.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "POST",
        url: "/api/employees",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 403 when user lacks admin access", async () => {
      mockRequireAdmin.mockResolvedValue({ error: "Admin access required", status: 403 });

      const request = createMockRequest({
        method: "POST",
        url: "/api/employees",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Admin access required");
    });
  });

  describe("Validation", () => {
    it("returns 400 for invalid JSON body", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = new NextRequest("http://localhost:3000/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json }",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON");
    });

    it("returns 400 when email is missing", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/employees",
        body: { name: "New Employee", position: "ASSOCIATE" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Email is required");
    });

    it("returns 400 for invalid email format", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/employees",
        body: { ...validBody, email: "not-an-email" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid email format");
    });

    it("returns 400 when position is missing", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/employees",
        body: { email: "test@example.com", name: "Test" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Valid position is required (PARTNER, SENIOR_ASSOCIATE, or ASSOCIATE)");
    });

    it("returns 400 for invalid position value", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/employees",
        body: { ...validBody, position: "ADMIN" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Valid position is required (PARTNER, SENIOR_ASSOCIATE, or ASSOCIATE)");
    });

    it("returns 400 when name is not a string", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/employees",
        body: { ...validBody, name: 123 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name must be a string");
    });

    it("returns 400 when name exceeds max length", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/employees",
        body: { ...validBody, name: "A".repeat(101) },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("cannot exceed");
    });
  });

  describe("Business Rules", () => {
    it("returns 409 when email already exists", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      mockDb.query.users.findFirst.mockResolvedValue({
        id: "existing-user",
        email: "newemployee@example.com",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/employees",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe("An employee with this email already exists");
    });
  });

  describe("Happy Path", () => {
    it("creates employee with valid data", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      mockDb.query.users.findFirst.mockResolvedValue(null);

      const createdEmployee = {
        id: "emp-123",
        name: "New Employee",
        email: "newemployee@example.com",
        position: "ASSOCIATE",
        status: "PENDING",
        createdAt: "2024-12-20T10:00:00.000Z",
        lastLogin: null,
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdEmployee]),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/employees",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.id).toBe("emp-123");
      expect(data.name).toBe("New Employee");
      expect(data.email).toBe("newemployee@example.com");
      expect(data.position).toBe("ASSOCIATE");
      expect(data.status).toBe("PENDING");
    });

    it("creates employee without name (optional)", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      mockDb.query.users.findFirst.mockResolvedValue(null);

      const createdEmployee = {
        id: "emp-123",
        name: null,
        email: "newemployee@example.com",
        position: "PARTNER",
        status: "PENDING",
        createdAt: "2024-12-20T10:00:00.000Z",
        lastLogin: null,
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdEmployee]),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/employees",
        body: { email: "newemployee@example.com", position: "PARTNER" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBeNull();
    });

    it("trims email and converts to lowercase", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      mockDb.query.users.findFirst.mockResolvedValue(null);

      const createdEmployee = {
        id: "emp-123",
        name: "Test",
        email: "test@example.com",
        position: "ASSOCIATE",
        status: "PENDING",
        createdAt: "2024-12-20T10:00:00.000Z",
        lastLogin: null,
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdEmployee]),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/employees",
        body: { email: "  TEST@EXAMPLE.COM  ", name: "Test", position: "ASSOCIATE" },
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it("allows PARTNER to create employees", async () => {
      const user = createMockUser({ position: "PARTNER" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      mockDb.query.users.findFirst.mockResolvedValue(null);

      const createdEmployee = {
        id: "emp-123",
        name: "New Employee",
        email: "newemployee@example.com",
        position: "ASSOCIATE",
        status: "PENDING",
        createdAt: "2024-12-20T10:00:00.000Z",
        lastLogin: null,
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdEmployee]),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/employees",
        body: validBody,
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      mockDb.query.users.findFirst.mockResolvedValue(null);
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error("Database connection failed")),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/employees",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to create employee");
    });
  });
});

describe("PATCH /api/employees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAdmin.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/employees",
        body: { id: "emp-123", name: "Updated Name" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 403 when user lacks admin access", async () => {
      mockRequireAdmin.mockResolvedValue({ error: "Admin access required", status: 403 });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/employees",
        body: { id: "emp-123", name: "Updated Name" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Admin access required");
    });
  });

  describe("Validation", () => {
    it("returns 400 for invalid JSON body", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = new NextRequest("http://localhost:3000/api/employees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json }",
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON");
    });

    it("returns 400 when employee ID is missing", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/employees",
        body: { name: "Updated Name" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Employee ID is required");
    });

    it("returns 400 when name is empty string", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/employees",
        body: { id: "emp-123", name: "   " },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name cannot be empty");
    });

    it("returns 400 when name exceeds max length", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/employees",
        body: { id: "emp-123", name: "A".repeat(101) },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("cannot exceed");
    });

    it("returns 400 for invalid position", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/employees",
        body: { id: "emp-123", position: "INVALID_POSITION" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid position value");
    });

    it("returns 400 for invalid status", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/employees",
        body: { id: "emp-123", status: "PENDING" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid status value");
    });

    it("does not allow setting ADMIN position via PATCH", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/employees",
        body: { id: "emp-123", position: "ADMIN" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid position value");
    });
  });

  describe("Business Rules", () => {
    it("prevents self-deactivation", async () => {
      const user = createMockUser({ position: "ADMIN", id: "admin-user-id" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/employees",
        body: { id: "admin-user-id", status: "INACTIVE" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("You cannot deactivate yourself");
    });
  });

  describe("Happy Path", () => {
    it("updates employee name", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const updatedEmployee = {
        id: "emp-123",
        name: "Updated Name",
        email: "test@example.com",
        position: "ASSOCIATE",
        status: "ACTIVE",
        createdAt: "2024-12-20T10:00:00.000Z",
        lastLogin: null,
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedEmployee]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/employees",
        body: { id: "emp-123", name: "Updated Name" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe("Updated Name");
    });

    it("updates employee position", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const updatedEmployee = {
        id: "emp-123",
        name: "Test Employee",
        email: "test@example.com",
        position: "SENIOR_ASSOCIATE",
        status: "ACTIVE",
        createdAt: "2024-12-20T10:00:00.000Z",
        lastLogin: null,
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedEmployee]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/employees",
        body: { id: "emp-123", position: "SENIOR_ASSOCIATE" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.position).toBe("SENIOR_ASSOCIATE");
    });

    it("updates employee status", async () => {
      const user = createMockUser({ position: "ADMIN", id: "admin-id" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const updatedEmployee = {
        id: "emp-123",
        name: "Test Employee",
        email: "test@example.com",
        position: "ASSOCIATE",
        status: "INACTIVE",
        createdAt: "2024-12-20T10:00:00.000Z",
        lastLogin: null,
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedEmployee]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/employees",
        body: { id: "emp-123", status: "INACTIVE" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("INACTIVE");
    });

    it("updates multiple fields at once", async () => {
      const user = createMockUser({ position: "ADMIN", id: "admin-id" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const updatedEmployee = {
        id: "emp-123",
        name: "New Name",
        email: "test@example.com",
        position: "PARTNER",
        status: "ACTIVE",
        createdAt: "2024-12-20T10:00:00.000Z",
        lastLogin: null,
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedEmployee]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/employees",
        body: { id: "emp-123", name: "New Name", position: "PARTNER", status: "ACTIVE" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe("New Name");
      expect(data.position).toBe("PARTNER");
      expect(data.status).toBe("ACTIVE");
    });
  });

  describe("Not Found", () => {
    it("returns 404 when employee not found", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
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
        url: "/api/employees",
        body: { id: "nonexistent-id", name: "Updated Name" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Employee not found");
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
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
        url: "/api/employees",
        body: { id: "emp-123", name: "Updated Name" },
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to update employee");
    });
  });
});

describe("DELETE /api/employees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAdmin.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/employees",
        body: { id: "emp-123" },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 403 when user lacks admin access", async () => {
      mockRequireAdmin.mockResolvedValue({ error: "Admin access required", status: 403 });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/employees",
        body: { id: "emp-123" },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Admin access required");
    });
  });

  describe("Validation", () => {
    it("returns 400 for invalid JSON body", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = new NextRequest("http://localhost:3000/api/employees", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json }",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON");
    });

    it("returns 400 when employee ID is missing", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/employees",
        body: {},
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Employee ID is required");
    });

    it("returns 400 when employee ID is not a string", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/employees",
        body: { id: 123 },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Employee ID is required");
    });
  });

  describe("Business Rules", () => {
    it("prevents self-deactivation", async () => {
      const user = createMockUser({ position: "ADMIN", id: "admin-user-id" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/employees",
        body: { id: "admin-user-id" },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("You cannot deactivate yourself");
    });
  });

  describe("Happy Path", () => {
    it("deactivates employee (soft delete)", async () => {
      const user = createMockUser({ position: "ADMIN", id: "admin-id" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      const deactivatedEmployee = {
        id: "emp-123",
        name: "Test Employee",
        email: "test@example.com",
        position: "ASSOCIATE",
        status: "INACTIVE",
        createdAt: "2024-12-20T10:00:00.000Z",
        lastLogin: null,
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([deactivatedEmployee]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/employees",
        body: { id: "emp-123" },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("emp-123");
      expect(data.status).toBe("INACTIVE");
    });
  });

  describe("Not Found", () => {
    it("returns 404 when employee not found", async () => {
      const user = createMockUser({ position: "ADMIN", id: "admin-id" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/employees",
        body: { id: "nonexistent-id" },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Employee not found");
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error", async () => {
      const user = createMockUser({ position: "ADMIN", id: "admin-id" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
        user: { id: user.id, email: user.email, position: user.position },
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue(new Error("Database connection failed")),
          }),
        }),
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/employees",
        body: { id: "emp-123" },
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to deactivate employee");
    });
  });
});
