import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TrendTable, type TrendTableRow } from "./TrendTable";

const MONTH_LABELS = ["Feb '26", "Mar '26", "Apr '26"];

function makeRow(id: string, name: string, values: number[]): TrendTableRow {
  return {
    id,
    name,
    monthlyCells: values.map((v) => ({ numerator: v, denominator: 1 })),
  };
}

function makeRatioRow(
  id: string,
  name: string,
  pairs: [number, number][],
): TrendTableRow {
  return {
    id,
    name,
    monthlyCells: pairs.map(([numerator, denominator]) => ({
      numerator,
      denominator,
    })),
  };
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

  it("renders realization cells as integer percentages", () => {
    const rows = [
      makeRatioRow("a", "Alice", [
        [50, 100],
        [30, 60],
        [75, 100],
      ]),
    ];
    const { container } = render(
      <TrendTable
        rows={rows}
        monthLabels={MONTH_LABELS}
        mode="realization"
        entityLabel="Employee"
      />,
    );

    const aliceCells = container
      .querySelectorAll("tbody tr")[0]
      .querySelectorAll("td");
    // 50/100 = 50%, 30/60 = 50%, 75/100 = 75%
    expect(aliceCells[1].textContent).toBe("50%");
    expect(aliceCells[2].textContent).toBe("50%");
    expect(aliceCells[3].textContent).toBe("75%");
  });

  it("renders effective rate cells as €/hr with dash when billedHours=0", () => {
    const rows = [
      makeRatioRow("a", "Alice", [
        [1000, 10],
        [2000, 0],
        [3000, 25],
      ]),
    ];
    const { container } = render(
      <TrendTable
        rows={rows}
        monthLabels={MONTH_LABELS}
        mode="effectiveRate"
        entityLabel="Employee"
      />,
    );

    const aliceCells = container
      .querySelectorAll("tbody tr")[0]
      .querySelectorAll("td");
    // 1000/10 = 100 → "€100"
    expect(aliceCells[1].textContent).toBe("€100");
    // 2000/0 → "—"
    expect(aliceCells[2].textContent).toBe("—");
    // 3000/25 = 120 → "€120"
    expect(aliceCells[3].textContent).toBe("€120");
  });

  it("Total row uses weighted aggregation for realization, not simple mean", () => {
    // Row A: [80, 100] → 80%. Row B: [20, 200] → 10%.
    // Weighted Total = (80+20)/(100+200) = 100/300 = 33% (rounded).
    // Simple mean would be (80+10)/2 = 45% — we assert NOT that.
    const rows = [
      makeRatioRow("a", "Alice", [[80, 100]]),
      makeRatioRow("b", "Bob", [[20, 200]]),
    ];
    const { container } = render(
      <TrendTable
        rows={rows}
        monthLabels={["Apr '26"]}
        mode="realization"
        entityLabel="Employee"
      />,
    );

    const footCells = container.querySelectorAll("tfoot tr td");
    expect(footCells[1].textContent).toBe("33%");
    expect(footCells[1].textContent).not.toBe("45%");
  });

  it("Others row uses weighted aggregation for utilization", () => {
    // Kept A: [80, 100] → 80%.
    // Tail B: [10, 100], Tail C: [20, 100] → Others weighted = (10+20)/(100+100) = 30/200 = 15%.
    const rows = [
      makeRatioRow("a", "Alice", [[80, 100]]),
      makeRatioRow("b", "Bob", [[10, 100]]),
      makeRatioRow("c", "Carol", [[20, 100]]),
    ];
    const { container } = render(
      <TrendTable
        rows={rows}
        monthLabels={["Apr '26"]}
        mode="utilization"
        entityLabel="Employee"
        topN={1}
      />,
    );

    const bodyTrs = container.querySelectorAll("tbody tr");
    // 1 kept + Others = 2.
    expect(bodyTrs.length).toBe(2);
    const othersCells = bodyTrs[1].querySelectorAll("td");
    expect(othersCells[1].textContent).toBe("15%");
  });

  it("zero-denominator cells render dash and sort to the bottom", () => {
    // Row A: [500, 0] → null/"—". Row B: [100, 10] → €10.
    const rows = [
      makeRatioRow("a", "Alice", [[500, 0]]),
      makeRatioRow("b", "Bob", [[100, 10]]),
    ];
    const { container } = render(
      <TrendTable
        rows={rows}
        monthLabels={["Apr '26"]}
        mode="effectiveRate"
        entityLabel="Employee"
      />,
    );

    const bodyTrs = container.querySelectorAll("tbody tr");
    // Sort by last-month value desc: B (10) > A (null sorts to bottom).
    const bRow = bodyTrs[0];
    const aRow = bodyTrs[1];
    expect(bRow.textContent).toContain("Bob");
    expect(aRow.textContent).toContain("Alice");

    const aCells = aRow.querySelectorAll("td");
    const bCells = bRow.querySelectorAll("td");

    // A: 500/0 = "—".
    expect(aCells[1].textContent).toBe("—");
    // B: 100/10 = "€10".
    expect(bCells[1].textContent).toBe("€10");
  });

  it("month headers are buttons; entity header is plain text", () => {
    const rows = [
      makeRow("a", "Alice", [1, 2, 3]),
      makeRow("b", "Bob", [4, 5, 6]),
      makeRow("c", "Carol", [7, 8, 9]),
    ];
    const { container } = render(
      <TrendTable
        rows={rows}
        monthLabels={MONTH_LABELS}
        mode="billableHours"
        entityLabel="Employee"
      />,
    );

    const headerThs = container.querySelectorAll("thead th");
    // 1 entity + 3 month headers = 4 total
    expect(headerThs.length).toBe(4);

    // Entity <th> (idx 0) has no <button> child
    expect(headerThs[0].querySelector("button")).toBeNull();

    // Each month <th> (idx 1-3) has exactly one <button>
    for (let i = 1; i <= 3; i++) {
      const buttons = headerThs[i].querySelectorAll("button");
      expect(buttons.length).toBe(1);
    }
  });

  it("initial aria-sort state is 'none' on month headers; entity has no aria-sort", () => {
    const rows = [
      makeRow("a", "Alice", [1, 2, 3]),
      makeRow("b", "Bob", [4, 5, 6]),
    ];
    const { container } = render(
      <TrendTable
        rows={rows}
        monthLabels={MONTH_LABELS}
        mode="billableHours"
        entityLabel="Employee"
      />,
    );

    const headerThs = container.querySelectorAll("thead th");
    // Entity <th> has no aria-sort attribute
    expect(headerThs[0].hasAttribute("aria-sort")).toBe(false);
    // Month <th>s all have aria-sort="none" before any click
    expect(headerThs[1].getAttribute("aria-sort")).toBe("none");
    expect(headerThs[2].getAttribute("aria-sort")).toBe("none");
    expect(headerThs[3].getAttribute("aria-sort")).toBe("none");
  });

  it("3-state click cycle: 1st desc, 2nd asc, 3rd reset (with caret + aria-sort)", () => {
    // Middle month has distinct values that differ from last-month order.
    // Default (no click): last-month desc → Alice(30), Carol(20), Bob(10).
    const rows = [
      makeRow("a", "Alice", [0, 5, 30]),
      makeRow("b", "Bob", [0, 20, 10]),
      makeRow("c", "Carol", [0, 10, 20]),
    ];
    const { container } = render(
      <TrendTable
        rows={rows}
        monthLabels={MONTH_LABELS}
        mode="billableHours"
        entityLabel="Employee"
      />,
    );

    // Initial: sorted by last-month desc → Alice(30), Carol(20), Bob(10).
    let bodyTrs = container.querySelectorAll("tbody tr");
    expect(bodyTrs[0].textContent).toContain("Alice");
    expect(bodyTrs[1].textContent).toContain("Carol");
    expect(bodyTrs[2].textContent).toContain("Bob");

    const headerThs = container.querySelectorAll("thead th");
    // idx 2 = "Mar" (idx 0 entity, 1 Feb, 2 Mar, 3 Apr)
    const marTh = headerThs[2] as HTMLElement;
    const marButton = marTh.querySelector("button") as HTMLButtonElement;

    // 1st click: sort by Mar desc → Bob(20), Carol(10), Alice(5)
    fireEvent.click(marButton);
    bodyTrs = container.querySelectorAll("tbody tr");
    expect(bodyTrs[0].textContent).toContain("Bob");
    expect(bodyTrs[1].textContent).toContain("Carol");
    expect(bodyTrs[2].textContent).toContain("Alice");
    expect(marTh.getAttribute("aria-sort")).toBe("descending");
    expect(marTh.textContent).toContain("▼");

    // 2nd click: flip to asc → Alice(5), Carol(10), Bob(20)
    fireEvent.click(marButton);
    bodyTrs = container.querySelectorAll("tbody tr");
    expect(bodyTrs[0].textContent).toContain("Alice");
    expect(bodyTrs[1].textContent).toContain("Carol");
    expect(bodyTrs[2].textContent).toContain("Bob");
    expect(marTh.getAttribute("aria-sort")).toBe("ascending");
    expect(marTh.textContent).toContain("▲");

    // 3rd click: reset to default (last-month desc) → Alice(30), Carol(20), Bob(10)
    fireEvent.click(marButton);
    bodyTrs = container.querySelectorAll("tbody tr");
    expect(bodyTrs[0].textContent).toContain("Alice");
    expect(bodyTrs[1].textContent).toContain("Carol");
    expect(bodyTrs[2].textContent).toContain("Bob");
    expect(marTh.getAttribute("aria-sort")).toBe("none");
    // No caret anywhere in the header row
    const headerRow = container.querySelector("thead tr") as HTMLElement;
    expect(headerRow.textContent).not.toContain("▼");
    expect(headerRow.textContent).not.toContain("▲");
  });

  it("clicking a different column resets to fresh desc on the new column", () => {
    const rows = [
      makeRow("a", "Alice", [0, 5, 30]),
      makeRow("b", "Bob", [0, 20, 10]),
      makeRow("c", "Carol", [0, 10, 20]),
    ];
    const { container } = render(
      <TrendTable
        rows={rows}
        monthLabels={MONTH_LABELS}
        mode="billableHours"
        entityLabel="Employee"
      />,
    );

    const headerThs = container.querySelectorAll("thead th");
    const marTh = headerThs[2] as HTMLElement;
    const aprTh = headerThs[3] as HTMLElement;
    const marButton = marTh.querySelector("button") as HTMLButtonElement;
    const aprButton = aprTh.querySelector("button") as HTMLButtonElement;

    // Click Mar (desc)
    fireEvent.click(marButton);
    expect(marTh.getAttribute("aria-sort")).toBe("descending");
    expect(marTh.textContent).toContain("▼");

    // Click Apr: Mar loses caret/sort; Apr becomes active desc
    fireEvent.click(aprButton);
    expect(marTh.getAttribute("aria-sort")).toBe("none");
    expect(marTh.textContent).not.toContain("▼");
    expect(marTh.textContent).not.toContain("▲");
    expect(aprTh.getAttribute("aria-sort")).toBe("descending");
    expect(aprTh.textContent).toContain("▼");

    // Row order should be Apr desc: Alice(30), Carol(20), Bob(10)
    const bodyTrs = container.querySelectorAll("tbody tr");
    expect(bodyTrs[0].textContent).toContain("Alice");
    expect(bodyTrs[1].textContent).toContain("Carol");
    expect(bodyTrs[2].textContent).toContain("Bob");
  });

  it("null/zero cells sort to bottom in BOTH directions (absolute mode)", () => {
    // Absolute billableHours. Alice Mar=0, Bob Mar=0, Carol Mar=7.
    // Distinct last-month values so default order is predictable.
    const rows = [
      makeRow("a", "Alice", [10, 0, 1]),
      makeRow("b", "Bob", [5, 0, 2]),
      makeRow("c", "Carol", [3, 7, 3]),
    ];
    const { container } = render(
      <TrendTable
        rows={rows}
        monthLabels={MONTH_LABELS}
        mode="billableHours"
        entityLabel="Employee"
      />,
    );

    const headerThs = container.querySelectorAll("thead th");
    const marButton = headerThs[2].querySelector("button") as HTMLButtonElement;

    // 1st click (desc on Mar): Carol(7) first, then Alice, Bob (both 0, alpha tie-break)
    fireEvent.click(marButton);
    let bodyTrs = container.querySelectorAll("tbody tr");
    expect(bodyTrs[0].textContent).toContain("Carol");
    expect(bodyTrs[1].textContent).toContain("Alice");
    expect(bodyTrs[2].textContent).toContain("Bob");

    // 2nd click (asc on Mar): null-at-bottom invariant — Carol (7) still first
    // because she's the only real value, Alice+Bob (0 counts as null) trail.
    fireEvent.click(marButton);
    bodyTrs = container.querySelectorAll("tbody tr");
    expect(bodyTrs[0].textContent).toContain("Carol");
    expect(bodyTrs[1].textContent).toContain("Alice");
    expect(bodyTrs[2].textContent).toContain("Bob");
  });

  it("ratio-mode null (denominator=0) trails in both directions", () => {
    // Single month for simplicity.
    // Alice: [100, 10] = €10, Bob: [500, 0] = null, Carol: [300, 5] = €60.
    const rows = [
      makeRatioRow("a", "Alice", [[100, 10]]),
      makeRatioRow("b", "Bob", [[500, 0]]),
      makeRatioRow("c", "Carol", [[300, 5]]),
    ];
    const { container } = render(
      <TrendTable
        rows={rows}
        monthLabels={["Apr '26"]}
        mode="effectiveRate"
        entityLabel="Employee"
      />,
    );

    const headerThs = container.querySelectorAll("thead th");
    // Only 1 month header (idx 0 entity, idx 1 Apr)
    const aprButton = headerThs[1].querySelector("button") as HTMLButtonElement;

    // 1st click (desc): Carol(60), Alice(10), Bob(null → last)
    fireEvent.click(aprButton);
    let bodyTrs = container.querySelectorAll("tbody tr");
    expect(bodyTrs[0].textContent).toContain("Carol");
    expect(bodyTrs[1].textContent).toContain("Alice");
    expect(bodyTrs[2].textContent).toContain("Bob");

    // 2nd click (asc): Alice(10), Carol(60), Bob(null → still last)
    fireEvent.click(aprButton);
    bodyTrs = container.querySelectorAll("tbody tr");
    expect(bodyTrs[0].textContent).toContain("Alice");
    expect(bodyTrs[1].textContent).toContain("Carol");
    expect(bodyTrs[2].textContent).toContain("Bob");
  });

  it("Others row stays at bottom when sort column is changed (desc + asc)", () => {
    // 22 rows, topN=20 → last body row should be Others in both states.
    const rows: TrendTableRow[] = [];
    for (let i = 1; i <= 22; i++) {
      rows.push(
        makeRow(`c${i}`, `Client ${String(i).padStart(2, "0")}`, [i, i, i]),
      );
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

    const headerThs = container.querySelectorAll("thead th");
    // idx 1 = "Feb" (the earliest month / idx 0 of month columns)
    const febButton = headerThs[1].querySelector("button") as HTMLButtonElement;

    // Click Feb (desc): Others still last body row
    fireEvent.click(febButton);
    let bodyTrs = container.querySelectorAll("tbody tr");
    expect(bodyTrs[bodyTrs.length - 1].textContent).toContain("Others");

    // Click Feb again (asc): Others still last body row
    fireEvent.click(febButton);
    bodyTrs = container.querySelectorAll("tbody tr");
    expect(bodyTrs[bodyTrs.length - 1].textContent).toContain("Others");
  });

  it("mode toggle persistence — changing `mode` prop after click does NOT reset sort state", () => {
    const rows = [
      makeRatioRow("a", "Alice", [
        [10, 1],
        [20, 1],
        [30, 1],
      ]),
      makeRatioRow("b", "Bob", [
        [5, 1],
        [15, 1],
        [25, 1],
      ]),
    ];
    const { container, rerender } = render(
      <TrendTable
        rows={rows}
        monthLabels={MONTH_LABELS}
        mode="billableHours"
        entityLabel="Employee"
      />,
    );

    const headerThs = container.querySelectorAll("thead th");
    const marTh = headerThs[2] as HTMLElement;
    const marButton = marTh.querySelector("button") as HTMLButtonElement;

    // Click Mar (desc)
    fireEvent.click(marButton);
    expect(marTh.getAttribute("aria-sort")).toBe("descending");
    expect(marTh.textContent).toContain("▼");

    // Re-render with different mode
    rerender(
      <TrendTable
        rows={rows}
        monthLabels={MONTH_LABELS}
        mode="billableRevenue"
        entityLabel="Employee"
      />,
    );

    // Sort state persists across mode changes
    const marThAfter = container.querySelectorAll("thead th")[2] as HTMLElement;
    expect(marThAfter.getAttribute("aria-sort")).toBe("descending");
    expect(marThAfter.textContent).toContain("▼");
  });

  it("Total row in <tfoot> is never reordered by sort", () => {
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

    const headerThs = container.querySelectorAll("thead th");
    const marButton = headerThs[2].querySelector("button") as HTMLButtonElement;

    // Click any month header
    fireEvent.click(marButton);

    // <tfoot> row's first cell still reads "Total"
    const footCells = container.querySelectorAll("tfoot tr td");
    expect(footCells[0].textContent).toBe("Total");
  });
});
