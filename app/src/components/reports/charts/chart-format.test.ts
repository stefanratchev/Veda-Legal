import { describe, it, expect } from "vitest";
import { formatEur, formatEurPerHour } from "./chart-format";

describe("formatEur", () => {
  it("formats sub-1000 values as integer euros", () => {
    expect(formatEur(0)).toBe("€0");
    expect(formatEur(42.6)).toBe("€43"); // rounded
    expect(formatEur(999)).toBe("€999");
  });

  it("formats 1000 to 9999 with one decimal of K", () => {
    expect(formatEur(1000)).toBe("€1.0K");
    expect(formatEur(1500)).toBe("€1.5K");
    expect(formatEur(9999)).toBe("€10.0K"); // toFixed(1) on 9.999 rounds to "10.0"
  });

  it("formats 10000+ with no decimals of K", () => {
    expect(formatEur(10000)).toBe("€10K");
    expect(formatEur(125000)).toBe("€125K");
  });
});

describe("formatEurPerHour", () => {
  it("rounds to integer and appends /hr", () => {
    expect(formatEurPerHour(0)).toBe("€0/hr");
    expect(formatEurPerHour(125)).toBe("€125/hr");
    expect(formatEurPerHour(125.4)).toBe("€125/hr");
    expect(formatEurPerHour(125.6)).toBe("€126/hr");
  });
});
