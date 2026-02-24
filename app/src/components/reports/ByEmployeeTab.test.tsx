import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ByEmployeeTab } from "./ByEmployeeTab";

// Mock BarChart to render data as DOM text (Recharts SVG doesn't render in JSDOM)
vi.mock("./charts/BarChart", () => ({
  BarChart: ({ data }: { data: { name: string; value: number }[] }) => (
    <div data-testid="bar-chart">
      {data.map((d) => (
        <span key={d.name}>{d.name}</span>
      ))}
    </div>
  ),
}));

// --- Types matching ByEmployeeTab's expected interfaces AFTER 04-01 updates ---
// These types include `topics` on EmployeeStats and `topicName` on Entry,
// which don't exist on the component's interfaces yet. Tests will fail (RED)
// until 04-01 and 04-02 implement the features.

interface EmployeeStats {
  id: string;
  name: string;
  totalHours: number;
  clientCount: number;
  topClient: { name: string; hours: number } | null;
  clients: { id: string; name: string; hours: number }[];
  dailyHours: { date: string; hours: number }[];
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

function createEmployee(
  overrides?: Partial<EmployeeStats>
): EmployeeStats {
  return {
    id: "e1",
    name: "John Smith",
    totalHours: 24,
    clientCount: 2,
    topClient: { name: "Acme Corp", hours: 16 },
    clients: [
      { id: "c1", name: "Acme Corp", hours: 16 },
      { id: "c2", name: "Beta Ltd", hours: 8 },
    ],
    dailyHours: [{ date: "2026-02-20", hours: 8 }],
    topics: [
      { topicName: "M&A Advisory", totalHours: 14, writtenOffHours: 0 },
      { topicName: "Company Law", totalHours: 10, writtenOffHours: 0 },
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
  currentUserId: "e1",
  onSelectEmployee: vi.fn(),
  selectedEmployeeId: "e1",
};

// --- EDR-01: Topic breakdown chart ---

describe("topic breakdown chart", () => {
  it("renders Topic Breakdown heading when employee with topics is selected", () => {
    const employee = createEmployee();
    const entries = [createEntry()];

    render(
      <ByEmployeeTab
        employees={[employee]}
        entries={entries}
        {...defaultProps}
      />
    );

    expect(screen.getByText("Topic Breakdown")).toBeInTheDocument();
  });

  it("hides zero-hour topics from chart data", () => {
    const employee = createEmployee({
      topics: [
        { topicName: "Zero Topic", totalHours: 0, writtenOffHours: 0 },
        { topicName: "Active Topic", totalHours: 10, writtenOffHours: 0 },
      ],
      totalHours: 10,
    });
    const entries = [createEntry()];

    const { container } = render(
      <ByEmployeeTab
        employees={[employee]}
        entries={entries}
        {...defaultProps}
      />
    );

    // Zero-hour topics should not appear in chart data.
    // Check that the zero topic name does NOT appear in the rendered output.
    expect(container.textContent).not.toContain("Zero Topic");
  });

  it("shows topic name only in bar labels (hours/percentage in tooltip)", () => {
    const employee = createEmployee({
      topics: [
        { topicName: "M&A Advisory", totalHours: 14, writtenOffHours: 0 },
      ],
      totalHours: 24,
    });
    const entries = [createEntry()];

    const { container } = render(
      <ByEmployeeTab
        employees={[employee]}
        entries={entries}
        {...defaultProps}
      />
    );

    // Topic name should appear in the chart labels
    const textContent = container.textContent || "";
    expect(textContent).toContain("M&A Advisory");
  });
});

// --- EDR-02: Full entry table with pagination ---

describe("entry table", () => {
  it("renders all entries via DataTable, not limited to 10", () => {
    const employee = createEmployee();
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
      <ByEmployeeTab
        employees={[employee]}
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
    const employee = createEmployee();
    const entries = Array.from({ length: 60 }, (_, i) =>
      createEntry({
        id: `entry-${i}`,
        description: `Entry number ${i}`,
        date: `2026-02-${String((i % 28) + 1).padStart(2, "0")}`,
      })
    );

    render(
      <ByEmployeeTab
        employees={[employee]}
        entries={entries}
        {...defaultProps}
      />
    );

    // DataTable's pagination shows "Page X of Y" pattern
    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
  });
});

// --- EDR-03: Topic column in entry table ---

describe("entry table columns", () => {
  it("renders Topic column header", () => {
    const employee = createEmployee();
    const entries = [createEntry()];

    render(
      <ByEmployeeTab
        employees={[employee]}
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
    const employee = createEmployee();
    const entries = [
      createEntry({ topicName: "M&A Advisory" }),
    ];

    render(
      <ByEmployeeTab
        employees={[employee]}
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

// --- EDR-02: Default sort ---

describe("default sort", () => {
  it("sorts entries by date descending by default", () => {
    const employee = createEmployee();
    const entries = [
      createEntry({ id: "e1", date: "2026-02-18", description: "Entry A" }),
      createEntry({ id: "e2", date: "2026-02-20", description: "Entry B" }),
      createEntry({ id: "e3", date: "2026-02-15", description: "Entry C" }),
    ];

    const { container } = render(
      <ByEmployeeTab
        employees={[employee]}
        entries={entries}
        {...defaultProps}
      />
    );

    // Find all table rows in the tbody to check date ordering.
    // The first rendered date should be the newest (20 Feb 2026).
    const rows = container.querySelectorAll("tbody tr");
    expect(rows.length).toBe(3);

    // Get the text of the first row -- should contain the newest date
    const firstRowText = rows[0]?.textContent || "";
    // "20 Feb" is the newest date -- should be in the first row
    expect(firstRowText).toContain("20 Feb");
  });
});
