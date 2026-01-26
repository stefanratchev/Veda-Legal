import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser } from "@/test/mocks/factories";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireAuth, mockDb } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockDb: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
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
  };
});

// Import route after mocks are set up
import { GET, POST, DELETE } from "./route";

describe("POST /api/admin/impersonate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "POST",
        url: "/api/admin/impersonate",
        body: { userId: "user-123" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("Authorization", () => {
    it("returns 403 when caller is not ADMIN position", async () => {
      const user = createMockUser({ position: "PARTNER" });
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: user.id,
        email: user.email,
        name: user.name,
        position: user.position,
        status: "ACTIVE",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/admin/impersonate",
        body: { userId: "target-user-123" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Only ADMIN can impersonate users");
    });

    it("returns 403 when caller is ASSOCIATE", async () => {
      const user = createMockUser({ position: "ASSOCIATE" });
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: user.id,
        email: user.email,
        name: user.name,
        position: user.position,
        status: "ACTIVE",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/admin/impersonate",
        body: { userId: "target-user-123" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Only ADMIN can impersonate users");
    });
  });

  describe("Validation", () => {
    it("returns 400 for invalid JSON body", async () => {
      const adminUser = createMockUser({ position: "ADMIN" });
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: adminUser.name, email: adminUser.email } },
      });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        position: adminUser.position,
        status: "ACTIVE",
      });

      const request = new NextRequest("http://localhost:3000/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json }",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON");
    });

    it("returns 400 when userId is missing", async () => {
      const adminUser = createMockUser({ position: "ADMIN" });
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: adminUser.name, email: adminUser.email } },
      });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        position: adminUser.position,
        status: "ACTIVE",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/admin/impersonate",
        body: {},
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("userId is required");
    });

    it("returns 400 when userId is not a string", async () => {
      const adminUser = createMockUser({ position: "ADMIN" });
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: adminUser.name, email: adminUser.email } },
      });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        position: adminUser.position,
        status: "ACTIVE",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/admin/impersonate",
        body: { userId: 123 },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("userId is required");
    });
  });

  describe("Business Rules", () => {
    it("returns 400 when trying to impersonate self", async () => {
      const adminUser = createMockUser({ position: "ADMIN", id: "admin-123" });
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: adminUser.name, email: adminUser.email } },
      });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        position: adminUser.position,
        status: "ACTIVE",
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/admin/impersonate",
        body: { userId: "admin-123" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot impersonate yourself");
    });

    it("returns 404 when target user does not exist", async () => {
      const adminUser = createMockUser({ position: "ADMIN", id: "admin-123" });
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: adminUser.name, email: adminUser.email } },
      });
      // First call returns admin user, second call returns null (target not found)
      mockDb.query.users.findFirst
        .mockResolvedValueOnce({
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          position: adminUser.position,
          status: "ACTIVE",
        })
        .mockResolvedValueOnce(null);

      const request = createMockRequest({
        method: "POST",
        url: "/api/admin/impersonate",
        body: { userId: "nonexistent-user" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("User not found");
    });

    it("returns 400 when target user is not ACTIVE", async () => {
      const adminUser = createMockUser({ position: "ADMIN", id: "admin-123" });
      const targetUser = createMockUser({ id: "target-123", status: "INACTIVE" });
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: adminUser.name, email: adminUser.email } },
      });
      mockDb.query.users.findFirst
        .mockResolvedValueOnce({
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          position: adminUser.position,
          status: "ACTIVE",
        })
        .mockResolvedValueOnce({
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          position: targetUser.position,
          status: "INACTIVE",
        });

      const request = createMockRequest({
        method: "POST",
        url: "/api/admin/impersonate",
        body: { userId: "target-123" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot impersonate inactive user");
    });

    it("returns 400 when target user is PENDING", async () => {
      const adminUser = createMockUser({ position: "ADMIN", id: "admin-123" });
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: adminUser.name, email: adminUser.email } },
      });
      mockDb.query.users.findFirst
        .mockResolvedValueOnce({
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          position: adminUser.position,
          status: "ACTIVE",
        })
        .mockResolvedValueOnce({
          id: "target-123",
          email: "target@example.com",
          name: "Target User",
          position: "ASSOCIATE",
          status: "PENDING",
        });

      const request = createMockRequest({
        method: "POST",
        url: "/api/admin/impersonate",
        body: { userId: "target-123" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot impersonate inactive user");
    });
  });

  describe("Happy Path", () => {
    it("successfully starts impersonation and sets cookie", async () => {
      const adminUser = createMockUser({ position: "ADMIN", id: "admin-123" });
      const targetUser = createMockUser({ id: "target-123", name: "Target User", position: "ASSOCIATE" });
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: adminUser.name, email: adminUser.email } },
      });
      mockDb.query.users.findFirst
        .mockResolvedValueOnce({
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          position: adminUser.position,
          status: "ACTIVE",
        })
        .mockResolvedValueOnce({
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          position: targetUser.position,
          status: "ACTIVE",
        });

      const request = createMockRequest({
        method: "POST",
        url: "/api/admin/impersonate",
        body: { userId: "target-123" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.user).toEqual({
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        position: targetUser.position,
      });

      // Check that the cookie is set correctly
      const setCookie = response.headers.get("Set-Cookie");
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain("impersonate_user_id=target-123");
      expect(setCookie).toContain("HttpOnly");
      // SameSite can be "Strict" or "strict" depending on the environment
      expect(setCookie?.toLowerCase()).toContain("samesite=strict");
      expect(setCookie).toContain("Path=/");
      // Session cookie should NOT have Max-Age
      expect(setCookie).not.toContain("Max-Age");
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error", async () => {
      const adminUser = createMockUser({ position: "ADMIN", id: "admin-123" });
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: adminUser.name, email: adminUser.email } },
      });
      mockDb.query.users.findFirst.mockRejectedValue(new Error("Database connection failed"));

      const request = createMockRequest({
        method: "POST",
        url: "/api/admin/impersonate",
        body: { userId: "target-123" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to start impersonation");
    });
  });
});

