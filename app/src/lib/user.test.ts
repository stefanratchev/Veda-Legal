import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockDb, mockCookies, mockGetServerSession, mockRedirect } = vi.hoisted(() => {
  return {
    mockDb: {
      query: {
        users: {
          findFirst: vi.fn(),
        },
      },
    },
    mockCookies: {
      get: vi.fn(),
    },
    mockGetServerSession: vi.fn(),
    mockRedirect: vi.fn((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    }),
  };
});

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/schema", () => ({
  users: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((field, value) => ({ field, value })),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookies)),
}));

vi.mock("next-auth", () => ({
  getServerSession: () => mockGetServerSession(),
}));

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

import { getInitials, getAuthenticatedUser, getCurrentUser } from "./user";

describe("user utilities", () => {
  describe("getInitials", () => {
    it("returns initials from full name", () => {
      expect(getInitials("John Doe")).toBe("JD");
    });

    it("returns single initial for single name", () => {
      expect(getInitials("John")).toBe("J");
    });

    it("limits to two characters for long names", () => {
      expect(getInitials("John Michael Doe")).toBe("JM");
    });

    it("returns U for null input", () => {
      expect(getInitials(null)).toBe("U");
    });

    it("returns U for undefined input", () => {
      expect(getInitials(undefined)).toBe("U");
    });

    it("returns U for empty string", () => {
      expect(getInitials("")).toBe("U");
    });

    it("returns U for whitespace only", () => {
      expect(getInitials("   ")).toBe("U");
    });

    it("handles names with extra whitespace", () => {
      expect(getInitials("  John   Doe  ")).toBe("JD");
    });

    it("converts to uppercase", () => {
      expect(getInitials("john doe")).toBe("JD");
    });
  });

  describe("getAuthenticatedUser", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns user with formatted data when found", async () => {
      const mockUser = {
        id: "user-123",
        name: "John Doe",
        position: "ASSOCIATE" as const,
        image: "https://example.com/avatar.jpg",
      };

      mockDb.query.users.findFirst.mockResolvedValue(mockUser);

      const result = await getAuthenticatedUser("john@example.com");

      expect(result).toEqual({
        id: "user-123",
        name: "John Doe",
        position: "ASSOCIATE",
        initials: "JD",
        image: "https://example.com/avatar.jpg",
      });
    });

    it("returns null when user not found", async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);

      const result = await getAuthenticatedUser("unknown@example.com");

      expect(result).toBeNull();
    });

    it("uses 'User' as default name when name is null", async () => {
      const mockUser = {
        id: "user-456",
        name: null,
        position: "ADMIN" as const,
        image: null,
      };

      mockDb.query.users.findFirst.mockResolvedValue(mockUser);

      const result = await getAuthenticatedUser("admin@example.com");

      expect(result).toEqual({
        id: "user-456",
        name: "User",
        position: "ADMIN",
        initials: "U", // getInitials(null) returns "U"
        image: null,
      });
    });

    it("generates correct initials from user name", async () => {
      const mockUser = {
        id: "user-789",
        name: "Alice Marie Johnson",
        position: "PARTNER" as const,
        image: null,
      };

      mockDb.query.users.findFirst.mockResolvedValue(mockUser);

      const result = await getAuthenticatedUser("alice@example.com");

      expect(result?.initials).toBe("AM"); // Limited to 2 characters
    });

    it("handles user with single name correctly", async () => {
      const mockUser = {
        id: "user-101",
        name: "Madonna",
        position: "CONSULTANT" as const,
        image: null,
      };

      mockDb.query.users.findFirst.mockResolvedValue(mockUser);

      const result = await getAuthenticatedUser("madonna@example.com");

      expect(result?.initials).toBe("M");
    });
  });

  describe("getCurrentUser", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockCookies.get.mockReturnValue(undefined);
    });

    it("redirects to login when no session", async () => {
      mockGetServerSession.mockResolvedValue(null);

      await expect(getCurrentUser()).rejects.toThrow("REDIRECT:/login");
    });

    it("redirects to login when session has no email", async () => {
      mockGetServerSession.mockResolvedValue({ user: {} });

      await expect(getCurrentUser()).rejects.toThrow("REDIRECT:/login");
    });

    it("redirects to login when user not found in database", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { email: "unknown@example.com" },
      });
      mockDb.query.users.findFirst.mockResolvedValue(null);

      await expect(getCurrentUser()).rejects.toThrow("REDIRECT:/login");
    });

    it("returns real user when no impersonation cookie", async () => {
      const realUser = {
        id: "user-1",
        name: "Real User",
        email: "real@example.com",
        position: "PARTNER" as const,
        status: "ACTIVE",
        image: null,
      };

      mockGetServerSession.mockResolvedValue({
        user: { email: "real@example.com" },
      });
      mockCookies.get.mockReturnValue(undefined);
      mockDb.query.users.findFirst.mockResolvedValue(realUser);

      const result = await getCurrentUser();

      expect(result.id).toBe("user-1");
      expect(result.position).toBe("PARTNER");
    });

    it("returns impersonated user when cookie set and real user is ADMIN", async () => {
      const realAdmin = {
        id: "admin-1",
        name: "Admin User",
        email: "admin@example.com",
        position: "ADMIN" as const,
        status: "ACTIVE",
        image: null,
      };
      const impersonatedUser = {
        id: "user-2",
        name: "Regular User",
        email: "user@example.com",
        position: "ASSOCIATE" as const,
        status: "ACTIVE",
        image: null,
      };

      mockGetServerSession.mockResolvedValue({
        user: { email: "admin@example.com" },
      });
      mockCookies.get.mockReturnValue({ value: "user-2" });

      // First call returns admin, second returns impersonated user
      mockDb.query.users.findFirst
        .mockResolvedValueOnce(realAdmin)
        .mockResolvedValueOnce(impersonatedUser);

      const result = await getCurrentUser();

      expect(result.id).toBe("user-2");
      expect(result.position).toBe("ASSOCIATE");
    });

    it("returns real user when cookie exists but real user is not ADMIN", async () => {
      const realUser = {
        id: "user-1",
        name: "Partner User",
        email: "partner@example.com",
        position: "PARTNER" as const,
        status: "ACTIVE",
        image: null,
      };

      mockGetServerSession.mockResolvedValue({
        user: { email: "partner@example.com" },
      });
      mockCookies.get.mockReturnValue({ value: "user-2" });
      mockDb.query.users.findFirst.mockResolvedValue(realUser);

      const result = await getCurrentUser();

      // Should return real user, not attempt impersonation
      expect(result.id).toBe("user-1");
      expect(result.position).toBe("PARTNER");
    });

    it("returns real user when impersonated user not found", async () => {
      const realAdmin = {
        id: "admin-1",
        name: "Admin User",
        email: "admin@example.com",
        position: "ADMIN" as const,
        status: "ACTIVE",
        image: null,
      };

      mockGetServerSession.mockResolvedValue({
        user: { email: "admin@example.com" },
      });
      mockCookies.get.mockReturnValue({ value: "nonexistent-user" });

      // First call returns admin, second returns null (user not found)
      mockDb.query.users.findFirst
        .mockResolvedValueOnce(realAdmin)
        .mockResolvedValueOnce(null);

      const result = await getCurrentUser();

      // Should fall back to real user
      expect(result.id).toBe("admin-1");
      expect(result.position).toBe("ADMIN");
    });

    it("returns real user when impersonated user is INACTIVE", async () => {
      const realAdmin = {
        id: "admin-1",
        name: "Admin User",
        email: "admin@example.com",
        position: "ADMIN" as const,
        status: "ACTIVE",
        image: null,
      };
      const inactiveUser = {
        id: "user-2",
        name: "Inactive User",
        email: "inactive@example.com",
        position: "ASSOCIATE" as const,
        status: "INACTIVE",
        image: null,
      };

      mockGetServerSession.mockResolvedValue({
        user: { email: "admin@example.com" },
      });
      mockCookies.get.mockReturnValue({ value: "user-2" });

      mockDb.query.users.findFirst
        .mockResolvedValueOnce(realAdmin)
        .mockResolvedValueOnce(inactiveUser);

      const result = await getCurrentUser();

      // Should fall back to real user since impersonated user is INACTIVE
      expect(result.id).toBe("admin-1");
      expect(result.position).toBe("ADMIN");
    });
  });
});
