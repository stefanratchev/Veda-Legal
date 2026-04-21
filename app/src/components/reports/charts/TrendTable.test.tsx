import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrendTable, type TrendTableRow } from "./TrendTable";

const MONTH_LABELS = ["Feb '26", "Mar '26", "Apr '26"];

// JSDOM normalizes trailing zeros: 0.30 → 0.3, 0.35 stays.
const GREEN = "rgba(74, 157, 110, 0.35)";
const RED = "rgba(239, 68, 68, 0.3)";

function makeRow(id: string, name: string, values: number[]): TrendTableRow {
  return { id, name, monthlyValues: values };
}

describe("TrendTable", () => {
  it("renders a row per entity plus header + Total footer", () => {
    const rows = [
      makeRow("a", "Alice", [10, 20, 30]),
      makeRow("b", "Bob", [5, 15, 25]),
      makeRow("c", "Carol", [1, 2, 3]),
    ];
    const { container } = render(
      <TrendTable
        rows={rows}
        monthLabels={MONTH_LABELS}
        mode="billableHours"
        entityLabel="Employee"
      />,
    );

    // 3 body rows + 1 tfoot row = 4 tr inside tbody+tfoot; header has 1 tr.
    const bodyTrs = container.querySelectorAll("tbody tr");
    expect(bodyTrs.length).toBe(3);
    const footTrs = container.querySelectorAll("tfoot tr");
    expect(footTrs.length).toBe(1);

    // Header entity cell
    expect(screen.getByText("Employee")).toBeInTheDocument();
    // Column header uses the first whitespace-split token ("Feb '26" → "Feb").
    expect(screen.getByText("Feb")).toBeInTheDocument();
    expect(screen.getByText("Mar")).toBeInTheDocument();
    expect(screen.getByText("Apr")).toBeInTheDocument();

    // Total row per-column values equal per-column sums.
    const footCells = footTrs[0].querySelectorAll("td");
    // first td = label "Total", then 3 month columns
    expect(footCells[0].textContent).toBe("Total");
    // sums: 10+5+1=16, 20+15+2=37, 30+25+3=58
    expect(footCells[1].textContent).toBe("16h");
    expect(footCells[2].textContent).toBe("37h");
    expect(footCells[3].textContent).toBe("58h");
  });

  it("highlights the max per month with green background in positive modes", () => {
    const rows = [
      makeRow("a", "Alice", [10, 5, 30]),
      makeRow("b", "Bob", [20, 15, 10]),
    ];
    const { container } = render(
      <TrendTable
        rows={rows}
        monthLabels={MONTH_LABELS}
        mode="billableHours"
        entityLabel="Employee"
      />,
    );

    const bodyTrs = container.querySelectorAll("tbody tr");
    // Sorted by last-month desc: Alice (30) first, Bob (10) second.
    const aliceRow = bodyTrs[0];
    const bobRow = bodyTrs[1];
    const aliceCells = aliceRow.querySelectorAll("td");
    const bobCells = bobRow.querySelectorAll("td");

    // Column 0 (Feb): Bob 20 > Alice 10 → Bob highlighted.
    // Column 1 (Mar): Bob 15 > Alice 5 → Bob highlighted.
    // Column 2 (Apr): Alice 30 > Bob 10 → Alice highlighted.
    expect(bobCells[1].getAttribute("style")).toContain(GREEN);
    expect(bobCells[2].getAttribute("style")).toContain(GREEN);
    expect(aliceCells[3].getAttribute("style")).toContain(GREEN);

    // Non-max cells should NOT have the green highlight.
    expect(aliceCells[1].getAttribute("style") || "").not.toContain(GREEN);
    expect(aliceCells[2].getAttribute("style") || "").not.toContain(GREEN);
    expect(bobCells[3].getAttribute("style") || "").not.toContain(GREEN);
  });

  it("highlights the max per month with red in warn modes (unbillableHours)", () => {
    const rows = [
      makeRow("a", "Alice", [10, 5, 30]),
      makeRow("b", "Bob", [20, 15, 10]),
    ];
    const { container } = render(
      <TrendTable
        rows={rows}
        monthLabels={MONTH_LABELS}
        mode="unbillableHours"
        entityLabel="Employee"
      />,
    );

    const bodyTrs = container.querySelectorAll("tbody tr");
    // Sorted by last-month desc: Alice (30) first.
    const aliceRow = bodyTrs[0];
    const bobRow = bodyTrs[1];
    const aliceCells = aliceRow.querySelectorAll("td");
    const bobCells = bobRow.querySelectorAll("td");

    // Column 2 max is Alice (30) → red, not green.
    expect(aliceCells[3].getAttribute("style")).toContain(RED);
    expect(aliceCells[3].getAttribute("style") || "").not.toContain(GREEN);
    // Columns 0 and 1 max is Bob → red.
    expect(bobCells[1].getAttribute("style")).toContain(RED);
    expect(bobCells[2].getAttribute("style")).toContain(RED);
  });

  it("collapses tail rows into a single Others row when topN < rows.length", () => {
    // 22 rows with distinct most-recent-month values (1..22). topN=20 → top 20
    // kept (values 22 down to 3), remainder (values 2, 1) becomes Others.
    const rows: TrendTableRow[] = [];
    for (let i = 1; i <= 22; i++) {
      rows.push(makeRow(`c${i}`, `Client ${String(i).padStart(2, "0")}`, [0, 0, i]));
    }
    const { container } = render(
      <TrendTable
        rows={rows}
        monthLabels={MONTH_LABELS}
        mode="billableHours"
        entityLabel="Client"
        topN={20}
      />,
    );

    const bodyTrs = container.querySelectorAll("tbody tr");
    // top 20 + Others = 21 body rows
    expect(bodyTrs.length).toBe(21);

    // The last body row is Others, muted + italic, id "__others__".
    const othersRow = bodyTrs[20];
    expect(othersRow.textContent).toContain("Others");
    const nameSpan = othersRow.querySelector("td span");
    expect(nameSpan?.className).toContain("italic");
    expect(nameSpan?.className).toContain("text-[var(--text-muted)]");

    // Others last-month value = sum of remainder = 2 + 1 = 3.
    const othersCells = othersRow.querySelectorAll("td");
    expect(othersCells[3].textContent).toBe("3h");

    // Others never gets the highlight, even though it would be the 3rd-highest
    // only; but assert no green bg on its cells.
    for (let i = 1; i <= 3; i++) {
      expect(othersCells[i].getAttribute("style") || "").not.toContain(GREEN);
    }

    // Footer total reconciles with the sum of all 22 original rows:
    // 1+2+...+22 = 253.
    const footCells = container.querySelectorAll("tfoot tr td");
    expect(footCells[3].textContent).toBe("253h");
  });

  it("does not add Others when rows.length <= topN", () => {
    const rows: TrendTableRow[] = [];
    for (let i = 1; i <= 15; i++) {
      rows.push(makeRow(`c${i}`, `Client ${i}`, [i, i, i]));
    }
    const { container } = render(
      <TrendTable
        rows={rows}
        monthLabels={MONTH_LABELS}
        mode="billableHours"
        entityLabel="Client"
        topN={20}
      />,
    );

    const bodyTrs = container.querySelectorAll("tbody tr");
    expect(bodyTrs.length).toBe(15);
    expect(screen.queryByText("Others")).not.toBeInTheDocument();
  });

  it("renders empty-state message when rows is empty", () => {
    render(
      <TrendTable
        rows={[]}
        monthLabels={MONTH_LABELS}
        mode="billableHours"
        entityLabel="Client"
      />,
    );
    expect(screen.getByText("No client data")).toBeInTheDocument();
  });

  it("renders custom emptyMessage when provided", () => {
    render(
      <TrendTable
        rows={[]}
        monthLabels={MONTH_LABELS}
        mode="billableHours"
        entityLabel="Employee"
        emptyMessage="Nothing to show"
      />,
    );
    expect(screen.getByText("Nothing to show")).toBeInTheDocument();
  });

  it("Total row sums include Others row (no double counting)", () => {
    // 3 rows, topN=2 → one kept row + Others (collapsing last).
    // Kept: Alice [10, 20, 30], Bob [20, 10, 5].
    // Others: Carol [1, 1, 1] → [1, 1, 1].
    // Totals: [31, 31, 36].
    const rows = [
      makeRow("a", "Alice", [10, 20, 30]),
      makeRow("b", "Bob", [20, 10, 5]),
      makeRow("c", "Carol", [1, 1, 1]),
    ];
    const { container } = render(
      <TrendTable
        rows={rows}
        monthLabels={MONTH_LABELS}
        mode="billableHours"
        entityLabel="Client"
        topN={2}
      />,
    );

    // 2 kept + Others row = 3 body rows.
    const bodyTrs = container.querySelectorAll("tbody tr");
    expect(bodyTrs.length).toBe(3);

    const footCells = container.querySelectorAll("tfoot tr td");
    expect(footCells[1].textContent).toBe("31h");
    expect(footCells[2].textContent).toBe("31h");
    expect(footCells[3].textContent).toBe("36h");
  });
});