describe("DELETE /api/admin/impersonate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/admin/impersonate",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("Happy Path", () => {
    it("successfully stops impersonation and clears cookie", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/admin/impersonate",
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Check that the cookie is cleared (Max-Age=0)
      const setCookie = response.headers.get("Set-Cookie");
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain("impersonate_user_id=");
      expect(setCookie).toContain("Max-Age=0");
    });
  });
});

describe("GET /api/admin/impersonate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "GET",
        url: "/api/admin/impersonate",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("Happy Path", () => {
    it("returns impersonating: false when no cookie is set", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "GET",
        url: "/api/admin/impersonate",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.impersonating).toBe(false);
      expect(data.user).toBeUndefined();
    });

    it("returns impersonating: true with user data when cookie is set", async () => {
      const user = createMockUser();
      const impersonatedUser = createMockUser({
        id: "impersonated-123",
        name: "Impersonated User",
        position: "ASSOCIATE",
      });
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: impersonatedUser.id,
        name: impersonatedUser.name,
        position: impersonatedUser.position,
        image: "https://example.com/avatar.jpg",
      });

      // Create request with cookie
      const request = new NextRequest("http://localhost:3000/api/admin/impersonate", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Cookie: "impersonate_user_id=impersonated-123",
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.impersonating).toBe(true);
      expect(data.user).toEqual({
        id: impersonatedUser.id,
        name: impersonatedUser.name,
        position: impersonatedUser.position,
        image: "https://example.com/avatar.jpg",
      });
    });

    it("returns impersonating: false when cookie user not found", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });
      mockDb.query.users.findFirst.mockResolvedValue(null);

      const request = new NextRequest("http://localhost:3000/api/admin/impersonate", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Cookie: "impersonate_user_id=nonexistent-user",
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.impersonating).toBe(false);
      expect(data.user).toBeUndefined();
    });

    it("handles null image field gracefully", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: "impersonated-123",
        name: "Impersonated User",
        position: "ASSOCIATE",
        image: null,
      });

      const request = new NextRequest("http://localhost:3000/api/admin/impersonate", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Cookie: "impersonate_user_id=impersonated-123",
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.impersonating).toBe(true);
      expect(data.user.image).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error when fetching impersonated user", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });
      mockDb.query.users.findFirst.mockRejectedValue(new Error("Database connection failed"));

      const request = new NextRequest("http://localhost:3000/api/admin/impersonate", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Cookie: "impersonate_user_id=some-user",
        },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to get impersonation state");
    });
  });
});
