import { describe, it, expect } from "vitest";
import type { ReportEntry } from "@/types/reports";
import {
  filterEntries,
  aggregateByClient,
  aggregateByEmployee,
  aggregateByTopic,
} from "./report-detail-utils";

// Helper to create ReportEntry test data
function createEntry(overrides: Partial<ReportEntry> = {}): ReportEntry {
  return {
    id: "entry-1",
    date: "2024-01-15",
    hours: 2.5,
    description: "Test work",
    userId: "user-1",
    userName: "Test User",
    clientId: "client-1",
    clientName: "Test Client",
    topicName: "General Advisory",
    subtopicName: "Client correspondence:",
    isWrittenOff: false,
    clientType: "REGULAR",
    revenue: 375, // 2.5 * 150
    ...overrides,
  };
}

describe("filterEntries", () => {
  const entries = [
    createEntry({ id: "e1", clientId: "c1", userId: "u1", topicName: "Topic A" }),
    createEntry({ id: "e2", clientId: "c2", userId: "u1", topicName: "Topic B" }),
    createEntry({ id: "e3", clientId: "c1", userId: "u2", topicName: "Topic A" }),
    createEntry({ id: "e4", clientId: "c3", userId: "u3", topicName: "Topic C" }),
  ];

  it("returns all entries when all filter Sets are empty", () => {
    const result = filterEntries(entries, new Set(), new Set(), new Set());
    expect(result).toHaveLength(4);
  });

  it("filters by single client", () => {
    const result = filterEntries(entries, new Set(["c1"]), new Set(), new Set());
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(["e1", "e3"]);
  });

  it("filters by multiple clients (OR within)", () => {
    const result = filterEntries(entries, new Set(["c1", "c2"]), new Set(), new Set());
    expect(result).toHaveLength(3);
    expect(result.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
  });

  it("filters by single employee", () => {
    const result = filterEntries(entries, new Set(), new Set(["u1"]), new Set());
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(["e1", "e2"]);
  });

  it("filters by topic", () => {
    const result = filterEntries(entries, new Set(), new Set(), new Set(["Topic A"]));
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.id)).toEqual(["e1", "e3"]);
  });

  it("applies AND across dimensions (client + employee)", () => {
    const result = filterEntries(entries, new Set(["c1"]), new Set(["u1"]), new Set());
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("e1");
  });

  it("applies AND across all three dimensions", () => {
    const result = filterEntries(
      entries,
      new Set(["c1"]),
      new Set(["u2"]),
      new Set(["Topic A"])
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("e3");
  });

  it("returns empty array when no entries match", () => {
    const result = filterEntries(entries, new Set(["nonexistent"]), new Set(), new Set());
    expect(result).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    const result = filterEntries([], new Set(), new Set(), new Set());
    expect(result).toHaveLength(0);
  });
});

describe("aggregateByClient", () => {
  it("aggregates single client", () => {
    const entries = [
      createEntry({ clientId: "c1", clientName: "Client A", hours: 2.5, revenue: 375 }),
      createEntry({ id: "e2", clientId: "c1", clientName: "Client A", hours: 1.5, revenue: 225 }),
    ];
    const result = aggregateByClient(entries);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "c1",
      name: "Client A",
      totalHours: 4,
      revenue: 600,
    });
  });

  it("sorts multiple clients by totalHours descending", () => {
    const entries = [
      createEntry({ clientId: "c1", clientName: "Small Client", hours: 1.0, revenue: 150 }),
      createEntry({ id: "e2", clientId: "c2", clientName: "Big Client", hours: 5.0, revenue: 750 }),
    ];
    const result = aggregateByClient(entries);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Big Client");
    expect(result[1].name).toBe("Small Client");
  });

  it("includes written-off entries in totalHours but excludes from revenue", () => {
    const entries = [
      createEntry({ clientId: "c1", clientName: "Client A", hours: 2.5, revenue: 375 }),
      createEntry({
        id: "e2",
        clientId: "c1",
        clientName: "Client A",
        hours: 1.0,
        isWrittenOff: true,
        revenue: null,
      }),
    ];
    const result = aggregateByClient(entries);
    expect(result[0].totalHours).toBe(3.5);
    expect(result[0].revenue).toBe(375);
  });

  it("returns null revenue when all entries have null revenue", () => {
    const entries = [
      createEntry({ clientId: "c1", clientName: "Client A", hours: 2.5, revenue: null }),
      createEntry({ id: "e2", clientId: "c1", clientName: "Client A", hours: 1.5, revenue: null }),
    ];
    const result = aggregateByClient(entries);
    expect(result[0].revenue).toBeNull();
  });

  it("sums only non-null revenues when mix of null and non-null", () => {
    const entries = [
      createEntry({ clientId: "c1", clientName: "Client A", hours: 2.5, revenue: 375 }),
      createEntry({ id: "e2", clientId: "c1", clientName: "Client A", hours: 1.0, revenue: null }),
    ];
    const result = aggregateByClient(entries);
    expect(result[0].revenue).toBe(375);
  });

  it("returns empty array for empty input", () => {
    const result = aggregateByClient([]);
    expect(result).toHaveLength(0);
  });
});

