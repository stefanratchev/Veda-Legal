# Reports Section Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a comprehensive reports section with Overview, By Employee, and By Client tabs, date range filtering with period comparison, and visual charts.

**Architecture:** Server component fetches initial data for current month. Client component manages tab state, date range, and comparison selection. API route aggregates TimeEntry data grouped by employee and client. Recharts for visualization.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, Prisma ORM, Recharts, Vitest

---

## Task 1: Schema Migration - Remove hourlyRate from User

**Files:**
- Modify: `app/prisma/schema.prisma:18`

**Step 1: Update schema**

Remove the hourlyRate field from the User model:

```prisma
// User model - linked to Microsoft 365 SSO
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  role          UserRole  @default(EMPLOYEE)
  lastLogin     DateTime?

  // Relations
  timeEntries   TimeEntry[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@map("users")
}
```

**Step 2: Generate migration**

Run: `cd app && npm run db:migrate -- --name remove_user_hourly_rate`

Expected: Migration created successfully

**Step 3: Generate Prisma client**

Run: `cd app && npm run db:generate`

Expected: Prisma client regenerated

**Step 4: Run tests to verify nothing breaks**

Run: `cd app && npm run test -- --run`

Expected: All tests pass

**Step 5: Commit**

```bash
git add app/prisma/
git commit -m "chore: remove hourlyRate from User model

Revenue is calculated from Client hourly rates only."
```

---

## Task 2: Add date-utils functions for reports

**Files:**
- Modify: `app/src/lib/date-utils.ts`
- Create: `app/src/lib/date-utils.test.ts` (add tests)

**Step 1: Write failing tests for new date functions**

Add to `app/src/lib/date-utils.test.ts`:

```typescript
describe("getMonthRange", () => {
  it("returns first and last day of month", () => {
    const date = new Date("2025-12-15");
    const { start, end } = getMonthRange(date);
    expect(formatDateISO(start)).toBe("2025-12-01");
    expect(formatDateISO(end)).toBe("2025-12-31");
  });
});

describe("getPreviousPeriod", () => {
  it("returns previous month for monthly range", () => {
    const start = new Date("2025-12-01");
    const end = new Date("2025-12-31");
    const { start: prevStart, end: prevEnd } = getPreviousPeriod(start, end);
    expect(formatDateISO(prevStart)).toBe("2025-11-01");
    expect(formatDateISO(prevEnd)).toBe("2025-11-30");
  });

  it("returns same-length period for custom range", () => {
    const start = new Date("2025-12-10");
    const end = new Date("2025-12-20");
    const { start: prevStart, end: prevEnd } = getPreviousPeriod(start, end);
    expect(formatDateISO(prevStart)).toBe("2025-11-29");
    expect(formatDateISO(prevEnd)).toBe("2025-12-09");
  });
});

describe("getPreviousYear", () => {
  it("returns same dates one year ago", () => {
    const start = new Date("2025-12-01");
    const end = new Date("2025-12-31");
    const { start: prevStart, end: prevEnd } = getPreviousYear(start, end);
    expect(formatDateISO(prevStart)).toBe("2024-12-01");
    expect(formatDateISO(prevEnd)).toBe("2024-12-31");
  });
});

describe("formatMonthShort", () => {
  it("formats date as short month and year", () => {
    const date = new Date("2025-12-15");
    expect(formatMonthShort(date)).toBe("Dec 2025");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `cd app && npm run test -- --run`

Expected: New tests fail with "function not defined"

**Step 3: Implement the date functions**

Add to `app/src/lib/date-utils.ts`:

```typescript
/**
 * Get first and last day of a month
 */
export function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

/**
 * Get previous period of same length
 */
export function getPreviousPeriod(start: Date, end: Date): { start: Date; end: Date } {
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const prevEnd = new Date(start);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - days + 1);
  return { start: prevStart, end: prevEnd };
}

/**
 * Get same period one year ago
 */
export function getPreviousYear(start: Date, end: Date): { start: Date; end: Date } {
  const prevStart = new Date(start);
  prevStart.setFullYear(prevStart.getFullYear() - 1);
  const prevEnd = new Date(end);
  prevEnd.setFullYear(prevEnd.getFullYear() - 1);
  return { start: prevStart, end: prevEnd };
}

/**
 * Format date as short month and year (e.g., "Dec 2025")
 */
export function formatMonthShort(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}
```

**Step 4: Run tests to verify they pass**

Run: `cd app && npm run test -- --run`

Expected: All tests pass

**Step 5: Commit**

```bash
git add app/src/lib/date-utils.ts app/src/lib/date-utils.test.ts
git commit -m "feat: add date utilities for reports

- getMonthRange: get first and last day of month
- getPreviousPeriod: get previous period of same length
- getPreviousYear: get same period one year ago
- formatMonthShort: format as 'Dec 2025'"
```

---

## Task 3: Create Reports API route

**Files:**
- Create: `app/src/app/api/reports/route.ts`

**Step 1: Create the reports API route**

Create `app/src/app/api/reports/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, getUserFromSession } from "@/lib/api-utils";
import { Prisma } from "@prisma/client";

interface EmployeeStats {
  id: string;
  name: string;
  totalHours: number;
  clientCount: number;
  topClient: { name: string; hours: number } | null;
  clients: { id: string; name: string; hours: number }[];
  dailyHours: { date: string; hours: number }[];
}

interface ClientStats {
  id: string;
  name: string;
  timesheetCode: string;
  hourlyRate: number | null;
  totalHours: number;
  revenue: number | null;
  employees: { id: string; name: string; hours: number }[];
}

interface ReportData {
  summary: {
    totalHours: number;
    totalRevenue: number | null;
    activeClients: number;
  };
  byEmployee: EmployeeStats[];
  byClient: ClientStats[];
  entries: {
    id: string;
    date: string;
    hours: number;
    description: string;
    userId: string;
    userName: string;
    clientId: string;
    clientName: string;
    clientCode: string;
  }[];
}

