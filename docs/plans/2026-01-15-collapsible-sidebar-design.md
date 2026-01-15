# Collapsible Sidebar Design

## Overview

Make the sidebar collapsible via a draggable resize handle. Users can drag the right edge to resize, with snap behavior to either expanded (220px) or collapsed (56px icons-only) states. The preference persists in localStorage.

## States & Dimensions

| State | Width | What's visible |
|-------|-------|----------------|
| Expanded | 220px | Full logo (octopus + text), section labels, icons + text, full user profile |
| Collapsed | 56px | Octopus icon only (~32px), nav icons only, user avatar only |

**Snap threshold:** < 140px snaps to collapsed, otherwise snaps to expanded.

**Persistence:** Store `sidebarCollapsed: boolean` in localStorage. Default to expanded if no preference.

## Resize Handle Interaction

**Handle element:**
- Invisible div positioned on sidebar's right edge
- 8px wide hit area, full height of sidebar
- Positioned absolutely, overlapping the border

**Visual feedback:**
- Default: invisible (only existing border shows)
- On hover: `cursor: col-resize` + faint vertical highlight (`bg-white/10`)
- While dragging: highlight stays visible

**Drag behavior:**
1. `onMouseDown`: capture starting position, add document-level listeners
2. While dragging: update `dragWidth` state, sidebar follows cursor in real-time
3. `onMouseUp`: snap to collapsed or expanded based on threshold, save to localStorage

**Edge cases:**
- Clamp drag to reasonable min/max bounds
- Mobile (`< lg`): resize handle hidden, existing slide-in behavior unchanged

**Animation:**
- `transition: width 200ms ease` applied only after drag ends (not during)

## Collapsed State UI Changes

### Header
- Expanded: Full logo (180px wide)
- Collapsed: Octopus icon only (~32px), centered

### Section labels
- Expanded: Visible
- Collapsed: Hidden

### Nav items
- Expanded: Icon + text, left-aligned
- Collapsed: Icon only, centered
- Pink left-border active indicator remains (shorter)
- Tooltips on hover showing nav item name (right-aligned)

### User profile footer
- Expanded: Avatar + name + position + chevron
- Collapsed: Avatar only, centered
- Sign-out dropdown still works (appears to the right)
- Version indicator: hidden when collapsed

### Mobile close button
- Unchanged (only visible on mobile)

## Implementation

### New files
- `app/public/logo-icon.svg` - Octopus extracted from logo.svg

### Modified files
- `app/src/components/layout/Sidebar.tsx` - All collapse logic

### State management
```tsx
const [isCollapsed, setIsCollapsed] = useState(() => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('sidebarCollapsed') === 'true';
});
const [isDragging, setIsDragging] = useState(false);
const [dragWidth, setDragWidth] = useState<number | null>(null);
```

### CSS approach
- Expanded: `w-[220px]`
- Collapsed: `w-[56px]`
- Transition: `transition-[width] duration-200` (disabled during drag)
