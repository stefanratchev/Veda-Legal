# Mobile Responsive Design

## Overview

Make the Veda Legal Timesheets application work well on mobile devices (phones and tablets) while preserving the existing desktop experience exactly as-is.

## Target Devices

- **Phones**: 320px - 767px
- **Tablets**: 768px - 1023px
- **Desktop**: 1024px+ (unchanged)

## Primary Use Cases

1. Quick time entry - lawyers logging hours on-the-go
2. Reviewing/checking data - looking up logged hours, client info
3. Occasional emergency access - functional but not optimized

## Design Decisions

### Breakpoint Strategy

| Breakpoint | Tailwind | Behavior |
|------------|----------|----------|
| Mobile | default | Stacked layouts, hamburger nav |
| Tablet | `md:` (768px) | Hybrid layouts where appropriate |
| Desktop | `lg:` (1024px) | Current design, unchanged |

**Implementation approach**: Add responsive classes that default to mobile, use `lg:` prefix to preserve current desktop styles. Desktop viewport (1024px+) renders identically to current.

### Sidebar Navigation

| Screen | Behavior |
|--------|----------|
| Desktop (1024px+) | Fixed 240px, always visible (current) |
| Tablet & Mobile (<1024px) | Hidden off-screen, hamburger menu in header |

- Hamburger icon appears in header (left side) on mobile/tablet
- Sidebar slides in as overlay from left
- Backdrop dims content; tap outside or nav item to close
- Remove `ml-[240px]` offset below 1024px

### Header Modifications (Mobile/Tablet)

- Add hamburger icon (left side) to toggle sidebar
- Search box: hide on phones, keep on tablets (or icon that expands)
- User controls (notifications, help) remain but may compact

### Content Area Padding

| Screen | Padding |
|--------|---------|
| Desktop | `px-6` (current) |
| Tablet | `px-4` |
| Phone | `px-3` |

## Timesheets Page

### WeekStrip (Date Navigation)

On mobile/tablet (<1024px):
- Container becomes horizontally scrollable (`overflow-x-auto`)
- Each day maintains minimum 44px touch target
- Today scrolled into view initially
- Week navigation arrows remain at edges
- Calendar popup unchanged (280px width works)

### Entry Form

Desktop (current): Horizontal row `[Client] [Topic] [Duration] [Description] [Save]`

Mobile (<768px): Vertical stack

```
┌─────────────────────────┐
│ Client (full width)     │
├─────────────────────────┤
│ Topic (full width)      │
├─────────────────────────┤
│ Duration    │  [Save]   │
├─────────────────────────┤
│ Description (full width)│
└─────────────────────────┘
```

- All dropdowns full-width for easy tapping
- Duration and Save share a row
- Minimum 44px input height for touch targets
- Tablet may use hybrid two-column or match mobile for consistency

### Entries List

Desktop: Table with columns (Client | Topic | Hours | Description | Actions)

Mobile/Tablet: Card layout

```
┌─────────────────────────────┐
│ Client Name          2.5h  │
│ Topic > Subtopic           │
│ Description text here...   │
│                     [Edit] │
└─────────────────────────────┘
```

- Hours prominently displayed top-right
- Edit button always visible (no hover dependency)
- Cards stack vertically with gap

## Other Pages

### Data Tables (Clients, Employees, Topics)

- Transform to card layout on mobile (same pattern as entries)
- Action buttons visible on cards, not hidden in hover menus
- Search/filter controls stack vertically if needed

### Reports Page

- Charts resize responsively (Recharts handles this)
- Tab navigation: horizontal scroll if many tabs
- Date pickers stack vertically on mobile
- Existing `md:grid-cols-2` patterns already work

### Modals

- Phones: nearly full-screen (`mx-2`) for more input space
- Form fields inside modals follow stacked pattern
- Modal headers stay sticky for close access

## Touch Considerations

- All interactive elements: minimum 44x44px touch target
- Dropdowns: increased padding on mobile
- Buttons: comfortable spacing between touch targets
- Hover states: all actions have visible non-hover alternatives

## Out of Scope

- Login page (already simple, works fine)
- Color scheme, typography, design tokens
- Core functionality changes
- Pixel-perfect mobile design (goal is "decently well")

## Components to Modify

### Priority 1: Layout
- `Sidebar.tsx` - hamburger logic, overlay mode
- `Header.tsx` - hamburger button, responsive controls
- `(authenticated)/layout.tsx` - remove fixed offset on mobile

### Priority 2: Timesheets
- `WeekStrip.tsx` - scrollable container
- `EntryForm.tsx` - stacked layout
- `EntriesList.tsx` - card variant

### Priority 3: Shared
- `DataTable.tsx` - card variant for mobile
- Various modals - tighter margins, stacked fields

## New Components

- Hamburger toggle (likely part of Header)
- No other new components needed

## Testing Approach

- Chrome DevTools responsive mode for iteration
- Real device testing for touch/scroll behavior
- Key test widths: 375px (iPhone), 768px (iPad portrait), 1024px (iPad landscape)
- Desktop regression: verify 1024px and 1440px unchanged

## Success Criteria

1. No horizontal overflow or broken layouts on any screen size
2. All content readable, all controls tappable
3. Time entry workflow works smoothly on phone
4. Viewing logged hours easy to scan on mobile
5. Desktop experience byte-for-byte identical at 1024px+
