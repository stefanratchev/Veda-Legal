# Line Item & Topic Drag-and-Drop for Service Descriptions

## Goal

Add drag-and-drop reordering to the service description editor:
- Reorder **topics** within a service description
- Reorder **line items** within a topic
- Move **line items between topics**

## API Layer

No schema changes needed — `displayOrder` exists on both `serviceDescriptionTopics` and `serviceDescriptionLineItems`.

### New Endpoints

**`PATCH /api/billing/[id]/topics/reorder`**
- Body: `{ items: [{ id: string, displayOrder: number }] }`
- Batch update topic display order in a single transaction
- Validates all topic IDs belong to the service description
- Rejects if service description is finalized

**`PATCH /api/billing/[id]/topics/[topicId]/items/reorder`**
- Body: `{ items: [{ id: string, topicId: string, displayOrder: number }] }`
- Batch update line item display order with cross-topic move support
- `topicId` on each item allows reassigning to a different topic
- Validates all referenced topics belong to the same service description
- Rejects if service description is finalized

## UI: Topic Reordering

**Component:** `ServiceDescriptionDetail.tsx`

- Wrap topic list with `DndContext` + `SortableContext` from @dnd-kit (already installed)
- Each `TopicSection` header gets a drag handle (grip icon) on its left side
- Sensors: `PointerSensor` (5px activation distance) + `KeyboardSensor`
- On drop: optimistic `arrayMove` update, then `PATCH /topics/reorder`
- On failure: revert to previous order, show error toast
- Visual: dragged topic at 0.5 opacity, placeholder gap at drop position
- Disabled when service description is finalized (no drag handles shown)

## UI: Line Item Reordering (Including Cross-Topic)

**Key architecture decision:** Single `DndContext` for all line items lives in `ServiceDescriptionDetail` (parent), not in individual `TopicSection` components. This enables cross-topic dragging.

### Drag Interaction

- Each `LineItemRow` gets a grip icon on the far left
- Row is draggable via `useSortable` hook
- `DragOverlay` renders floating copy of the row being dragged
- Original row shows reduced opacity while dragging

### Drop Zones

- **Within same topic:** Standard sortable — reorders at precise position
- **Onto expanded topic's item list:** Inserts at precise position between items
- **Onto topic header (collapsed or expanded):** Appends line item to end of that topic

Each topic header is a droppable zone via `useDroppable` hook.

### State Updates

1. Optimistically move item in local state between topic arrays
2. Call `PATCH /topics/[targetTopicId]/items/reorder` with affected items' new `topicId` + `displayOrder`
3. On failure: revert state, show error toast

### Constraints

- No pricing mode restrictions — items move freely between HOURLY and FIXED topics
- Finalized service descriptions disable all drag-and-drop

## Testing

- **API tests:** Reorder endpoints for topics and line items — ordering, transactions, finalized rejection, cross-topic validation
- **Unit tests:** `handleDragEnd` state transformation logic (extracted as pure function)
- **Manual testing:** Drag interactions — within topic, between topics, collapsed topic drops

## Files to Modify

1. `app/src/app/api/billing/[id]/topics/reorder/route.ts` — New endpoint
2. `app/src/app/api/billing/[id]/topics/[topicId]/items/reorder/route.ts` — New endpoint
3. `app/src/components/billing/ServiceDescriptionDetail.tsx` — DnD contexts, topic reorder, line item cross-topic logic
4. `app/src/components/billing/TopicSection.tsx` — SortableContext for line items, droppable header
5. `app/src/components/billing/LineItemRow.tsx` — Drag handle, useSortable hook
6. Plus test files for the new API endpoints and state logic