// GET /api/reports?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get user role to determine data access
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { role: true },
  });

  const isAdmin = dbUser?.role === "ADMIN";

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "startDate and endDate are required" },
      { status: 400 }
    );
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  try {
    // Fetch time entries for the period
    const whereClause: Prisma.TimeEntryWhereInput = {
      date: { gte: start, lte: end },
      // Non-admins only see their own data
      ...(!isAdmin && { userId: user.id }),
    };

    const entries = await db.timeEntry.findMany({
      where: whereClause,
      select: {
        id: true,
        date: true,
        hours: true,
        description: true,
        userId: true,
        user: { select: { id: true, name: true } },
        clientId: true,
        client: { select: { id: true, name: true, timesheetCode: true, hourlyRate: true } },
      },
      orderBy: { date: "desc" },
    });

    // Aggregate by employee
    const employeeMap = new Map<string, {
      id: string;
      name: string;
      totalHours: number;
      clients: Map<string, { name: string; hours: number }>;
      dailyHours: Map<string, number>;
    }>();

    // Aggregate by client
    const clientMap = new Map<string, {
      id: string;
      name: string;
      timesheetCode: string;
      hourlyRate: number | null;
      totalHours: number;
      employees: Map<string, { name: string; hours: number }>;
    }>();

    let totalHours = 0;
    let totalRevenue = 0;
    const activeClientIds = new Set<string>();

    for (const entry of entries) {
      const hours = Number(entry.hours);
      totalHours += hours;
      activeClientIds.add(entry.clientId);

      const clientRate = entry.client.hourlyRate ? Number(entry.client.hourlyRate) : null;
      if (clientRate !== null) {
        totalRevenue += hours * clientRate;
      }

      // Employee aggregation
      const empId = entry.userId;
      if (!employeeMap.has(empId)) {
        employeeMap.set(empId, {
          id: empId,
          name: entry.user.name || "Unknown",
          totalHours: 0,
          clients: new Map(),
          dailyHours: new Map(),
        });
      }
      const emp = employeeMap.get(empId)!;
      emp.totalHours += hours;

      const dateStr = entry.date.toISOString().split("T")[0];
      emp.dailyHours.set(dateStr, (emp.dailyHours.get(dateStr) || 0) + hours);

      if (!emp.clients.has(entry.clientId)) {
        emp.clients.set(entry.clientId, { name: entry.client.name, hours: 0 });
      }
      emp.clients.get(entry.clientId)!.hours += hours;

      // Client aggregation
      const clientId = entry.clientId;
      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          id: clientId,
          name: entry.client.name,
          timesheetCode: entry.client.timesheetCode,
          hourlyRate: clientRate,
          totalHours: 0,
          employees: new Map(),
        });
      }
      const client = clientMap.get(clientId)!;
      client.totalHours += hours;

      if (!client.employees.has(empId)) {
        client.employees.set(empId, { name: entry.user.name || "Unknown", hours: 0 });
      }
      client.employees.get(empId)!.hours += hours;
    }

    // Build response
    const byEmployee: EmployeeStats[] = Array.from(employeeMap.values()).map((emp) => {
      const clients = Array.from(emp.clients.entries())
        .map(([id, data]) => ({ id, name: data.name, hours: data.hours }))
        .sort((a, b) => b.hours - a.hours);

      return {
        id: emp.id,
        name: emp.name,
        totalHours: emp.totalHours,
        clientCount: clients.length,
        topClient: clients[0] ? { name: clients[0].name, hours: clients[0].hours } : null,
        clients,
        dailyHours: Array.from(emp.dailyHours.entries())
          .map(([date, hours]) => ({ date, hours }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    }).sort((a, b) => b.totalHours - a.totalHours);

    const byClient: ClientStats[] = Array.from(clientMap.values()).map((client) => {
      const employees = Array.from(client.employees.entries())
        .map(([id, data]) => ({ id, name: data.name, hours: data.hours }))
        .sort((a, b) => b.hours - a.hours);

      return {
        id: client.id,
        name: client.name,
        timesheetCode: client.timesheetCode,
        hourlyRate: client.hourlyRate,
        totalHours: client.totalHours,
        revenue: client.hourlyRate !== null ? client.totalHours * client.hourlyRate : null,
        employees,
      };
    }).sort((a, b) => b.totalHours - a.totalHours);

    const response: ReportData = {
      summary: {
        totalHours,
        totalRevenue: isAdmin ? totalRevenue : null,
        activeClients: activeClientIds.size,
      },
      byEmployee,
      byClient: isAdmin ? byClient : byClient.map(c => ({ ...c, hourlyRate: null, revenue: null })),
      entries: entries.map((e) => ({
        id: e.id,
        date: e.date.toISOString().split("T")[0],
        hours: Number(e.hours),
        description: e.description,
        userId: e.userId,
        userName: e.user.name || "Unknown",
        clientId: e.clientId,
        clientName: e.client.name,
        clientCode: e.client.timesheetCode,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Database error fetching reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch report data" },
      { status: 500 }
    );
  }
}
```

**Step 2: Run lint to check for errors**

Run: `cd app && npm run lint`

Expected: No errors

**Step 3: Commit**

```bash
git add app/src/app/api/reports/route.ts
git commit -m "feat: add reports API route

GET /api/reports?startDate=...&endDate=...
- Aggregates time entries by employee and client
- Role-based access: admins see all, employees see own data
- Returns summary stats, charts data, and entry list"
```

---

## Task 4: Install Recharts dependency

**Step 1: Install recharts**

Run: `cd app && npm install recharts`

Expected: Package installed successfully

**Step 2: Verify installation**

Run: `cd app && npm ls recharts`

Expected: recharts@x.x.x listed

**Step 3: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "chore: add recharts for data visualization"
```

---

## Task 5: Create chart components

**Files:**
- Create: `app/src/components/reports/charts/BarChart.tsx`
- Create: `app/src/components/reports/charts/DonutChart.tsx`

**Step 1: Create BarChart component**

Create `app/src/components/reports/charts/BarChart.tsx`:

```typescript
"use client";

import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface BarChartProps {
  data: { name: string; value: number; id?: string }[];
  onBarClick?: (id: string) => void;
  valueFormatter?: (value: number) => string;
  layout?: "horizontal" | "vertical";
}

export function BarChart({
  data,
  onBarClick,
  valueFormatter = (v) => v.toFixed(1),
  layout = "horizontal",
}: BarChartProps) {
  const handleClick = (entry: { id?: string }) => {
    if (onBarClick && entry.id) {
      onBarClick(entry.id);
    }
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RechartsBarChart
        data={data}
        layout={layout}
        margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
      >
        {layout === "horizontal" ? (
          <>
            <XAxis
              dataKey="name"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--border-subtle)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--border-subtle)" }}
              tickLine={false}
              tickFormatter={valueFormatter}
            />
          </>
        ) : (
          <>
            <XAxis
              type="number"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--border-subtle)" }}
              tickLine={false}
              tickFormatter={valueFormatter}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--border-subtle)" }}
              tickLine={false}
              width={100}
            />
          </>
        )}
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "4px",
            fontSize: "12px",
          }}
          labelStyle={{ color: "var(--text-primary)" }}
          formatter={(value: number) => [valueFormatter(value), "Hours"]}
        />
        <Bar
          dataKey="value"
          radius={[4, 4, 4, 4]}
          cursor={onBarClick ? "pointer" : "default"}
          onClick={(_, index) => handleClick(data[index])}
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill="var(--accent-pink)"
              fillOpacity={0.8}
            />
          ))}
        </Bar>
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}
```

**Step 2: Create DonutChart component**

Create `app/src/components/reports/charts/DonutChart.tsx`:

```typescript
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface DonutChartProps {
  data: { name: string; value: number; id?: string }[];
  onSliceClick?: (id: string) => void;
  valueFormatter?: (value: number) => string;
  maxSlices?: number;
}

const COLORS = [
  "var(--accent-pink)",
  "#7B68C9",
  "#68A9C9",
  "#68C99B",
  "#C9B868",
  "#C97868",
];

export function DonutChart({
  data,
  onSliceClick,
  valueFormatter = (v) => v.toFixed(1),
  maxSlices = 5,
}: DonutChartProps) {
  // Group smaller slices into "Other"
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  let chartData: { name: string; value: number; id?: string }[];

  if (sortedData.length > maxSlices) {
    const topSlices = sortedData.slice(0, maxSlices);
    const otherValue = sortedData.slice(maxSlices).reduce((sum, d) => sum + d.value, 0);
    chartData = [...topSlices, { name: "Other", value: otherValue }];
  } else {
    chartData = sortedData;
  }

  const handleClick = (entry: { id?: string }) => {
    if (onSliceClick && entry.id) {
      onSliceClick(entry.id);
    }
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
        No data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius="50%"
          outerRadius="80%"
          paddingAngle={2}
          dataKey="value"
          cursor={onSliceClick ? "pointer" : "default"}
          onClick={(_, index) => handleClick(chartData[index])}
        >
          {chartData.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
              fillOpacity={0.8}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "4px",
            fontSize: "12px",
          }}
          labelStyle={{ color: "var(--text-primary)" }}
          formatter={(value: number) => [valueFormatter(value), "Hours"]}
        />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span style={{ color: "var(--text-secondary)", fontSize: "11px" }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

**Step 3: Run lint**

Run: `cd app && npm run lint`

Expected: No errors

**Step 4: Commit**

```bash
git add app/src/components/reports/charts/
git commit -m "feat: add chart components for reports

- BarChart: horizontal/vertical bar chart with click handlers
- DonutChart: pie chart with 'Other' grouping for small slices"
```

---

## Task 6: Create DateRangePicker component

**Files:**
- Create: `app/src/components/reports/DateRangePicker.tsx`

**Step 1: Create DateRangePicker component**

Create `app/src/components/reports/DateRangePicker.tsx`:

```typescript
"use client";

import { useState, useRef } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";
import { formatMonthShort, getMonthRange, formatDateISO } from "@/lib/date-utils";

type Preset = "this-month" | "last-month" | "custom";

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (start: Date, end: Date, preset: Preset) => void;
}

export function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customStart, setCustomStart] = useState(formatDateISO(startDate));
  const [customEnd, setCustomEnd] = useState(formatDateISO(endDate));
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false));

  const today = new Date();
  const thisMonth = getMonthRange(today);
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonth = getMonthRange(lastMonthDate);

  const isThisMonth =
    formatDateISO(startDate) === formatDateISO(thisMonth.start) &&
    formatDateISO(endDate) === formatDateISO(thisMonth.end);

  const isLastMonth =
    formatDateISO(startDate) === formatDateISO(lastMonth.start) &&
    formatDateISO(endDate) === formatDateISO(lastMonth.end);

  const currentPreset: Preset = isThisMonth ? "this-month" : isLastMonth ? "last-month" : "custom";

  const getLabel = () => {
    if (isThisMonth) return "This Month";
    if (isLastMonth) return "Last Month";
    return `${formatMonthShort(startDate)} - ${formatMonthShort(endDate)}`;
  };

  const handlePreset = (preset: Preset) => {
    if (preset === "this-month") {
      onChange(thisMonth.start, thisMonth.end, preset);
    } else if (preset === "last-month") {
      onChange(lastMonth.start, lastMonth.end, preset);
    }
    setIsOpen(false);
  };

  const handleCustomApply = () => {
    const start = new Date(customStart);
    const end = new Date(customEnd);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      onChange(start, end, "custom");
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          flex items-center gap-2 px-3 py-1.5 rounded
          bg-[var(--bg-surface)] border border-[var(--border-subtle)]
          text-[13px] text-[var(--text-secondary)]
          hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]
          transition-all duration-200
        "
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {getLabel()}
        <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded shadow-lg animate-fade-up">
          <div className="p-2 space-y-1">
            <button
              onClick={() => handlePreset("this-month")}
              className={`
                w-full text-left px-3 py-1.5 rounded text-[13px]
                ${currentPreset === "this-month"
                  ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                }
              `}
            >
              This Month
            </button>
            <button
              onClick={() => handlePreset("last-month")}
              className={`
                w-full text-left px-3 py-1.5 rounded text-[13px]
                ${currentPreset === "last-month"
                  ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                }
              `}
            >
              Last Month
            </button>
          </div>

          <div className="border-t border-[var(--border-subtle)] p-2">
            <div className="text-[10px] uppercase text-[var(--text-muted)] mb-2 px-1">Custom Range</div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="
                  px-2 py-1 rounded text-[12px]
                  bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                  text-[var(--text-secondary)]
                  focus:outline-none focus:border-[var(--border-accent)]
                "
              />
              <span className="text-[var(--text-muted)]">-</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="
                  px-2 py-1 rounded text-[12px]
                  bg-[var(--bg-surface)] border border-[var(--border-subtle)]
                  text-[var(--text-secondary)]
                  focus:outline-none focus:border-[var(--border-accent)]
                "
              />
              <button
                onClick={handleCustomApply}
                className="
                  px-2 py-1 rounded text-[12px]
                  bg-[var(--accent-pink)] text-[var(--bg-deep)]
                  hover:bg-[var(--accent-pink-dim)]
                "
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Run lint**

