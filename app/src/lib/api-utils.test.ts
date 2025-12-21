import { describe, it, expect, vi } from "vitest";

// Mock the db module before importing api-utils
vi.mock("./db", () => ({
  db: {},
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
  MIN_DESCRIPTION_LENGTH,
  MAX_HOURS_PER_ENTRY,
} from "./api-utils";

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
});
