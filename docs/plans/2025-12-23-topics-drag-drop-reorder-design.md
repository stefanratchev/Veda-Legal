# Topics Drag-and-Drop Reorder

**Date:** 2025-12-23
**Status:** Approved

## Summary

Replace the up/down arrow buttons in the Topics management UI with drag-and-drop reordering for both topics and subtopics.

## Decisions

| Decision | Choice |
|----------|--------|
| Scope | Both topics and subtopics |
| Persistence | Batch update via new reorder endpoints |
| Cross-section dragging | No — sections stay separate |
| Library | @dnd-kit/core |
| Visual feedback | Elevated card with shadow, items animate to make space |
| Drag initiation | Dedicated drag handle icon |
| Touch support | Desktop only |
| Keyboard support | Yes (via @dnd-kit) |

## Component Architecture

The existing `TopicsContent` component will be wrapped with @dnd-kit providers:

```
DndContext (handles drag events)
└── TopicsContent
    ├── SortableContext (for active topics)
    │   └── SortableTopicRow (for each active topic)
    │       └── SortableContext (for active subtopics)
    │           └── SortableSubtopicRow (for each)
    ├── SortableContext (for inactive topics)
    │   └── SortableTopicRow (for each inactive topic)
    │       └── ... (subtopics)
```

**New components:**
- `SortableTopicRow` — wraps existing `TopicRow`, adds drag handle and sortable behavior
- `SortableSubtopicRow` — wraps existing `SubtopicRow`, same treatment
- `DragHandle` — small reusable grip icon component

**Removed:**
- `ChevronUpIcon` and `ChevronDownIcon` components
- Move up/down button JSX from both row components
- `handleMoveTopicUp`, `handleMoveTopicDown`, `handleMoveSubtopicUp`, `handleMoveSubtopicDown` functions

## API Changes

### New Endpoints

```
PATCH /api/topics/reorder
Body: { items: [{ id: string, displayOrder: number }, ...] }

PATCH /api/subtopics/reorder
Body: { items: [{ id: string, displayOrder: number }, ...] }
```

Both endpoints:
- Require write access (`requireWriteAccess()`)
- Validate all IDs exist and belong to items with the same status
- Update all items in a single Prisma transaction
- Return the updated items

### Existing Endpoints

Unchanged. Create endpoints continue to assign `max(displayOrder) + 1` for new items.

## Drag Interaction

### Drag Handle
- 6-dot grip icon positioned at the left edge of each row
- `text-gray-500` color, brightens to `text-gray-300` on hover
- `cursor-grab` on hover, `cursor-grabbing` while dragging

### While Dragging
- Dragged item: elevated shadow, slight scale, higher z-index
- Other items: animate to make space (`transition-transform duration-200`)
- Drop indicator: gap appears where item will land

### On Drop
- Items settle with ease-out animation
- Optimistic UI update: list reorders immediately
- Background API call persists new order
- On failure: revert to previous order, show toast error

### Keyboard
- Tab to focus handle
- Space/Enter to pick up
- Arrow keys to move
- Space/Enter to drop, Escape to cancel

## Reorder Logic

On drag end:
1. Capture `active.id` (dragged) and `over.id` (target)
2. Find the item's section
3. Compute new order using `arrayMove`
4. Assign `displayOrder` values (0, 1, 2, ...)
5. Optimistically update local state
6. Call reorder API with changed items only

Subtopics are scoped to their parent topic — cannot drag between topics.

## Dependencies

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

~15KB gzipped total.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| API error | Revert order, show toast |
| Network timeout | Revert order, show toast |
| Drag cancelled | No change |
| Invalid drop zone | Item returns to original position |

## Edge Cases

- Empty sections: No drag handles
- Single item: Handle shown but non-functional or dimmed
- Concurrent edits: Last write wins (acceptable for admin feature)

## Files to Modify

- `app/src/components/topics/TopicsContent.tsx` — main changes
- `app/src/app/api/topics/reorder/route.ts` — new endpoint
- `app/src/app/api/subtopics/reorder/route.ts` — new endpoint
