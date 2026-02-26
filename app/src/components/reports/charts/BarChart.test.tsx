import { describe, it, expect } from "vitest";
import { getBarOpacity } from "./BarChart";

describe("getBarOpacity", () => {
  it("returns 0.8 when activeIds is undefined", () => {
    expect(getBarOpacity(undefined, "id-1")).toBe(0.8);
  });

  it("returns 0.8 when activeIds is empty Set", () => {
    expect(getBarOpacity(new Set(), "id-1")).toBe(0.8);
  });

  it("returns 0.8 for matching id when activeIds has entries", () => {
    expect(getBarOpacity(new Set(["id-1", "id-2"]), "id-1")).toBe(0.8);
  });

  it("returns 0.25 for non-matching id when activeIds has entries", () => {
    expect(getBarOpacity(new Set(["id-1"]), "id-2")).toBe(0.25);
  });

  it("returns 0.25 for undefined id when activeIds has entries", () => {
    expect(getBarOpacity(new Set(["id-1"]), undefined)).toBe(0.25);
  });

  it("returns 0.8 for undefined id when activeIds is empty", () => {
    expect(getBarOpacity(new Set(), undefined)).toBe(0.8);
  });
});