describe("aggregateByEmployee", () => {
  it("aggregates single employee", () => {
    const entries = [
      createEntry({ userId: "u1", userName: "Alice", hours: 2.5, revenue: 375 }),
      createEntry({ id: "e2", userId: "u1", userName: "Alice", hours: 1.5, revenue: 225 }),
    ];
    const result = aggregateByEmployee(entries);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "u1",
      name: "Alice",
      totalHours: 4,
      revenue: 600,
    });
  });

  it("sorts multiple employees by totalHours descending", () => {
    const entries = [
      createEntry({ userId: "u1", userName: "Low Hours", hours: 1.0, revenue: 150 }),
      createEntry({ id: "e2", userId: "u2", userName: "High Hours", hours: 5.0, revenue: 750 }),
    ];
    const result = aggregateByEmployee(entries);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("High Hours");
    expect(result[1].name).toBe("Low Hours");
  });

  it("includes written-off entries in totalHours but excludes from revenue", () => {
    const entries = [
      createEntry({ userId: "u1", userName: "Alice", hours: 2.5, revenue: 375 }),
      createEntry({
        id: "e2",
        userId: "u1",
        userName: "Alice",
        hours: 1.0,
        isWrittenOff: true,
        revenue: null,
      }),
    ];
    const result = aggregateByEmployee(entries);
    expect(result[0].totalHours).toBe(3.5);
    expect(result[0].revenue).toBe(375);
  });

  it("returns null revenue when all entries have null revenue", () => {
    const entries = [
      createEntry({ userId: "u1", userName: "Alice", hours: 2.5, revenue: null }),
    ];
    const result = aggregateByEmployee(entries);
    expect(result[0].revenue).toBeNull();
  });

  it("returns empty array for empty input", () => {
    const result = aggregateByEmployee([]);
    expect(result).toHaveLength(0);
  });
});

describe("aggregateByTopic", () => {
  it("aggregates single topic", () => {
    const entries = [
      createEntry({ topicName: "Advisory", hours: 2.5, revenue: 375 }),
      createEntry({ id: "e2", topicName: "Advisory", hours: 1.5, revenue: 225 }),
    ];
    const result = aggregateByTopic(entries);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "Advisory",
      name: "Advisory",
      totalHours: 4,
      revenue: 600,
    });
  });

  it("uses topicName as both id and name", () => {
    const entries = [createEntry({ topicName: "M&A Advisory" })];
    const result = aggregateByTopic(entries);
    expect(result[0].id).toBe("M&A Advisory");
    expect(result[0].name).toBe("M&A Advisory");
  });

  it("sorts multiple topics by totalHours descending", () => {
    const entries = [
      createEntry({ topicName: "Small Topic", hours: 1.0, revenue: 150 }),
      createEntry({ id: "e2", topicName: "Big Topic", hours: 5.0, revenue: 750 }),
    ];
    const result = aggregateByTopic(entries);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Big Topic");
    expect(result[1].name).toBe("Small Topic");
  });

  it("includes written-off entries in totalHours but excludes from revenue", () => {
    const entries = [
      createEntry({ topicName: "Advisory", hours: 2.5, revenue: 375 }),
      createEntry({
        id: "e2",
        topicName: "Advisory",
        hours: 1.0,
        isWrittenOff: true,
        revenue: null,
      }),
    ];
    const result = aggregateByTopic(entries);
    expect(result[0].totalHours).toBe(3.5);
    expect(result[0].revenue).toBe(375);
  });

  it("returns null revenue when all entries have null revenue", () => {
    const entries = [
      createEntry({ topicName: "Internal", hours: 2.5, revenue: null }),
      createEntry({ id: "e2", topicName: "Internal", hours: 1.5, revenue: null }),
    ];
    const result = aggregateByTopic(entries);
    expect(result[0].revenue).toBeNull();
  });

  it("returns empty array for empty input", () => {
    const result = aggregateByTopic([]);
    expect(result).toHaveLength(0);
  });
});
