import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockUser } from "@/test/mocks/factories";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { db } from "./db";

// Mock the db module before importing api-utils
vi.mock("./db", () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
    },
  },
}));

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}));

vi.mock("./auth", () => ({
  authOptions: {},
}));

import {
  isValidEmail,
  isValidHours,
  isValidDescription,
  parseDate,
  isNotFutureDate,
  requireAuth,
  requiresTimesheetSubmission,
  MIN_DESCRIPTION_LENGTH,
  MAX_HOURS_PER_ENTRY,
} from "./api-utils";

// Get typed references to the mocks
const mockGetServerSession = vi.mocked(getServerSession);
const mockGetToken = vi.mocked(getToken);
const mockFindFirst = vi.mocked(db.query.users.findFirst);

describe("api-utils", () => {
  describe("isValidEmail", () => {
    it("accepts valid emails", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
      expect(isValidEmail("first.last@company.co.uk")).toBe(true);
    });

    it("rejects invalid emails", () => {
      expect(isValidEmail("notanemail")).toBe(false);
      expect(isValidEmail("missing@domain")).toBe(false);
      expect(isValidEmail("@nodomain.com")).toBe(false);
      expect(isValidEmail("spaces in@email.com")).toBe(false);
    });
  });

  describe("isValidHours", () => {
    it("accepts valid hour values", () => {
      expect(isValidHours(1)).toBe(true);
      expect(isValidHours(0.5)).toBe(true);
      expect(isValidHours(MAX_HOURS_PER_ENTRY)).toBe(true);
    });

    it("rejects zero hours", () => {
      expect(isValidHours(0)).toBe(false);
    });

    it("rejects negative hours", () => {
      expect(isValidHours(-1)).toBe(false);
    });

    it("rejects hours exceeding maximum", () => {
      expect(isValidHours(MAX_HOURS_PER_ENTRY + 1)).toBe(false);
    });

    it("rejects NaN", () => {
      expect(isValidHours(NaN)).toBe(false);
    });
  });

  describe("isValidDescription", () => {
    it("accepts descriptions meeting minimum length", () => {
      const validDesc = "a".repeat(MIN_DESCRIPTION_LENGTH);
      expect(isValidDescription(validDesc)).toBe(true);
    });

    it("rejects short descriptions", () => {
      const shortDesc = "a".repeat(MIN_DESCRIPTION_LENGTH - 1);
      expect(isValidDescription(shortDesc)).toBe(false);
    });

    it("trims whitespace when checking length", () => {
      const paddedDesc = "   " + "a".repeat(MIN_DESCRIPTION_LENGTH - 1) + "   ";
      expect(isValidDescription(paddedDesc)).toBe(false);
    });
  });

  describe("parseDate", () => {
    it("parses valid date strings", () => {
      const result = parseDate("2024-12-20");
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString().startsWith("2024-12-20")).toBe(true);
    });

    it("returns null for invalid dates", () => {
      expect(parseDate("not-a-date")).toBeNull();
      expect(parseDate("2024-13-45")).toBeNull();
    });
  });

  describe("isNotFutureDate", () => {
    it("returns true for past dates", () => {
      const past = new Date("2020-01-01");
      expect(isNotFutureDate(past)).toBe(true);
    });

    it("returns true for today", () => {
      const today = new Date();
      expect(isNotFutureDate(today)).toBe(true);
    });

    it("returns false for future dates", () => {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      expect(isNotFutureDate(future)).toBe(false);
    });
  });

  describe("requireAuth", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    function createMockRequest(cookies: Record<string, string> = {}): NextRequest {
      const url = "http://localhost:3000/api/test";
      const request = new NextRequest(url);
      // Add cookies to the request
      for (const [name, value] of Object.entries(cookies)) {
        request.cookies.set(name, value);
      }
      return request;
    }

    it("returns session for authenticated user", async () => {
      const mockSession = {
        user: { name: "Test User", email: "test@example.com" },
      };
      mockGetServerSession.mockResolvedValue(mockSession);

      const request = createMockRequest();
      const result = await requireAuth(request);

      expect(result).toEqual({
        session: { user: { name: "Test User", email: "test@example.com" } },
      });
    });

    it("returns 401 for unauthenticated request", async () => {
      mockGetServerSession.mockResolvedValue(null);
      mockGetToken.mockResolvedValue(null);

      const request = createMockRequest();
      const result = await requireAuth(request);

      expect(result).toEqual({ error: "Unauthorized", status: 401 });
    });

    it("returns impersonated user when admin has impersonation cookie", async () => {
      const adminUser = createMockUser({
        id: "admin-id",
        email: "admin@example.com",
        name: "Admin User",
        position: "ADMIN",
        status: "ACTIVE",
      });
      const targetUser = createMockUser({
        id: "target-id",
        email: "target@example.com",
        name: "Target User",
        position: "ASSOCIATE",
        status: "ACTIVE",
      });

      // Admin is authenticated
      mockGetServerSession.mockResolvedValue({
        user: { name: adminUser.name, email: adminUser.email },
      });

      // First call: lookup admin user by email to check position
      // Second call: lookup target user by id
      mockFindFirst
        .mockResolvedValueOnce({
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          position: adminUser.position,
          status: adminUser.status,
        })
        .mockResolvedValueOnce({
          id: targetUser.id,
          email: targetUser.email,
          name: targetUser.name,
          position: targetUser.position,
          status: targetUser.status,
        });

      const request = createMockRequest({ impersonate_user_id: targetUser.id });
      const result = await requireAuth(request);

      expect(result).toEqual({
        session: { user: { name: targetUser.name, email: targetUser.email } },
      });
    });

    it("ignores impersonation cookie for non-ADMIN users", async () => {
      const partnerUser = createMockUser({
        id: "partner-id",
        email: "partner@example.com",
        name: "Partner User",
        position: "PARTNER",
        status: "ACTIVE",
      });
      const targetUser = createMockUser({
        id: "target-id",
        email: "target@example.com",
        name: "Target User",
        position: "ASSOCIATE",
        status: "ACTIVE",
      });

      // Partner is authenticated
      mockGetServerSession.mockResolvedValue({
        user: { name: partnerUser.name, email: partnerUser.email },
      });

      // Lookup partner user by email - should find PARTNER position
      mockFindFirst.mockResolvedValueOnce({
        id: partnerUser.id,
        email: partnerUser.email,
        name: partnerUser.name,
        position: partnerUser.position,
        status: partnerUser.status,
      });

      const request = createMockRequest({ impersonate_user_id: targetUser.id });
      const result = await requireAuth(request);

      // Should return the real user (partner), not the target
      expect(result).toEqual({
        session: { user: { name: partnerUser.name, email: partnerUser.email } },
      });
      // Should NOT have made a second query for target user
      expect(mockFindFirst).toHaveBeenCalledTimes(1);
    });

    it("ignores impersonation cookie if impersonated user is INACTIVE", async () => {
      const adminUser = createMockUser({
        id: "admin-id",
        email: "admin@example.com",
        name: "Admin User",
        position: "ADMIN",
        status: "ACTIVE",
      });
      const inactiveUser = createMockUser({
        id: "inactive-id",
        email: "inactive@example.com",
        name: "Inactive User",
        position: "ASSOCIATE",
        status: "INACTIVE",
      });

      // Admin is authenticated
      mockGetServerSession.mockResolvedValue({
        user: { name: adminUser.name, email: adminUser.email },
      });

      // First call: lookup admin user by email
      // Second call: lookup inactive user by id
      mockFindFirst
        .mockResolvedValueOnce({
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          position: adminUser.position,
          status: adminUser.status,
        })
        .mockResolvedValueOnce({
          id: inactiveUser.id,
          email: inactiveUser.email,
          name: inactiveUser.name,
          position: inactiveUser.position,
          status: inactiveUser.status,
        });

      const request = createMockRequest({ impersonate_user_id: inactiveUser.id });
      const result = await requireAuth(request);

      // Should return the admin user, not the inactive user
      expect(result).toEqual({
        session: { user: { name: adminUser.name, email: adminUser.email } },
      });
    });

    it("ignores impersonation cookie if impersonated user not found", async () => {
      const adminUser = createMockUser({
        id: "admin-id",
        email: "admin@example.com",
        name: "Admin User",
        position: "ADMIN",
        status: "ACTIVE",
      });

      // Admin is authenticated
      mockGetServerSession.mockResolvedValue({
        user: { name: adminUser.name, email: adminUser.email },
      });

      // First call: lookup admin user by email
      // Second call: lookup non-existent user by id - returns undefined
      mockFindFirst
        .mockResolvedValueOnce({
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          position: adminUser.position,
          status: adminUser.status,
        })
        .mockResolvedValueOnce(undefined);

      const request = createMockRequest({ impersonate_user_id: "non-existent-id" });
      const result = await requireAuth(request);

      // Should return the admin user
      expect(result).toEqual({
        session: { user: { name: adminUser.name, email: adminUser.email } },
      });
    });
  });

  describe("requiresTimesheetSubmission", () => {
    it("returns true for PARTNER", () => {
      expect(requiresTimesheetSubmission("PARTNER")).toBe(true);
    });

    it("returns true for SENIOR_ASSOCIATE", () => {
      expect(requiresTimesheetSubmission("SENIOR_ASSOCIATE")).toBe(true);
    });

    it("returns true for ASSOCIATE", () => {
      expect(requiresTimesheetSubmission("ASSOCIATE")).toBe(true);
    });

    it("returns false for ADMIN", () => {
      expect(requiresTimesheetSubmission("ADMIN")).toBe(false);
    });

    it("returns false for CONSULTANT", () => {
      expect(requiresTimesheetSubmission("CONSULTANT")).toBe(false);
    });

    it("returns false for unknown position", () => {
      expect(requiresTimesheetSubmission("UNKNOWN")).toBe(false);
    });
  });
});
