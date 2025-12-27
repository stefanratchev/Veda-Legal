import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockDb } = vi.hoisted(() => {
  return {
    mockDb: {
      query: {
        users: {
          findFirst: vi.fn(),
        },
      },
    },
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

import { getInitials, getAuthenticatedUser } from "./user";

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
});
