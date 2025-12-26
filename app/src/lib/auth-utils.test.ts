import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser } from "@/test/mocks/factories";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockGetServerSession, mockGetToken, mockDb } = vi.hoisted(() => {
  return {
    mockGetServerSession: vi.fn(),
    mockGetToken: vi.fn(),
    mockDb: {
      query: {
        users: {
          findFirst: vi.fn(),
        },
      },
    },
  };
});

// Mock dependencies
vi.mock("next-auth", () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock("next-auth/jwt", () => ({
  getToken: mockGetToken,
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// Import after mocks are set up
import {
  hasAdminAccess,
  errorResponse,
  successResponse,
  requireAuth,
  requireAdmin,
} from "./auth-utils";

describe("auth-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("hasAdminAccess", () => {
    it("returns true for ADMIN position", () => {
      expect(hasAdminAccess("ADMIN")).toBe(true);
    });

    it("returns true for PARTNER position", () => {
      expect(hasAdminAccess("PARTNER")).toBe(true);
    });

    it("returns false for SENIOR_ASSOCIATE position", () => {
      expect(hasAdminAccess("SENIOR_ASSOCIATE")).toBe(false);
    });

    it("returns false for ASSOCIATE position", () => {
      expect(hasAdminAccess("ASSOCIATE")).toBe(false);
    });

    it("returns false for CONSULTANT position", () => {
      expect(hasAdminAccess("CONSULTANT")).toBe(false);
    });
  });

  describe("errorResponse", () => {
    it("returns NextResponse with error message and status", async () => {
      const response = errorResponse("Something went wrong", 400);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Something went wrong" });
    });

    it("handles 401 unauthorized", async () => {
      const response = errorResponse("Unauthorized", 401);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: "Unauthorized" });
    });

    it("handles 500 server error", async () => {
      const response = errorResponse("Internal server error", 500);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Internal server error" });
    });
  });

  describe("successResponse", () => {
    it("returns NextResponse with data", async () => {
      const response = successResponse({ id: "123", name: "Test" });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ id: "123", name: "Test" });
    });

    it("handles array data", async () => {
      const arrayData = [
        { id: "1", name: "First" },
        { id: "2", name: "Second" },
      ];
      const response = successResponse(arrayData);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(arrayData);
    });

    it("handles null data", async () => {
      const response = successResponse(null);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeNull();
    });
  });

  describe("requireAuth", () => {
    it("returns user when session has email and user exists", async () => {
      const mockUser = createMockUser({ position: "ASSOCIATE" });
      mockGetServerSession.mockResolvedValue({
        user: { name: mockUser.name, email: mockUser.email },
      });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        position: mockUser.position,
      });

      const request = createMockRequest({
        method: "GET",
        url: "/api/test",
      });

      const result = await requireAuth(request);

      expect("user" in result).toBe(true);
      if ("user" in result) {
        expect(result.user.id).toBe(mockUser.id);
        expect(result.user.email).toBe(mockUser.email);
        expect(result.user.position).toBe(mockUser.position);
        expect(result.session.user.name).toBe(mockUser.name);
        expect(result.session.user.email).toBe(mockUser.email);
      }
    });

    it("falls back to JWT token when session has no email", async () => {
      const mockUser = createMockUser({ position: "PARTNER" });
      // Session without email
      mockGetServerSession.mockResolvedValue({
        user: { name: mockUser.name },
      });
      // JWT token has email
      mockGetToken.mockResolvedValue({
        email: mockUser.email,
      });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        position: mockUser.position,
      });

      const request = createMockRequest({
        method: "GET",
        url: "/api/test",
      });

      const result = await requireAuth(request);

      expect("user" in result).toBe(true);
      if ("user" in result) {
        expect(result.user.id).toBe(mockUser.id);
        expect(result.user.email).toBe(mockUser.email);
        expect(result.user.position).toBe(mockUser.position);
      }
      expect(mockGetToken).toHaveBeenCalled();
    });

    it("returns 401 when no session and no token", async () => {
      mockGetServerSession.mockResolvedValue(null);
      mockGetToken.mockResolvedValue(null);

      const request = createMockRequest({
        method: "GET",
        url: "/api/test",
      });

      const result = await requireAuth(request);

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toBe("Unauthorized");
        expect(result.status).toBe(401);
      }
    });

    it("returns 403 when user not in database", async () => {
      const mockUser = createMockUser();
      mockGetServerSession.mockResolvedValue({
        user: { name: mockUser.name, email: mockUser.email },
      });
      mockDb.query.users.findFirst.mockResolvedValue(null);

      const request = createMockRequest({
        method: "GET",
        url: "/api/test",
      });

      const result = await requireAuth(request);

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toBe("User not found. Contact administrator.");
        expect(result.status).toBe(403);
      }
    });
  });

  describe("requireAdmin", () => {
    it("returns user when user is ADMIN", async () => {
      const mockUser = createMockUser({ position: "ADMIN" });
      mockGetServerSession.mockResolvedValue({
        user: { name: mockUser.name, email: mockUser.email },
      });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        position: mockUser.position,
      });

      const request = createMockRequest({
        method: "GET",
        url: "/api/test",
      });

      const result = await requireAdmin(request);

      expect("user" in result).toBe(true);
      if ("user" in result) {
        expect(result.user.id).toBe(mockUser.id);
        expect(result.user.position).toBe("ADMIN");
      }
    });

    it("returns user when user is PARTNER", async () => {
      const mockUser = createMockUser({ position: "PARTNER" });
      mockGetServerSession.mockResolvedValue({
        user: { name: mockUser.name, email: mockUser.email },
      });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        position: mockUser.position,
      });

      const request = createMockRequest({
        method: "GET",
        url: "/api/test",
      });

      const result = await requireAdmin(request);

      expect("user" in result).toBe(true);
      if ("user" in result) {
        expect(result.user.id).toBe(mockUser.id);
        expect(result.user.position).toBe("PARTNER");
      }
    });

    it("returns 403 when user is ASSOCIATE", async () => {
      const mockUser = createMockUser({ position: "ASSOCIATE" });
      mockGetServerSession.mockResolvedValue({
        user: { name: mockUser.name, email: mockUser.email },
      });
      mockDb.query.users.findFirst.mockResolvedValue({
        id: mockUser.id,
        email: mockUser.email,
        position: mockUser.position,
      });

      const request = createMockRequest({
        method: "GET",
        url: "/api/test",
      });

      const result = await requireAdmin(request);

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toBe("Admin access required");
        expect(result.status).toBe(403);
      }
    });

    it("returns 401 when not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null);
      mockGetToken.mockResolvedValue(null);

      const request = createMockRequest({
        method: "GET",
        url: "/api/test",
      });

      const result = await requireAdmin(request);

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toBe("Unauthorized");
        expect(result.status).toBe(401);
      }
    });
  });
});
