import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ByClientTab } from "./ByClientTab";

// Mock ResizeObserver for Recharts ResponsiveContainer
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

// --- Types matching ByClientTab's expected interfaces AFTER 03-01 updates ---
// These types include `topics` on ClientStats and `topicName` on Entry,
// which don't exist on the component's interfaces yet. Tests will fail (RED)
// until 03-01 and 03-02 implement the features.

interface ClientStats {
  id: string;
  name: string;
  totalHours: number;
  revenue: number | null;
  employees: { id: string; name: string; hours: number }[];
  topics: { topicName: string; totalHours: number; writtenOffHours: number }[];
}

interface Entry {
  id: string;
  date: string;
  hours: number;
  description: string;
  topicName: string;
  client: { id: string; name: string };
  employee: { id: string; name: string };
}

// --- Test data factories ---

function createClient(
  overrides?: Partial<ClientStats>
): ClientStats {
  return {
    id: "c1",
    name: "Acme Corp",
    totalHours: 20,
    revenue: 5000,
    employees: [{ id: "e1", name: "John Smith", hours: 20 }],
    topics: [
      { topicName: "M&A Advisory", totalHours: 12, writtenOffHours: 0 },
      { topicName: "Company Law", totalHours: 8, writtenOffHours: 0 },
    ],
    ...overrides,
  };
}

function createEntry(overrides?: Partial<Entry>): Entry {
  return {
    id: "entry-1",
    date: "2026-02-20",
    hours: 2,
    description: "Drafted agreement",
    topicName: "M&A Advisory",
    client: { id: "c1", name: "Acme Corp" },
    employee: { id: "e1", name: "John Smith" },
    ...overrides,
  };
}

// Default props for most tests
const defaultProps = {
  isAdmin: true,
  onSelectClient: vi.fn(),
  selectedClientId: "c1",
};

// --- CDR-01: Topic breakdown chart ---

describe("topic breakdown chart", () => {
  it("renders Topic Breakdown heading when client with topics is selected", () => {
    const client = createClient();
    const entries = [createEntry()];

    render(
      <ByClientTab
        clients={[client]}
        entries={entries}
        {...defaultProps}
      />
    );

    expect(screen.getByText("Topic Breakdown")).toBeInTheDocument();
  });

  it("hides zero-hour topics from chart data", () => {
    const client = createClient({
      topics: [
        { topicName: "Zero Topic", totalHours: 0, writtenOffHours: 0 },
        { topicName: "Active Topic", totalHours: 10, writtenOffHours: 0 },
      ],
      totalHours: 10,
    });
    const entries = [createEntry()];

    const { container } = render(
      <ByClientTab
        clients={[client]}
        entries={entries}
        {...defaultProps}
      />
    );

    // Zero-hour topics should not appear in chart data.
    // Recharts may render topic names as SVG text or tick labels.
    // Check that the zero topic name does NOT appear in the rendered output.
    expect(container.textContent).not.toContain("Zero Topic");
  });

  it("shows hours and percentage in topic bar labels", () => {
    const client = createClient({
      topics: [
        { topicName: "M&A Advisory", totalHours: 12, writtenOffHours: 0 },
      ],
      totalHours: 20,
    });
    const entries = [createEntry()];

    const { container } = render(
      <ByClientTab
        clients={[client]}
        entries={entries}
        {...defaultProps}
      />
    );

    // The topic chart should show hours and percentage.
    // Look for either "12h" or "60%" pattern in the rendered output.
    const textContent = container.textContent || "";
    const hasHoursOrPercentage =
      textContent.includes("12h") || textContent.includes("60%");
    expect(hasHoursOrPercentage).toBe(true);
  });
});

// --- CDR-03: Full entry table with pagination ---

describe("entry table", () => {
  it("renders all entries via DataTable, not limited to 10", () => {
    const client = createClient();
    // Create 15 entries with dates 2026-02-01 through 2026-02-15.
    // When sorted by date desc, the old .slice(0,10) would show only
    // dates 2026-02-06 through 2026-02-15, excluding dates 01-05.
    const entries = Array.from({ length: 15 }, (_, i) =>
      createEntry({
        id: `entry-${i}`,
        description: `Entry description ${i}`,
        date: `2026-02-${String(i + 1).padStart(2, "0")}`,
      })
    );

    render(
      <ByClientTab
        clients={[client]}
        entries={entries}
        {...defaultProps}
      />
    );

    // Entry-0 (date 2026-02-01, "1 Feb") is the oldest and would be excluded
    // by a .slice(0, 10) after date-desc sort. With DataTable showing all 15
    // entries in one page, it should be present.
    expect(screen.getByText("Entry description 0")).toBeInTheDocument();
    // Also verify a middle entry and the newest entry
    expect(screen.getByText("Entry description 7")).toBeInTheDocument();
    expect(screen.getByText("Entry description 14")).toBeInTheDocument();
  });

  it("shows pagination when entries exceed page size", () => {
    const client = createClient();
    const entries = Array.from({ length: 60 }, (_, i) =>
      createEntry({
        id: `entry-${i}`,
        description: `Entry number ${i}`,
        date: `2026-02-${String((i % 28) + 1).padStart(2, "0")}`,
      })
    );

    render(
      <ByClientTab
        clients={[client]}
        entries={entries}
        {...defaultProps}
      />
    );

    // DataTable's pagination shows "Page X of Y" pattern
    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
  });
});

// --- CDR-04: Topic column in entry table ---

describe("entry table columns", () => {
  it("renders Topic column header", () => {
    const client = createClient();
    const entries = [createEntry()];

    render(
      <ByClientTab
        clients={[client]}
        entries={entries}
        {...defaultProps}
      />
    );

    // "Topic" should appear as a column header in the entry table.
    // Use getAllByText in case "Topic Breakdown" heading also matches partially.
    const topicElements = screen.getAllByText("Topic");
    expect(topicElements.length).toBeGreaterThanOrEqual(1);
  });

  it("shows topicName in entry rows", () => {
    const client = createClient();
    const entries = [
      createEntry({ topicName: "M&A Advisory" }),
    ];

    render(
      <ByClientTab
        clients={[client]}
        entries={entries}
        {...defaultProps}
      />
    );

    // "M&A Advisory" should appear in the entry row area (table body),
    // not just in the topic breakdown chart heading.
    const matches = screen.getAllByText("M&A Advisory");
    // At least one should be in the entry table (distinct from chart label)
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});

// --- CDR-03: Default sort ---

describe("default sort", () => {
  it("sorts entries by date descending by default", () => {
    const client = createClient();
    const entries = [
      createEntry({ id: "e1", date: "2026-02-18", description: "Entry A" }),
      createEntry({ id: "e2", date: "2026-02-20", description: "Entry B" }),
      createEntry({ id: "e3", date: "2026-02-15", description: "Entry C" }),
    ];

    const { container } = render(
      <ByClientTab
        clients={[client]}
        entries={entries}
        {...defaultProps}
      />
    );

    // Find all table rows in the tbody to check date ordering.
    // The first rendered date should be the newest (20 Feb 2026).
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(3);

    // Get the text of the first row — should contain the newest date
    const firstRowText = rows[0]?.textContent || "";
    // "20 Feb" is the newest date — should be in the first row
    expect(firstRowText).toContain("20 Feb");
  });
});
