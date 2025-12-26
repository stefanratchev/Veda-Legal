# Sidebar Section Groupings Design

## Overview

Reorganize the sidebar navigation from a flat list into logical sections with labels, following a client-centric mental model appropriate for legal practice.

## Current State

The sidebar displays 6 navigation items in a flat list:
- Clients (admin-only)
- Topics (admin-only)
- Team
- Timesheets
- Billing (admin-only)
- Reports (admin-only)

## Design

### Section Structure

Navigation items grouped into 4 sections with formal labels:

| Section Label | Items | Admin-Only |
|---------------|-------|------------|
| CLIENTS & MATTERS | Clients, Topics | Yes (entire section) |
| TIME RECORDING | Timesheets | No |
| FINANCIALS | Billing, Reports | Yes (entire section) |
| PRACTICE | Team | No |

### Visual Treatment

- **Label styling:** 10px uppercase, `text-[var(--text-muted)]`, letter-spacing 0.05em
- **Label positioning:** `px-3` (aligned with nav items), `pt-4 pb-2` spacing
- **First section:** `pt-0` since it follows directly after the logo
- **No divider lines:** Labels provide sufficient visual separation

### Role-Based Visibility

**Admin view (ADMIN, PARTNER):**
All 4 sections visible with all items.

**Employee view (ASSOCIATE, TRAINEE, etc.):**
Only "TIME RECORDING" and "PRACTICE" sections visible. Sections with only admin-only items are hidden entirely (no empty headers).

### Data Structure

```typescript
interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "CLIENTS & MATTERS",
    items: [
      { name: "Clients", href: "/clients", icon: Icons.clients, adminOnly: true },
      { name: "Topics", href: "/topics", icon: Icons.topics, adminOnly: true },
    ],
  },
  {
    label: "TIME RECORDING",
    items: [
      { name: "Timesheets", href: "/timesheets", icon: Icons.timesheets },
    ],
  },
  {
    label: "FINANCIALS",
    items: [
      { name: "Billing", href: "/billing", icon: Icons.billing, adminOnly: true },
      { name: "Reports", href: "/reports", icon: Icons.reports, adminOnly: true },
    ],
  },
  {
    label: "PRACTICE",
    items: [
      { name: "Team", href: "/team", icon: Icons.employees },
    ],
  },
];
```

### Rendering Logic

1. Map over `navSections`
2. For each section, filter items based on user role
3. Skip rendering section entirely if no visible items remain
4. Render section label followed by filtered items

## Files Changed

- `app/src/components/layout/Sidebar.tsx` — Restructure nav data and update rendering

## Out of Scope

- Collapsible sections
- Reordering items within sections
- Adding new navigation items