Run: `cd app && npm run lint`

Expected: No errors

**Step 3: Commit**

```bash
git add app/src/components/reports/DateRangePicker.tsx
git commit -m "feat: add DateRangePicker component

- This Month / Last Month presets
- Custom date range picker
- Uses existing useClickOutside hook"
```

---

## Task 7: Create ComparisonPicker component

**Files:**
- Create: `app/src/components/reports/ComparisonPicker.tsx`

**Step 1: Create ComparisonPicker component**

Create `app/src/components/reports/ComparisonPicker.tsx`:

```typescript
"use client";

import { useState, useRef } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";

export type ComparisonType = "previous-period" | "previous-year";

interface ComparisonPickerProps {
  value: ComparisonType;
  onChange: (value: ComparisonType) => void;
}

export function ComparisonPicker({ value, onChange }: ComparisonPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false));

  const labels: Record<ComparisonType, string> = {
    "previous-period": "Previous Period",
    "previous-year": "Previous Year",
  };

  const handleSelect = (type: ComparisonType) => {
    onChange(type);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-2">
        <span className="text-[13px] text-[var(--text-muted)]">vs</span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="
            flex items-center gap-2 px-3 py-1.5 rounded
            bg-[var(--bg-surface)] border border-[var(--border-subtle)]
            text-[13px] text-[var(--text-secondary)]
            hover:border-[var(--border-accent)] hover:text-[var(--text-primary)]
            transition-all duration-200
          "
        >
          {labels[value]}
          <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded shadow-lg animate-fade-up">
          <div className="p-2 space-y-1">
            <button
              onClick={() => handleSelect("previous-period")}
              className={`
                w-full text-left px-3 py-1.5 rounded text-[13px] whitespace-nowrap
                ${value === "previous-period"
                  ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                }
              `}
            >
              Previous Period
            </button>
            <button
              onClick={() => handleSelect("previous-year")}
              className={`
                w-full text-left px-3 py-1.5 rounded text-[13px] whitespace-nowrap
                ${value === "previous-year"
                  ? "bg-[var(--accent-pink)] text-[var(--bg-deep)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                }
              `}
            >
              Previous Year
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Run lint**

Run: `cd app && npm run lint`

Expected: No errors

**Step 3: Commit**

```bash
git add app/src/components/reports/ComparisonPicker.tsx
git commit -m "feat: add ComparisonPicker component

- Previous Period option (same length, prior dates)
- Previous Year option (same dates, year before)"
```

---

## Task 8: Create SummaryCard component

**Files:**
- Create: `app/src/components/reports/SummaryCard.tsx`

**Step 1: Create SummaryCard component**

Create `app/src/components/reports/SummaryCard.tsx`:

```typescript
"use client";

interface SummaryCardProps {
  label: string;
  value: string;
  comparison?: {
    value: number;
    label: string;
    type: "percentage" | "absolute";
  } | null;
}

export function SummaryCard({ label, value, comparison }: SummaryCardProps) {
  const getComparisonDisplay = () => {
    if (!comparison) return null;

    const { value: compValue, label: compLabel, type } = comparison;

    if (compValue === 0) {
      return (
        <span className="text-[var(--text-muted)]">
          — vs {compLabel}
        </span>
      );
    }

    const isPositive = compValue > 0;
    const color = isPositive ? "text-green-400" : "text-red-400";
    const arrow = isPositive ? "↑" : "↓";
    const displayValue = type === "percentage"
      ? `${Math.abs(compValue).toFixed(0)}%`
      : (isPositive ? "+" : "") + compValue.toFixed(0);

    return (
      <span className={color}>
        {arrow} {displayValue} vs {compLabel}
      </span>
    );
  };

  return (
    <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
        {label}
      </div>
      <div className="text-2xl font-semibold text-[var(--text-primary)] mb-1">
        {value}
      </div>
      {comparison !== undefined && (
        <div className="text-[11px]">
          {getComparisonDisplay()}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Run lint**

Run: `cd app && npm run lint`

Expected: No errors

**Step 3: Commit**

```bash
git add app/src/components/reports/SummaryCard.tsx
git commit -m "feat: add SummaryCard component for report metrics

- Shows label, value, and comparison to previous period
- Green/red arrows for positive/negative changes"
```

---

## Task 9: Create OverviewTab component

**Files:**
- Create: `app/src/components/reports/OverviewTab.tsx`

**Step 1: Create OverviewTab component**

Create `app/src/components/reports/OverviewTab.tsx`:

```typescript
"use client";

import { SummaryCard } from "./SummaryCard";
import { BarChart } from "./charts/BarChart";
import { DonutChart } from "./charts/DonutChart";
import { formatHours } from "@/lib/date-utils";

interface OverviewTabProps {
  data: {
    summary: {
      totalHours: number;
      totalRevenue: number | null;
      activeClients: number;
    };
    byEmployee: { id: string; name: string; totalHours: number }[];
    byClient: { id: string; name: string; totalHours: number }[];
  };
  comparison: {
    summary: {
      totalHours: number;
      totalRevenue: number | null;
      activeClients: number;
    };
  } | null;
  comparisonLabel: string;
  isAdmin: boolean;
  onEmployeeClick: (id: string) => void;
  onClientClick: (id: string) => void;
}

export function OverviewTab({
  data,
  comparison,
  comparisonLabel,
  isAdmin,
  onEmployeeClick,
  onClientClick,
}: OverviewTabProps) {
  const { summary, byEmployee, byClient } = data;

  const getPercentChange = (current: number, previous: number | null | undefined) => {
    if (previous === null || previous === undefined || previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  const hoursComparison = comparison
    ? {
        value: getPercentChange(summary.totalHours, comparison.summary.totalHours) ?? 0,
        label: comparisonLabel,
        type: "percentage" as const,
      }
    : null;

  const revenueComparison = comparison && summary.totalRevenue !== null
    ? {
        value: getPercentChange(summary.totalRevenue, comparison.summary.totalRevenue) ?? 0,
        label: comparisonLabel,
        type: "percentage" as const,
      }
    : null;

  const clientsComparison = comparison
    ? {
        value: summary.activeClients - comparison.summary.activeClients,
        label: comparisonLabel,
        type: "absolute" as const,
      }
    : null;

  const employeeChartData = byEmployee.map((e) => ({
    name: e.name,
    value: e.totalHours,
    id: e.id,
  }));

  const clientChartData = byClient.map((c) => ({
    name: c.name,
    value: c.totalHours,
    id: c.id,
  }));

  if (summary.totalHours === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded bg-[var(--bg-surface)] flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <p className="text-[var(--text-secondary)] text-[13px]">No time entries for this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          label="Total Hours"
          value={formatHours(summary.totalHours)}
          comparison={hoursComparison}
        />
        {isAdmin && (
          <SummaryCard
            label="Total Revenue"
            value={summary.totalRevenue !== null ? `€${summary.totalRevenue.toLocaleString()}` : "—"}
            comparison={revenueComparison}
          />
        )}
        <SummaryCard
          label="Active Clients"
          value={summary.activeClients.toString()}
          comparison={clientsComparison}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
            Hours by Employee
          </h3>
          <div className="h-64">
            <BarChart
              data={employeeChartData}
              onBarClick={onEmployeeClick}
              valueFormatter={formatHours}
              layout="vertical"
            />
          </div>
        </div>

        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
            Hours by Client
          </h3>
          <div className="h-64">
            <DonutChart
              data={clientChartData}
              onSliceClick={onClientClick}
              valueFormatter={formatHours}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Run lint**

Run: `cd app && npm run lint`

Expected: No errors

**Step 3: Commit**

```bash
git add app/src/components/reports/OverviewTab.tsx
git commit -m "feat: add OverviewTab component

- Summary cards with period comparison
- Hours by Employee bar chart
- Hours by Client donut chart
- Clickable charts for drill-down navigation"
```

---

## Task 10: Create ByEmployeeTab component

**Files:**
- Create: `app/src/components/reports/ByEmployeeTab.tsx`

**Step 1: Create ByEmployeeTab component**

Create `app/src/components/reports/ByEmployeeTab.tsx`:

```typescript
"use client";

import { useState } from "react";
import { BarChart } from "./charts/BarChart";
import { formatHours } from "@/lib/date-utils";

interface EmployeeStats {
  id: string;
  name: string;
  totalHours: number;
  clientCount: number;
  topClient: { name: string; hours: number } | null;
  clients: { id: string; name: string; hours: number }[];
  dailyHours: { date: string; hours: number }[];
}

interface Entry {
  id: string;
  date: string;
  hours: number;
  description: string;
  clientName: string;
  clientCode: string;
}

interface ByEmployeeTabProps {
  employees: EmployeeStats[];
  entries: Entry[];
  isAdmin: boolean;
  currentUserId: string;
  selectedEmployeeId: string | null;
  onSelectEmployee: (id: string | null) => void;
}

export function ByEmployeeTab({
  employees,
  entries,
  isAdmin,
  currentUserId,
  selectedEmployeeId,
  onSelectEmployee,
}: ByEmployeeTabProps) {
  // Non-admins always see their own data
  const visibleEmployees = isAdmin ? employees : employees.filter((e) => e.id === currentUserId);
  const selectedEmployee = selectedEmployeeId
    ? employees.find((e) => e.id === selectedEmployeeId)
    : null;

  const employeeEntries = selectedEmployeeId
    ? entries.filter((e) => {
        // Find entry's userId from employees data
        const emp = employees.find((emp) =>
          emp.clients.some(() => entries.some((entry) => entry.id === e.id))
        );
        return emp?.id === selectedEmployeeId;
      })
    : [];

  // For drill-down, filter entries by matching the employee
  const getEmployeeEntries = () => {
    if (!selectedEmployeeId) return [];
    // We need to match entries to employees - entries have userId in the full data
    // For now, return all entries if selected (the parent should filter)
    return entries;
  };

  if (visibleEmployees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[var(--text-secondary)] text-[13px]">No employee data for this period</p>
      </div>
    );
  }

  // Drill-down view
  if (selectedEmployee) {
    const clientChartData = selectedEmployee.clients.map((c) => ({
      name: c.name,
      value: c.hours,
      id: c.id,
    }));

    const dailyChartData = selectedEmployee.dailyHours.map((d) => ({
      name: new Date(d.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }),
      value: d.hours,
    }));

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => onSelectEmployee(null)}
            className="
              flex items-center gap-1 text-[13px] text-[var(--text-secondary)]
              hover:text-[var(--text-primary)] transition-colors
            "
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to All
          </button>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {selectedEmployee.name}
          </h2>
          <span className="text-[var(--text-muted)] text-[13px]">
            Total: {formatHours(selectedEmployee.totalHours)}
          </span>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
              Hours by Client
            </h3>
            <div className="h-48">
              <BarChart
                data={clientChartData}
                valueFormatter={formatHours}
                layout="vertical"
              />
            </div>
          </div>

          <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
              Hours by Day
            </h3>
            <div className="h-48">
              <BarChart
                data={dailyChartData}
                valueFormatter={formatHours}
              />
            </div>
          </div>
        </div>

        {/* Entries table would go here - simplified for now */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Date</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Client</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Hours</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody>
              {selectedEmployee.dailyHours.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)] text-[13px]">
                    No entries
                  </td>
                </tr>
              ) : (
                selectedEmployee.clients.flatMap((client) =>
                  entries
                    .filter((e) => e.clientName === client.name)
                    .slice(0, 10)
                    .map((entry) => (
                      <tr key={entry.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                        <td className="px-4 py-2.5 text-[13px] text-[var(--text-secondary)]">
                          {new Date(entry.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                        </td>
                        <td className="px-4 py-2.5 text-[13px] text-[var(--text-secondary)]">
                          {entry.clientName}
                        </td>
                        <td className="px-4 py-2.5 text-[13px] text-[var(--text-secondary)]">
                          {formatHours(entry.hours)}
                        </td>
                        <td className="px-4 py-2.5 text-[13px] text-[var(--text-secondary)] truncate max-w-xs">
                          {entry.description}
                        </td>
                      </tr>
                    ))
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Summary view
  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="text-[13px] text-[var(--text-muted)]">
          Click an employee to see details
        </div>
      )}

      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Employee</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Hours</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Clients</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Top Client</th>
            </tr>
          </thead>
          <tbody>
            {visibleEmployees.map((employee) => (
              <tr
                key={employee.id}
                onClick={() => onSelectEmployee(employee.id)}
                className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
              >
                <td className="px-4 py-2.5 text-[13px] font-medium text-[var(--text-primary)]">
                  {employee.name}
                </td>
                <td className="px-4 py-2.5 text-[13px] text-[var(--text-secondary)]">
                  {formatHours(employee.totalHours)}
                </td>
                <td className="px-4 py-2.5 text-[13px] text-[var(--text-secondary)]">
                  {employee.clientCount}
                </td>
                <td className="px-4 py-2.5 text-[13px] text-[var(--text-secondary)]">
                  {employee.topClient
                    ? `${employee.topClient.name} (${formatHours(employee.topClient.hours)})`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 2: Run lint**

Run: `cd app && npm run lint`

Expected: No errors

**Step 3: Commit**

```bash
git add app/src/components/reports/ByEmployeeTab.tsx
git commit -m "feat: add ByEmployeeTab component

- Summary table with employee stats
- Drill-down view with charts and entries
- Non-admins only see their own data"
```

---

## Task 11: Create ByClientTab component

**Files:**
- Create: `app/src/components/reports/ByClientTab.tsx`

**Step 1: Create ByClientTab component**

Create `app/src/components/reports/ByClientTab.tsx`:

```typescript
"use client";

import { BarChart } from "./charts/BarChart";
import { formatHours } from "@/lib/date-utils";

interface ClientStats {
  id: string;
  name: string;
  timesheetCode: string;
  hourlyRate: number | null;
  totalHours: number;
  revenue: number | null;
  employees: { id: string; name: string; hours: number }[];
}

interface Entry {
  id: string;
  date: string;
  hours: number;
  description: string;
  userName: string;
  clientId: string;
}

interface ByClientTabProps {
  clients: ClientStats[];
  entries: Entry[];
  isAdmin: boolean;
  selectedClientId: string | null;
  onSelectClient: (id: string | null) => void;
}

export function ByClientTab({
  clients,
  entries,
  isAdmin,
  selectedClientId,
  onSelectClient,
}: ByClientTabProps) {
  const selectedClient = selectedClientId
    ? clients.find((c) => c.id === selectedClientId)
    : null;

  const clientEntries = selectedClientId
    ? entries.filter((e) => e.clientId === selectedClientId)
    : [];

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-[var(--text-secondary)] text-[13px]">No client data for this period</p>
      </div>
    );
  }

  // Drill-down view
  if (selectedClient) {
    const employeeChartData = selectedClient.employees.map((e) => ({
      name: e.name,
      value: e.hours,
      id: e.id,
    }));

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => onSelectClient(null)}
            className="
              flex items-center gap-1 text-[13px] text-[var(--text-secondary)]
              hover:text-[var(--text-primary)] transition-colors
            "
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to All
          </button>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {selectedClient.name}
            </h2>
            <span className="text-[var(--text-muted)] text-[12px]">
              {selectedClient.timesheetCode}
            </span>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[var(--text-secondary)] text-[13px]">
              Total: {formatHours(selectedClient.totalHours)}
            </div>
            {isAdmin && selectedClient.revenue !== null && (
              <div className="text-[var(--text-muted)] text-[12px]">
                Revenue: €{selectedClient.revenue.toLocaleString()}
              </div>
            )}
          </div>
        </div>

        {/* Chart */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded p-4">
          <h3 className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-4">
            Hours by Employee
          </h3>
          <div className="h-48">
            <BarChart
              data={employeeChartData}
              valueFormatter={formatHours}
              layout="vertical"
            />
          </div>
        </div>

        {/* Entries table */}
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Date</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Employee</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Hours</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody>
              {clientEntries.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)] text-[13px]">
                    No entries
                  </td>
                </tr>
              ) : (
                clientEntries.slice(0, 20).map((entry) => (
                  <tr key={entry.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                    <td className="px-4 py-2.5 text-[13px] text-[var(--text-secondary)]">
                      {new Date(entry.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-[var(--text-secondary)]">
                      {entry.userName}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-[var(--text-secondary)]">
                      {formatHours(entry.hours)}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-[var(--text-secondary)] truncate max-w-xs">
                      {entry.description}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Summary view
  return (
    <div className="space-y-4">
      <div className="text-[13px] text-[var(--text-muted)]">
        Click a client to see details
      </div>

      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Client</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Code</th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Hours</th>
              {isAdmin && <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Revenue</th>}
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">Employees</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr
                key={client.id}
                onClick={() => onSelectClient(client.id)}
                className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
              >
                <td className="px-4 py-2.5 text-[13px] font-medium text-[var(--text-primary)]">
                  {client.name}
                </td>
                <td className="px-4 py-2.5 text-[13px] text-[var(--text-muted)]">
                  {client.timesheetCode}
                </td>
                <td className="px-4 py-2.5 text-[13px] text-[var(--text-secondary)]">
                  {formatHours(client.totalHours)}
                </td>
                {isAdmin && (
                  <td className="px-4 py-2.5 text-[13px] text-[var(--text-secondary)]">
                    {client.revenue !== null ? `€${client.revenue.toLocaleString()}` : "—"}
                  </td>
                )}
                <td className="px-4 py-2.5 text-[13px] text-[var(--text-secondary)]">
                  {client.employees.map((e) => e.name).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 2: Run lint**

Run: `cd app && npm run lint`

Expected: No errors

**Step 3: Commit**

```bash
git add app/src/components/reports/ByClientTab.tsx
git commit -m "feat: add ByClientTab component

- Summary table with client stats and revenue
- Drill-down view with employee chart and entries
- Revenue column hidden for non-admins"
```

---

## Task 12: Create ReportsContent component

**Files:**
- Create: `app/src/components/reports/ReportsContent.tsx`

**Step 1: Create ReportsContent component**

Create `app/src/components/reports/ReportsContent.tsx`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { DateRangePicker } from "./DateRangePicker";
import { ComparisonPicker, ComparisonType } from "./ComparisonPicker";
import { OverviewTab } from "./OverviewTab";
import { ByEmployeeTab } from "./ByEmployeeTab";
import { ByClientTab } from "./ByClientTab";
import {
  getMonthRange,
  formatDateISO,
  getPreviousPeriod,
  getPreviousYear,
  formatMonthShort,
} from "@/lib/date-utils";

type Tab = "overview" | "by-employee" | "by-client";

interface ReportData {
  summary: {
    totalHours: number;
    totalRevenue: number | null;
    activeClients: number;
  };
  byEmployee: {
    id: string;
    name: string;
    totalHours: number;
    clientCount: number;
    topClient: { name: string; hours: number } | null;
    clients: { id: string; name: string; hours: number }[];
    dailyHours: { date: string; hours: number }[];
  }[];
  byClient: {
    id: string;
    name: string;
    timesheetCode: string;
    hourlyRate: number | null;
    totalHours: number;
    revenue: number | null;
    employees: { id: string; name: string; hours: number }[];
  }[];
  entries: {
    id: string;
    date: string;
    hours: number;
    description: string;
    userId: string;
    userName: string;
    clientId: string;
    clientName: string;
    clientCode: string;
  }[];
}

interface ReportsContentProps {
  initialData: ReportData;
  initialComparisonData: ReportData | null;
  isAdmin: boolean;
  currentUserId: string;
}

export function ReportsContent({
  initialData,
  initialComparisonData,
  isAdmin,
  currentUserId,
}: ReportsContentProps) {
  const today = new Date();
  const initialRange = getMonthRange(today);

  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [comparisonType, setComparisonType] = useState<ComparisonType>("previous-period");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [data, setData] = useState<ReportData>(initialData);
  const [comparisonData, setComparisonData] = useState<ReportData | null>(initialComparisonData);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const fetchData = useCallback(async (start: Date, end: Date, compType: ComparisonType) => {
    setIsLoading(true);

    try {
      // Fetch main data
      const mainRes = await fetch(
        `/api/reports?startDate=${formatDateISO(start)}&endDate=${formatDateISO(end)}`
      );
      const mainData = await mainRes.json();

      if (!mainRes.ok) {
        console.error("Failed to fetch report data:", mainData.error);
        return;
      }

      setData(mainData);

      // Fetch comparison data
      const compRange = compType === "previous-period"
        ? getPreviousPeriod(start, end)
        : getPreviousYear(start, end);

      const compRes = await fetch(
        `/api/reports?startDate=${formatDateISO(compRange.start)}&endDate=${formatDateISO(compRange.end)}`
      );
      const compData = await compRes.json();

      if (compRes.ok) {
        setComparisonData(compData);
      } else {
        setComparisonData(null);
      }
    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDateChange = (start: Date, end: Date) => {
    setStartDate(start);
    setEndDate(end);
    setSelectedEmployeeId(null);
    setSelectedClientId(null);
    fetchData(start, end, comparisonType);
  };

  const handleComparisonChange = (type: ComparisonType) => {
    setComparisonType(type);
    fetchData(startDate, endDate, type);
  };

  const handleEmployeeClick = (id: string) => {
    setSelectedEmployeeId(id);
    setActiveTab("by-employee");
  };

  const handleClientClick = (id: string) => {
    setSelectedClientId(id);
    setActiveTab("by-client");
  };

  const getComparisonLabel = () => {
    const compRange = comparisonType === "previous-period"
      ? getPreviousPeriod(startDate, endDate)
      : getPreviousYear(startDate, endDate);
    return formatMonthShort(compRange.start);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "by-employee", label: "By Employee" },
    { id: "by-client", label: "By Client" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold text-[var(--text-primary)]">
          Reports
        </h1>
        <div className="flex items-center gap-3">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={handleDateChange}
          />
          <ComparisonPicker
            value={comparisonType}
            onChange={handleComparisonChange}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border-subtle)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === "overview") {
                setSelectedEmployeeId(null);
                setSelectedClientId(null);
              }
            }}
            className={`
              px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors
              ${activeTab === tab.id
                ? "border-[var(--accent-pink)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-[var(--text-muted)] text-[13px]">Loading...</div>
        </div>
      ) : (
        <>
          {activeTab === "overview" && (
            <OverviewTab
              data={data}
              comparison={comparisonData}
              comparisonLabel={getComparisonLabel()}
              isAdmin={isAdmin}
              onEmployeeClick={handleEmployeeClick}
              onClientClick={handleClientClick}
            />
          )}
          {activeTab === "by-employee" && (
            <ByEmployeeTab
              employees={data.byEmployee}
              entries={data.entries}
              isAdmin={isAdmin}
              currentUserId={currentUserId}
              selectedEmployeeId={selectedEmployeeId}
              onSelectEmployee={setSelectedEmployeeId}
            />
          )}
          {activeTab === "by-client" && (
            <ByClientTab
              clients={data.byClient}
              entries={data.entries}
              isAdmin={isAdmin}
              selectedClientId={selectedClientId}
              onSelectClient={setSelectedClientId}
            />
          )}
        </>
      )}
    </div>
  );
}
```

**Step 2: Run lint**

Run: `cd app && npm run lint`

Expected: No errors

**Step 3: Commit**

```bash
git add app/src/components/reports/ReportsContent.tsx
git commit -m "feat: add ReportsContent main component

- Manages tab state, date range, and comparison selection
- Fetches data on date/comparison change
- Coordinates drill-down navigation between tabs"
```

---

## Task 13: Update reports page

**Files:**
- Modify: `app/src/app/(authenticated)/reports/page.tsx`

**Step 1: Update the page to use new components**

Replace contents of `app/src/app/(authenticated)/reports/page.tsx`:

```typescript
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { ReportsContent } from "@/components/reports/ReportsContent";
import { getMonthRange, formatDateISO, getPreviousPeriod } from "@/lib/date-utils";

async function getReportData(startDate: Date, endDate: Date, userId: string, isAdmin: boolean) {
  const whereClause = {
    date: { gte: startDate, lte: endDate },
    ...(!isAdmin && { userId }),
  };

  const entries = await db.timeEntry.findMany({
    where: whereClause,
    select: {
      id: true,
      date: true,
      hours: true,
      description: true,
      userId: true,
      user: { select: { id: true, name: true } },
      clientId: true,
      client: { select: { id: true, name: true, timesheetCode: true, hourlyRate: true } },
    },
    orderBy: { date: "desc" },
  });

  // Aggregate data
  const employeeMap = new Map<string, {
    id: string;
    name: string;
    totalHours: number;
    clients: Map<string, { name: string; hours: number }>;
    dailyHours: Map<string, number>;
  }>();

  const clientMap = new Map<string, {
    id: string;
    name: string;
    timesheetCode: string;
    hourlyRate: number | null;
    totalHours: number;
    employees: Map<string, { name: string; hours: number }>;
  }>();

  let totalHours = 0;
  let totalRevenue = 0;
  const activeClientIds = new Set<string>();

  for (const entry of entries) {
    const hours = Number(entry.hours);
    totalHours += hours;
    activeClientIds.add(entry.clientId);

    const clientRate = entry.client.hourlyRate ? Number(entry.client.hourlyRate) : null;
    if (clientRate !== null) {
      totalRevenue += hours * clientRate;
    }

    // Employee aggregation
    const empId = entry.userId;
    if (!employeeMap.has(empId)) {
      employeeMap.set(empId, {
        id: empId,
        name: entry.user.name || "Unknown",
        totalHours: 0,
        clients: new Map(),
        dailyHours: new Map(),
      });
    }
    const emp = employeeMap.get(empId)!;
    emp.totalHours += hours;

    const dateStr = entry.date.toISOString().split("T")[0];
    emp.dailyHours.set(dateStr, (emp.dailyHours.get(dateStr) || 0) + hours);

    if (!emp.clients.has(entry.clientId)) {
      emp.clients.set(entry.clientId, { name: entry.client.name, hours: 0 });
    }
    emp.clients.get(entry.clientId)!.hours += hours;

    // Client aggregation
    const clientId = entry.clientId;
    if (!clientMap.has(clientId)) {
      clientMap.set(clientId, {
        id: clientId,
        name: entry.client.name,
        timesheetCode: entry.client.timesheetCode,
        hourlyRate: clientRate,
        totalHours: 0,
        employees: new Map(),
      });
    }
    const client = clientMap.get(clientId)!;
    client.totalHours += hours;

    if (!client.employees.has(empId)) {
      client.employees.set(empId, { name: entry.user.name || "Unknown", hours: 0 });
    }
    client.employees.get(empId)!.hours += hours;
  }

  // Build response
  const byEmployee = Array.from(employeeMap.values()).map((emp) => {
    const clients = Array.from(emp.clients.entries())
      .map(([id, data]) => ({ id, name: data.name, hours: data.hours }))
      .sort((a, b) => b.hours - a.hours);

    return {
      id: emp.id,
      name: emp.name,
      totalHours: emp.totalHours,
      clientCount: clients.length,
      topClient: clients[0] ? { name: clients[0].name, hours: clients[0].hours } : null,
      clients,
      dailyHours: Array.from(emp.dailyHours.entries())
        .map(([date, hours]) => ({ date, hours }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
  }).sort((a, b) => b.totalHours - a.totalHours);

  const byClient = Array.from(clientMap.values()).map((client) => {
    const employees = Array.from(client.employees.entries())
      .map(([id, data]) => ({ id, name: data.name, hours: data.hours }))
      .sort((a, b) => b.hours - a.hours);

    return {
      id: client.id,
      name: client.name,
      timesheetCode: client.timesheetCode,
      hourlyRate: isAdmin ? client.hourlyRate : null,
      totalHours: client.totalHours,
      revenue: isAdmin && client.hourlyRate !== null ? client.totalHours * client.hourlyRate : null,
      employees,
    };
  }).sort((a, b) => b.totalHours - a.totalHours);

  return {
    summary: {
      totalHours,
      totalRevenue: isAdmin ? totalRevenue : null,
      activeClients: activeClientIds.size,
    },
    byEmployee,
    byClient,
    entries: entries.map((e) => ({
      id: e.id,
      date: e.date.toISOString().split("T")[0],
      hours: Number(e.hours),
      description: e.description,
      userId: e.userId,
      userName: e.user.name || "Unknown",
      clientId: e.clientId,
      clientName: e.client.name,
      clientCode: e.client.timesheetCode,
    })),
  };
}

export default async function ReportsPage() {
  const user = await getCurrentUser();
  const isAdmin = user.role === "ADMIN";

  const today = new Date();
  const { start, end } = getMonthRange(today);
  const { start: compStart, end: compEnd } = getPreviousPeriod(start, end);

  const [data, comparisonData] = await Promise.all([
    getReportData(start, end, user.id, isAdmin),
    getReportData(compStart, compEnd, user.id, isAdmin),
  ]);

  return (
    <ReportsContent
      initialData={data}
      initialComparisonData={comparisonData}
      isAdmin={isAdmin}
      currentUserId={user.id}
    />
  );
}
```

**Step 2: Run lint**

Run: `cd app && npm run lint`

Expected: No errors

**Step 3: Run build to check for errors**

Run: `cd app && npm run build`

Expected: Build succeeds

**Step 4: Commit**

```bash
git add app/src/app/\(authenticated\)/reports/page.tsx
git commit -m "feat: update reports page with full implementation

- Server component fetches initial data for current month
- Passes data to ReportsContent client component
- Both admins and employees can access (with filtered data)"
```

---

## Task 14: Run tests and verify

**Step 1: Run all tests**

Run: `cd app && npm run test -- --run`

Expected: All tests pass

**Step 2: Run lint**

Run: `cd app && npm run lint`

Expected: No errors

**Step 3: Start dev server and manually verify**

Run: `cd app && npm run dev`

Then open http://localhost:3000/reports and verify:
- [ ] Page loads with Overview tab
- [ ] Summary cards show data (or empty state if no data)
- [ ] Charts render correctly
- [ ] By Employee tab shows employee list
- [ ] By Client tab shows client list
- [ ] Date range picker works
- [ ] Comparison picker works

**Step 4: Commit final state**

```bash
git add -A
git commit -m "chore: verify reports implementation complete"
```

---

## Summary

**Tasks completed:**
1. Schema migration (remove hourlyRate from User)
2. Date utility functions
3. Reports API route
4. Recharts installation
5. Chart components (BarChart, DonutChart)
6. DateRangePicker component
7. ComparisonPicker component
8. SummaryCard component
9. OverviewTab component
10. ByEmployeeTab component
11. ByClientTab component
12. ReportsContent component
13. Reports page update
14. Final verification

**Files created/modified:**
- `app/prisma/schema.prisma` (modified)
- `app/src/lib/date-utils.ts` (modified)
- `app/src/lib/date-utils.test.ts` (modified)
- `app/src/app/api/reports/route.ts` (created)
- `app/src/components/reports/charts/BarChart.tsx` (created)
- `app/src/components/reports/charts/DonutChart.tsx` (created)
- `app/src/components/reports/DateRangePicker.tsx` (created)
- `app/src/components/reports/ComparisonPicker.tsx` (created)
- `app/src/components/reports/SummaryCard.tsx` (created)
- `app/src/components/reports/OverviewTab.tsx` (created)
- `app/src/components/reports/ByEmployeeTab.tsx` (created)
- `app/src/components/reports/ByClientTab.tsx` (created)
- `app/src/components/reports/ReportsContent.tsx` (created)
- `app/src/app/(authenticated)/reports/page.tsx` (modified)
