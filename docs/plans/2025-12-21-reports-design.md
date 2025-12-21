# Reports Section Design

## Overview

Build a comprehensive reports section for admins to view business overview with work done by clients and employees within a selectable date range.

## Page Structure & Access

**URL**: `/reports` (existing route, currently placeholder)

**Access Control**:
- **Admins**: Full access - all tabs, all metrics including revenue
- **Employees**: Limited view - only see their own data, hours/clients only (no revenue figures)

**Layout**:
```
┌─────────────────────────────────────────────────────────────────┐
│  Reports          [This Month ▾]  vs  [Previous Period ▾]      │
├─────────────────────────────────────────────────────────────────┤
│  [ Overview ]  [ By Employee ]  [ By Client ]                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  (Tab content here)                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Date Range Presets**:
- This Month (default)
- Last Month
- Custom Range (date picker)

**Comparison Options**:
- Previous Period (default)
- Previous Year

| Selection | "Previous Period" | "Previous Year" |
|-----------|-------------------|-----------------|
| This Month (Dec 2025) | Nov 2025 | Dec 2024 |
| Last Month (Nov 2025) | Oct 2025 | Nov 2024 |
| Custom: Dec 1-15 | Nov 16-30 (same length) | Dec 1-15, 2024 |

## Overview Tab

**Summary Cards** (top row):
```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Total Hours      │  │ Total Revenue    │  │ Active Clients   │
│    142.5         │  │   €12,450        │  │       18         │
│   ↑ 12% vs last  │  │   ↑ 8% vs last   │  │   +3 vs last     │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

- Revenue card hidden for non-admin users
- Comparison label shown: "vs Nov 2025" or "vs Dec 2024"
- Green arrow (↑) for increase, red arrow (↓) for decrease
- Grey dash (—) if no prior data exists

**Charts**:

| Left Side | Right Side |
|-----------|------------|
| **Hours by Employee** (horizontal bar chart) | **Hours by Client** (donut chart, top 5 + "Other") |
| Shows each employee's contribution | Shows proportion of work across clients |

**Behavior**:
- Charts are clickable - clicking an employee bar switches to "By Employee" tab filtered to that person
- Clicking a client slice switches to "By Client" tab filtered to that client
- If no data in range, show empty state: "No time entries for this period"

## By Employee Tab

**Employee Selector** (for admins):
```
┌─────────────────────────────────────────────────────────┐
│  [All Employees ▾]  or click an employee to drill down  │
└─────────────────────────────────────────────────────────┘
```
- Non-admins don't see selector - they only see their own data

**Summary View (All Employees)**:

| Employee | Hours | Clients | Top Client |
|----------|-------|---------|------------|
| Jane Smith | 48.5 | 6 | Acme Corp (22h) |
| John Doe | 38.0 | 4 | Beta Ltd (15h) |

**Drill-Down View (Single Employee)**:
```
┌─────────────────────────────────────────────────────────┐
│  ← Back to All    Jane Smith    Total: 48.5 hours       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Hours by Client - bar chart]  [Hours by Day - bar]    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Time Entries Table                                     │
│  Date       | Client    | Hours | Description           │
│  Dec 18     | Acme Corp | 2.5   | Contract review...    │
│  Dec 17     | Beta Ltd  | 3.0   | Meeting re: merger    │
└─────────────────────────────────────────────────────────┘
```

**Daily Pattern Chart**: Horizontal bar showing hours logged per day of the selected period.

## By Client Tab

**Client Selector**:
```
┌─────────────────────────────────────────────────────────┐
│  [All Clients ▾]  or click a client to drill down      │
└─────────────────────────────────────────────────────────┘
```

**Summary View (All Clients)**:

| Client | Code | Hours | Revenue* | Employees |
|--------|------|-------|----------|-----------|
| Acme Corp | ACM001 | 45.0 | €4,500 | Jane, John |
| Beta Ltd | BET001 | 28.5 | €2,850 | Jane |
| Gamma Inc | GAM001 | 15.0 | — | John |

*Revenue column shows "—" if client has no hourly rate set. Hidden for non-admins.

**Drill-Down View (Single Client)**:
```
┌─────────────────────────────────────────────────────────┐
│  ← Back to All    Acme Corp (ACM001)                    │
│  Total: 45.0 hours    Revenue: €4,500                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Hours by Employee - bar chart]                        │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Time Entries Table                                     │
│  Date       | Employee  | Hours | Description           │
│  Dec 18     | Jane      | 2.5   | Contract review...    │
│  Dec 17     | John      | 3.0   | Due diligence call    │
└─────────────────────────────────────────────────────────┘
```

## Technical Approach

**Components to Create**:
```
app/src/
├── app/(authenticated)/reports/
│   └── page.tsx              # Server component, fetches data
├── components/reports/
│   ├── ReportsContent.tsx    # Client component, manages tabs/state
│   ├── DateRangePicker.tsx   # Month presets + custom range
│   ├── ComparisonPicker.tsx  # Previous period / previous year
│   ├── OverviewTab.tsx       # Summary cards + charts
│   ├── ByEmployeeTab.tsx     # Employee list + drill-down
│   ├── ByClientTab.tsx       # Client list + drill-down
│   └── charts/
│       ├── BarChart.tsx      # Reusable horizontal bar chart
│       └── DonutChart.tsx    # Reusable donut chart
```

**Data Fetching**:
- New API route: `GET /api/reports?startDate=...&endDate=...`
- Single query that aggregates TimeEntry data, grouped by employee and client
- Server component fetches initial data (current month)
- Client-side refetch when date range changes

**Chart Library**: Recharts - lightweight, React-native, works well with Tailwind.

**Schema Change**:
- Remove `hourlyRate` from User model
- Run migration before implementing

## Out of Scope

- Export to PDF/Excel
- Practice area grouping
- Email reports / scheduled reports
