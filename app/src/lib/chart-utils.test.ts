import { describe, it, expect } from "vitest";
import { getChartHeight } from "./chart-utils";

describe("getChartHeight", () => {
  it("returns 120px minimum for 0 items", () => {
    expect(getChartHeight(0)).toBe(120);
  });

  it("returns 120px minimum for 1 item", () => {
    expect(getChartHeight(1)).toBe(120);
  });

  it("returns 120px minimum for 5 items (5*22=110 < 120)", () => {
    expect(getChartHeight(5)).toBe(120);
  });

  it("scales linearly at 22px per bar for 10 items", () => {
    // 10 * 22 = 220
    expect(getChartHeight(10)).toBe(220);
  });

  it("scales linearly at 22px per bar for 15 items", () => {
    // 15 * 22 = 330
    expect(getChartHeight(15)).toBe(330);
  });

  it("accounts for 'Other' grouping bar when dataLength exceeds maxBars", () => {
    // 25 items, maxBars=20: effectiveBars = 20 + 1 = 21, height = 21 * 22 = 462
    expect(getChartHeight(25)).toBe(462);
  });

  it("respects custom maxBars parameter", () => {
    // 18 items, maxBars=15: effectiveBars = 15 + 1 = 16, height = 16 * 22 = 352
    expect(getChartHeight(18, 15)).toBe(352);
  });

  it("does NOT add 'Other' bar when dataLength exactly equals maxBars", () => {
    // 20 items, maxBars=20: effectiveBars = 20 + 0 = 20, height = 20 * 22 = 440
    expect(getChartHeight(20)).toBe(440);
  });

  it("does NOT add 'Other' bar when dataLength is less than maxBars", () => {
    // 15 items, maxBars=20: effectiveBars = 15, height = 15 * 22 = 330
    expect(getChartHeight(15, 20)).toBe(330);
  });
});
