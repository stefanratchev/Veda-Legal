# Service Description Drag-and-Drop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add drag-and-drop to the service description editor — reorder topics, reorder line items within topics, and move line items between topics.

**Architecture:** Single `DndContext` at `ServiceDescriptionDetail` level with prefixed IDs to differentiate topic drags from line item drags. Topics and each topic's line items each get their own `SortableContext`. Topic headers double as droppable zones (`useDroppable`) so line items can be dropped onto collapsed topics. Two new batch API endpoints persist reorder/move operations.

**Tech Stack:** @dnd-kit/core ^6.3.1, @dnd-kit/sortable ^10.0.0, @dnd-kit/utilities ^3.2.2 (already installed). Vitest for API tests.

---

### Task 1: Topic Reorder API — Tests

**Files:**
- Create: `app/src/app/api/billing/[id]/topics/reorder/route.test.ts`

**Step 1: Write the test file**

Follow the exact mocking pattern from `app/src/app/api/billing/[id]/topics/[topicId]/route.test.ts`:
- `vi.hoisted()` for `mockRequireAdmin` and `mockDb`
- `vi.mock("@/lib/db", ...)` and `vi.mock("@/lib/api-utils", ...)`
- Import `{ PATCH }` from `./route` AFTER mocks
- Test helper: `createMockRequest` from `@/test/helpers/api`
- Params shape: `{ params: Promise.resolve({ id: "sd-1" }) }`

`mockDb` needs a `transaction` method (not in the existing mock). Add: `transaction: vi.fn()`.

Test cases:
1. **Auth** — returns 401 when `mockRequireAdmin` returns error
2. **Finalized** — returns 400 when service description status is `"FINALIZED"`
3. **Invalid body** — returns 400 when `items` is not an array or is empty
4. **Invalid item** — returns 400 when an item has missing/invalid `id` or `displayOrder`
5. **Happy path** — returns `{ success: true }` and calls `db.transaction`
6. **DB error** — returns 500 when transaction throws

For the transaction mock in happy path:
```typescript
mockDb.transaction.mockImplementation(async (fn) => {
  await fn(mockDb); // pass mockDb as the tx object
});
mockDb.update.mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});
```

Also mock `mockDb.query.serviceDescriptions.findFirst` for draft status check.

**Step 2: Run tests — verify they fail**

Run: `cd app && npx vitest run src/app/api/billing/[id]/topics/reorder/route.test.ts`
Expected: FAIL — `./route` module not found

**Step 3: Commit**

```bash
git add app/src/app/api/billing/[id]/topics/reorder/route.test.ts
git commit -m "test: add topic reorder API tests"
```

---

### Task 2: Topic Reorder API — Implementation

**Files:**
- Create: `app/src/app/api/billing/[id]/topics/reorder/route.ts`

**Step 1: Implement the endpoint**

Follow the exact pattern from `app/src/app/api/topics/reorder/route.ts` (lines 1–58) with these adaptations:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { serviceDescriptions, serviceDescriptionTopics } from "@/lib/schema";
import { requireAdmin, errorResponse } from "@/lib/api-utils";

interface ReorderItem {
  id: string;
  displayOrder: number;
}

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { items } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse("Items array is required", 400);
  }

  for (const item of items) {
    if (typeof item.id !== "string" || item.id.length === 0) {
      return errorResponse("Each item must have a valid id", 400);
    }
    if (typeof item.displayOrder !== "number" || item.displayOrder < 0) {
      return errorResponse("Each item must have a valid displayOrder", 400);
    }
  }

  try {
    // Verify service description is draft
    const sd = await db.query.serviceDescriptions.findFirst({
      where: eq(serviceDescriptions.id, id),
      columns: { status: true },
    });

    if (!sd) {
      return errorResponse("Service description not found", 404);
    }

    if (sd.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      for (const item of items as ReorderItem[]) {
        await tx.update(serviceDescriptionTopics)
          .set({ displayOrder: item.displayOrder, updatedAt: now })
          .where(eq(serviceDescriptionTopics.id, item.id));
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error reordering topics:", error);
    return errorResponse("Failed to reorder topics", 500);
  }
}
```

**Step 2: Run tests — verify they pass**

Run: `cd app && npx vitest run src/app/api/billing/[id]/topics/reorder/route.test.ts`
Expected: all PASS

**Step 3: Commit**

```bash
git add app/src/app/api/billing/[id]/topics/reorder/route.ts
git commit -m "feat: add billing topic reorder API endpoint"
```

---

### Task 3: Line Item Reorder API — Tests

**Files:**
- Create: `app/src/app/api/billing/[id]/line-items/reorder/route.test.ts`

The line item reorder endpoint lives at `/api/billing/[id]/line-items/reorder` (NOT under a topicId) because items can move across topics.

**Step 1: Write the test file**

Same mocking pattern as Task 1. The `mockDb` also needs `transaction` and `update`.

Body shape: `{ items: [{ id: string, topicId: string, displayOrder: number }] }`

Test cases:
1. **Auth** — returns 401
2. **Finalized** — returns 400
3. **Invalid body** — returns 400 when `items` is missing, empty, or not an array
4. **Invalid item fields** — returns 400 when an item has missing `id`, `topicId`, or invalid `displayOrder`
5. **Happy path (within-topic)** — all items have same `topicId`, returns `{ success: true }`
6. **Happy path (cross-topic)** — items have different `topicId`s, returns `{ success: true }`, verifies transaction was called
7. **DB error** — returns 500

**Step 2: Run tests — verify they fail**

Run: `cd app && npx vitest run src/app/api/billing/[id]/line-items/reorder/route.test.ts`
Expected: FAIL — `./route` module not found

**Step 3: Commit**

```bash
git add app/src/app/api/billing/[id]/line-items/reorder/route.test.ts
git commit -m "test: add line item reorder API tests"
```

---

### Task 4: Line Item Reorder API — Implementation

**Files:**
- Create: `app/src/app/api/billing/[id]/line-items/reorder/route.ts`

**Step 1: Implement the endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { serviceDescriptions, serviceDescriptionLineItems } from "@/lib/schema";
import { requireAdmin, errorResponse } from "@/lib/api-utils";

interface ReorderItem {
  id: string;
  topicId: string;
  displayOrder: number;
}

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { items } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse("Items array is required", 400);
  }

  for (const item of items) {
    if (typeof item.id !== "string" || item.id.length === 0) {
      return errorResponse("Each item must have a valid id", 400);
    }
    if (typeof item.topicId !== "string" || item.topicId.length === 0) {
      return errorResponse("Each item must have a valid topicId", 400);
    }
    if (typeof item.displayOrder !== "number" || item.displayOrder < 0) {
      return errorResponse("Each item must have a valid displayOrder", 400);
    }
  }

  try {
    const sd = await db.query.serviceDescriptions.findFirst({
      where: eq(serviceDescriptions.id, id),
      columns: { status: true },
    });

    if (!sd) {
      return errorResponse("Service description not found", 404);
    }

    if (sd.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      for (const item of items as ReorderItem[]) {
        await tx.update(serviceDescriptionLineItems)
          .set({
            topicId: item.topicId,
            displayOrder: item.displayOrder,
            updatedAt: now,
          })
          .where(eq(serviceDescriptionLineItems.id, item.id));
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error reordering line items:", error);
    return errorResponse("Failed to reorder line items", 500);
  }
}
```

Key difference from topic reorder: also sets `topicId` on each item (enables cross-topic moves).

**Step 2: Run tests — verify they pass**

Run: `cd app && npx vitest run src/app/api/billing/[id]/line-items/reorder/route.test.ts`
Expected: all PASS

**Step 3: Run all billing tests to check for regressions**

Run: `cd app && npx vitest run --reporter=verbose src/app/api/billing/`
Expected: all PASS

**Step 4: Commit**

```bash
git add app/src/app/api/billing/[id]/line-items/reorder/route.ts
git commit -m "feat: add line item reorder API with cross-topic move support"
```

---

### Task 5: Topic Drag-and-Drop — ServiceDescriptionDetail

**Files:**
- Modify: `app/src/components/billing/ServiceDescriptionDetail.tsx`
- Modify: `app/src/components/billing/TopicSection.tsx`

This task adds topic-level drag-and-drop only. Line item DnD is added separately in Task 6–7.

**Step 1: Add DnD imports and sensors to ServiceDescriptionDetail.tsx**

Add at top of file:
```typescript
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
```

Add sensors inside the component (same config as `TopicsContent.tsx:55-62`):
```typescript
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  }),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);
```

**Step 2: Add topic drag state and handler**

```typescript
const [activeTopicId, setActiveTopicId] = useState<string | null>(null);

const handleTopicDragStart = useCallback((event: DragStartEvent) => {
  const id = String(event.active.id);
  if (id.startsWith("topic:")) {
    setActiveTopicId(id.replace("topic:", ""));
  }
}, []);

const handleTopicDragEnd = useCallback(async (event: DragEndEvent) => {
  setActiveTopicId(null);

  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const activeId = String(active.id);
  const overId = String(over.id);

  // Only handle topic drags here
  if (!activeId.startsWith("topic:") || !overId.startsWith("topic:")) return;

  const activeTopicId = activeId.replace("topic:", "");
  const overTopicId = overId.replace("topic:", "");

  const oldIndex = data.topics.findIndex((t) => t.id === activeTopicId);
  const newIndex = data.topics.findIndex((t) => t.id === overTopicId);

  if (oldIndex === -1 || newIndex === -1) return;

  const reordered = arrayMove(data.topics, oldIndex, newIndex);

  const updates: { id: string; displayOrder: number }[] = [];
  reordered.forEach((topic, index) => {
    if (topic.displayOrder !== index) {
      updates.push({ id: topic.id, displayOrder: index });
    }
  });

  if (updates.length === 0) return;

  // Optimistic update
  setData((prev) => ({
    ...prev,
    topics: reordered.map((t, i) => ({ ...t, displayOrder: i })),
  }));

  try {
    const response = await fetch(`/api/billing/${data.id}/topics/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: updates }),
    });

    if (!response.ok) {
      // Revert
      setData((prev) => ({
        ...prev,
        topics: data.topics,
      }));
    }
  } catch {
    setData((prev) => ({
      ...prev,
      topics: data.topics,
    }));
  }
}, [data]);
```

**Step 3: Wrap the topic list with DndContext + SortableContext**

In the JSX, replace the `{/* Topic Sections */}` block (lines 511–540):

```tsx
{/* Topic Sections */}
<div className="space-y-4">
  <DndContext
    sensors={sensors}
    collisionDetection={closestCenter}
    onDragStart={handleTopicDragStart}
    onDragEnd={handleTopicDragEnd}
  >
    <SortableContext
      items={data.topics.map((t) => `topic:${t.id}`)}
      strategy={verticalListSortingStrategy}
    >
      {data.topics.map((topic) => (
        <TopicSection
          key={topic.id}
          topic={topic}
          sortableId={`topic:${topic.id}`}
          serviceDescriptionId={data.id}
          isEditable={isEditable}
          clientHourlyRate={data.client.hourlyRate}
          onUpdateTopic={handleUpdateTopic}
          onDeleteTopic={handleDeleteTopic}
          onAddLineItem={handleAddLineItem}
          onUpdateLineItem={handleUpdateLineItem}
          onDeleteLineItem={handleDeleteLineItem}
        />
      ))}
    </SortableContext>

    <DragOverlay>
      {activeTopicId ? (
        <div className="bg-[var(--bg-elevated)] rounded-lg border border-[var(--accent-pink)] p-4 opacity-90 shadow-lg">
          <span className="font-heading text-base font-semibold text-[var(--text-primary)]">
            {data.topics.find((t) => t.id === activeTopicId)?.topicName}
          </span>
        </div>
      ) : null}
    </DragOverlay>
  </DndContext>

  {/* Add Topic Button */}
  {isEditable && (
    <button ...>Add Topic</button>
  )}
</div>
```

**Step 4: Make TopicSection sortable**

In `TopicSection.tsx`, add the `sortableId` prop and `useSortable` hook:

```typescript
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

Add to props interface:
```typescript
sortableId?: string;
```

Inside the component, add:
```typescript
const {
  attributes,
  listeners,
  setNodeRef,
  transform,
  transition,
  isDragging,
} = useSortable({ id: sortableId || topic.id, disabled: !isEditable });

const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  zIndex: isDragging ? 10 : undefined,
  opacity: isDragging ? 0.5 : undefined,
};
```

Wrap the outermost `<div>` with ref and style:
```tsx
<div ref={setNodeRef} style={style} className="bg-[var(--bg-elevated)] ...">
```

Add a drag handle to the header (before the chevron icon), visible only when `isEditable`:
```tsx
{isEditable && (
  <button
    {...attributes}
    {...listeners}
    className="p-1 -ml-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-grab active:cursor-grabbing touch-none"
    onClick={(e) => e.stopPropagation()}
  >
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="9" cy="5" r="1.5" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
    </svg>
  </button>
)}
```

The drag handle SVG icon is identical to `DragHandleIcon` in `app/src/components/topics/TopicsContent.tsx:1059-1074`.

**Step 5: Manual test**

1. Run `cd app && npm run dev`
2. Navigate to a draft service description with 2+ topics
3. Verify drag handle appears on each topic header (left of chevron)
4. Drag a topic and verify it reorders
5. Verify drag handles do NOT appear on finalized service descriptions

**Step 6: Commit**

```bash
git add app/src/components/billing/ServiceDescriptionDetail.tsx app/src/components/billing/TopicSection.tsx
git commit -m "feat: add drag-and-drop topic reordering in service descriptions"
```

---

### Task 6: Line Item DnD — Within Topic

**Files:**
- Modify: `app/src/components/billing/ServiceDescriptionDetail.tsx`
- Modify: `app/src/components/billing/TopicSection.tsx`
- Modify: `app/src/components/billing/LineItemRow.tsx`

This task adds within-topic line item reordering. Cross-topic moves come in Task 7.

**Step 1: Refactor to a single DndContext for both topics and items**

Replace the DndContext from Task 5 to also handle line item drags. In `ServiceDescriptionDetail.tsx`, update the drag handlers to differentiate by ID prefix:

- Topic IDs: `topic:${topicId}`
- Line item IDs: `item:${itemId}`

Update `handleDragStart`:
```typescript
const [activeDragType, setActiveDragType] = useState<"topic" | "item" | null>(null);
const [activeItemId, setActiveItemId] = useState<string | null>(null);

const handleDragStart = useCallback((event: DragStartEvent) => {
  const id = String(event.active.id);
  if (id.startsWith("topic:")) {
    setActiveDragType("topic");
    setActiveTopicId(id.replace("topic:", ""));
  } else if (id.startsWith("item:")) {
    setActiveDragType("item");
    setActiveItemId(id.replace("item:", ""));
  }
}, []);
```

Update `handleDragEnd` to dispatch based on `activeDragType`:
```typescript
const handleDragEnd = useCallback(async (event: DragEndEvent) => {
  const dragType = activeDragType;
  setActiveDragType(null);
  setActiveTopicId(null);
  setActiveItemId(null);

  if (dragType === "topic") {
    await handleTopicDragEnd(event);
  } else if (dragType === "item") {
    await handleLineItemDragEnd(event);
  }
}, [activeDragType, handleTopicDragEnd, handleLineItemDragEnd]);
```

Extract `handleTopicDragEnd` from the existing handler (remove state resets — they're now in the parent).

Add `handleLineItemDragEnd` (within-topic only for now):
```typescript
const handleLineItemDragEnd = useCallback(async (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const activeId = String(active.id).replace("item:", "");
  const overId = String(over.id).replace("item:", "");

  // Find which topics contain these items
  const sourceTopic = data.topics.find((t) =>
    t.lineItems.some((item) => item.id === activeId)
  );
  const targetTopic = data.topics.find((t) =>
    t.lineItems.some((item) => item.id === overId)
  );

  if (!sourceTopic || !targetTopic) return;

  // Within same topic — reorder
  if (sourceTopic.id === targetTopic.id) {
    const items = [...sourceTopic.lineItems];
    const oldIndex = items.findIndex((item) => item.id === activeId);
    const newIndex = items.findIndex((item) => item.id === overId);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);

    const updates = reordered.map((item, index) => ({
      id: item.id,
      topicId: sourceTopic.id,
      displayOrder: index,
    }));

    // Optimistic update
    const previousTopics = data.topics;
    setData((prev) => ({
      ...prev,
      topics: prev.topics.map((t) =>
        t.id === sourceTopic.id
          ? { ...t, lineItems: reordered.map((item, i) => ({ ...item, displayOrder: i })) }
          : t
      ),
    }));

    try {
      const response = await fetch(`/api/billing/${data.id}/line-items/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: updates }),
      });

      if (!response.ok) {
        setData((prev) => ({ ...prev, topics: previousTopics }));
      }
    } catch {
      setData((prev) => ({ ...prev, topics: previousTopics }));
    }
  }
  // Cross-topic handling added in Task 7
}, [data]);
```

**Step 2: Pass SortableContext items for each topic's line items**

In `TopicSection.tsx`, wrap the table body with a `SortableContext`:

```typescript
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
```

Replace the `<tbody>` block (around line 457):
```tsx
<SortableContext
  items={topic.lineItems.map((item) => `item:${item.id}`)}
  strategy={verticalListSortingStrategy}
>
  <tbody>
    {topic.lineItems.map((item, index) => (
      <LineItemRow
        key={item.id}
        item={item}
        sortableId={`item:${item.id}`}
        isEditable={isEditable}
        isEvenRow={index % 2 === 0}
        onUpdate={handleUpdateItem}
        onDelete={handleDeleteItem}
      />
    ))}
  </tbody>
</SortableContext>
```

**Step 3: Make LineItemRow sortable**

In `LineItemRow.tsx`:

```typescript
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

Add `sortableId` to props:
```typescript
interface LineItemRowProps {
  item: ServiceDescriptionLineItem;
  sortableId?: string;
  isEditable: boolean;
  isEvenRow: boolean;
  onUpdate: (itemId: string, updates: { description?: string; hours?: number }) => Promise<void>;
  onDelete: (itemId: string) => void;
}
```

Inside the component:
```typescript
const {
  attributes,
  listeners,
  setNodeRef,
  transform,
  transition,
  isDragging,
} = useSortable({ id: sortableId || item.id, disabled: !isEditable });

const style = {
  transform: CSS.Transform.toString(transform),
  transition,
  opacity: isDragging ? 0.5 : undefined,
};
```

Update the `<tr>` element:
```tsx
<tr ref={setNodeRef} style={style} className={...}>
```

Add a drag handle column BEFORE the Date column. Also add a corresponding `<th>` in `TopicSection.tsx` thead:

In `TopicSection.tsx` thead, add before Date th:
```tsx
{isEditable && <th className="px-2 py-2.5 w-8"></th>}
```

In `LineItemRow.tsx`, add before the Date td:
```tsx
{isEditable && (
  <td className="px-2 py-3 w-8">
    <button
      {...attributes}
      {...listeners}
      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-grab active:cursor-grabbing touch-none"
    >
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="9" cy="5" r="1.5" />
        <circle cx="15" cy="5" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="19" r="1.5" />
        <circle cx="15" cy="19" r="1.5" />
      </svg>
    </button>
  </td>
)}
```

Also update the `<tfoot>` colSpan in `TopicSection.tsx` to account for the new column when editable:
```tsx
<td colSpan={isEditable ? 6 : 4}>
```

**Step 4: Add DragOverlay for line items**

In `ServiceDescriptionDetail.tsx`, update the DragOverlay to also handle line items:

```tsx
<DragOverlay>
  {activeTopicId ? (
    <div className="bg-[var(--bg-elevated)] rounded-lg border border-[var(--accent-pink)] p-4 opacity-90 shadow-lg">
      <span className="font-heading text-base font-semibold text-[var(--text-primary)]">
        {data.topics.find((t) => t.id === activeTopicId)?.topicName}
      </span>
    </div>
  ) : activeItemId ? (() => {
    const item = data.topics.flatMap((t) => t.lineItems).find((i) => i.id === activeItemId);
    if (!item) return null;
    return (
      <div className="bg-[var(--bg-elevated)] border border-[var(--accent-pink)] rounded px-4 py-2 shadow-lg opacity-90">
        <span className="text-sm text-[var(--text-primary)]">{item.description}</span>
        {item.hours && (
          <span className="text-sm text-[var(--text-muted)] ml-2">
            {Math.floor(item.hours)}h {Math.round((item.hours - Math.floor(item.hours)) * 60)}m
          </span>
        )}
      </div>
    );
  })() : null}
</DragOverlay>
```

**Step 5: Manual test**

1. Run `cd app && npm run dev`
2. Navigate to a draft service description with a topic that has 3+ line items
3. Verify drag handle appears on each row (leftmost column)
4. Drag a line item within the same topic — verify it reorders
5. Verify dragged item shows an overlay preview

**Step 6: Commit**

```bash
git add app/src/components/billing/ServiceDescriptionDetail.tsx app/src/components/billing/TopicSection.tsx app/src/components/billing/LineItemRow.tsx
git commit -m "feat: add within-topic line item drag-and-drop reordering"
```

---

### Task 7: Line Item DnD — Cross-Topic Moves

**Files:**
- Modify: `app/src/components/billing/ServiceDescriptionDetail.tsx`
- Modify: `app/src/components/billing/TopicSection.tsx`

**Step 1: Add topic header droppable zones**

In `TopicSection.tsx`, make the topic header a droppable zone for line items using `useDroppable`:

```typescript
import { useDroppable } from "@dnd-kit/core";
```

Inside the component:
```typescript
const { setNodeRef: setDroppableRef, isOver: isDropTarget } = useDroppable({
  id: `topic-drop:${topic.id}`,
  disabled: !isEditable,
});
```

Apply `setDroppableRef` to the header div and add visual feedback:
```tsx
<div
  ref={setDroppableRef}
  className={`flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--bg-surface)] transition-colors ${
    isDropTarget ? "bg-[var(--accent-pink-glow)] ring-1 ring-[var(--accent-pink)]" : ""
  }`}
  onClick={handleToggle}
>
```

Note: the `setDroppableRef` goes on the header div, while `setNodeRef` (from `useSortable` for topic reordering) goes on the outer wrapper div. These are different refs on different elements.

**Step 2: Update collision detection**

In `ServiceDescriptionDetail.tsx`, change collision detection to handle both sortable items and droppable zones. Import `pointerWithin` or use `closestCenter`:

For cross-container drops, `closestCenter` may not find the topic header droppable. Use `rectIntersection` instead, or a custom strategy.

Simplest approach — use `closestCenter` and handle the case where `over` is a topic-drop zone:

The collision detection stays as `closestCenter`. The `over` target can be:
- A `topic:*` ID (topic sortable)
- An `item:*` ID (line item sortable)
- A `topic-drop:*` ID (topic header droppable zone)

**Step 3: Extend handleLineItemDragEnd for cross-topic**

Update the handler to handle when `over` is a `topic-drop:*` zone or an item in a different topic:

```typescript
const handleLineItemDragEnd = useCallback(async (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over) return;

  const activeId = String(active.id).replace("item:", "");
  const overId = String(over.id);

  // Find source topic
  const sourceTopic = data.topics.find((t) =>
    t.lineItems.some((item) => item.id === activeId)
  );
  if (!sourceTopic) return;

  let targetTopicId: string;
  let insertIndex: number | null = null;

  if (overId.startsWith("topic-drop:")) {
    // Dropped on a topic header — append to that topic
    targetTopicId = overId.replace("topic-drop:", "");
  } else if (overId.startsWith("item:")) {
    // Dropped on a line item — find which topic it's in
    const overItemId = overId.replace("item:", "");
    const targetTopic = data.topics.find((t) =>
      t.lineItems.some((item) => item.id === overItemId)
    );
    if (!targetTopic) return;
    targetTopicId = targetTopic.id;
    insertIndex = targetTopic.lineItems.findIndex((item) => item.id === overItemId);
  } else {
    return; // Unknown target
  }

  if (active.id === over.id) return;

  const previousTopics = data.topics;

  if (sourceTopic.id === targetTopicId) {
    // Within same topic — reorder
    if (insertIndex === null) return; // dropped on own topic header, no-op
    const items = [...sourceTopic.lineItems];
    const oldIndex = items.findIndex((item) => item.id === activeId);
    if (oldIndex === -1 || insertIndex === -1 || oldIndex === insertIndex) return;

    const reordered = arrayMove(items, oldIndex, insertIndex);
    const updates = reordered.map((item, i) => ({
      id: item.id,
      topicId: sourceTopic.id,
      displayOrder: i,
    }));

    setData((prev) => ({
      ...prev,
      topics: prev.topics.map((t) =>
        t.id === sourceTopic.id
          ? { ...t, lineItems: reordered.map((item, i) => ({ ...item, displayOrder: i })) }
          : t
      ),
    }));

    try {
      const response = await fetch(`/api/billing/${data.id}/line-items/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: updates }),
      });
      if (!response.ok) setData((prev) => ({ ...prev, topics: previousTopics }));
    } catch {
      setData((prev) => ({ ...prev, topics: previousTopics }));
    }
  } else {
    // Cross-topic move
    const movedItem = sourceTopic.lineItems.find((item) => item.id === activeId);
    if (!movedItem) return;

    const targetTopic = data.topics.find((t) => t.id === targetTopicId);
    if (!targetTopic) return;

    // Remove from source
    const newSourceItems = sourceTopic.lineItems.filter((item) => item.id !== activeId);

    // Insert into target
    const newTargetItems = [...targetTopic.lineItems];
    if (insertIndex !== null) {
      newTargetItems.splice(insertIndex, 0, movedItem);
    } else {
      newTargetItems.push(movedItem); // Append at end (dropped on header)
    }

    // Build update payload — all items from both affected topics
    const updates: { id: string; topicId: string; displayOrder: number }[] = [];
    newSourceItems.forEach((item, i) => {
      updates.push({ id: item.id, topicId: sourceTopic.id, displayOrder: i });
    });
    newTargetItems.forEach((item, i) => {
      updates.push({ id: item.id, topicId: targetTopicId, displayOrder: i });
    });

    // Optimistic update
    setData((prev) => ({
      ...prev,
      topics: prev.topics.map((t) => {
        if (t.id === sourceTopic.id) {
          return { ...t, lineItems: newSourceItems.map((item, i) => ({ ...item, displayOrder: i })) };
        }
        if (t.id === targetTopicId) {
          return { ...t, lineItems: newTargetItems.map((item, i) => ({ ...item, displayOrder: i })) };
        }
        return t;
      }),
    }));

    try {
      const response = await fetch(`/api/billing/${data.id}/line-items/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: updates }),
      });
      if (!response.ok) setData((prev) => ({ ...prev, topics: previousTopics }));
    } catch {
      setData((prev) => ({ ...prev, topics: previousTopics }));
    }
  }
}, [data]);
```

**Step 4: Manual test — cross-topic**

1. Run `cd app && npm run dev`
2. Navigate to a draft service description with 2+ topics, each with line items
3. **Expanded target:** Drag a line item from topic A and drop it between items in topic B — verify it appears at that position
4. **Collapsed target:** Collapse topic B, drag item from topic A onto topic B's header — verify the header highlights, item appends to B (expand to check)
5. **Same topic header:** Drop item on its own topic header — verify nothing changes (no-op)
6. Check source topic's items are renumbered correctly
7. Refresh the page — verify order persisted to the database

**Step 5: Commit**

```bash
git add app/src/components/billing/ServiceDescriptionDetail.tsx app/src/components/billing/TopicSection.tsx
git commit -m "feat: add cross-topic line item drag-and-drop"
```

---

### Task 8: Final Polish and Edge Cases

**Files:**
- Modify: `app/src/components/billing/ServiceDescriptionDetail.tsx`
- Modify: `app/src/components/billing/TopicSection.tsx`

**Step 1: Handle empty topic drop targets**

When a topic has 0 line items and is expanded, there are no sortable items to drop onto. Add a droppable empty state.

In `TopicSection.tsx`, when there are no line items and `isEditable`, wrap the empty state with a droppable ref:

```tsx
{topic.lineItems.length === 0 && isEditable ? (
  <div ref={setEmptyDropRef} className={`p-6 ${isEmptyDropTarget ? "bg-[var(--accent-pink-glow)]" : ""}`}>
    <button onClick={handleOpenAddItem} ...>
      Add Line Item
    </button>
  </div>
) : ...}
```

Add a second `useDroppable` for empty state:
```typescript
const { setNodeRef: setEmptyDropRef, isOver: isEmptyDropTarget } = useDroppable({
  id: `topic-empty:${topic.id}`,
  disabled: !isEditable || topic.lineItems.length > 0,
});
```

In `ServiceDescriptionDetail.tsx`, handle `topic-empty:*` the same as `topic-drop:*` in `handleLineItemDragEnd` — append to the topic.

**Step 2: Prevent topic drag during item drag and vice versa**

The single DndContext handles this naturally — only one item can be dragged at a time. But verify that dragging by the topic handle doesn't accidentally trigger a line item sortable (they're nested). The `activationConstraint: { distance: 5 }` on PointerSensor helps prevent accidental drags.

**Step 3: Run all existing billing tests**

Run: `cd app && npx vitest run --reporter=verbose src/app/api/billing/`
Expected: all PASS (new endpoints + existing tests)

**Step 4: Full manual regression test**

1. Create a new service description — verify topics populate correctly
2. Add a manual line item — verify it appears
3. Reorder topics — verify order persists after refresh
4. Reorder line items within topic — verify order persists after refresh
5. Move line item to different topic — verify it moves and order persists
6. Move line item to empty topic (via header drop) — verify it appears
7. Finalize service description — verify no drag handles appear
8. Unlock — verify drag handles reappear
9. Export PDF — verify order matches the drag-and-drop arrangement

**Step 5: Commit**

```bash
git add app/src/components/billing/ServiceDescriptionDetail.tsx app/src/components/billing/TopicSection.tsx
git commit -m "feat: handle empty topic drops and finalize DnD polish"
```

---

## Key Files Reference

| File | Role |
|------|------|
| `app/src/components/billing/ServiceDescriptionDetail.tsx` | Parent component — hosts DndContext, topic + item drag handlers, optimistic state |
| `app/src/components/billing/TopicSection.tsx` | Sortable topic wrapper, droppable header zone, SortableContext for its line items |
| `app/src/components/billing/LineItemRow.tsx` | Sortable row with drag handle |
| `app/src/app/api/billing/[id]/topics/reorder/route.ts` | Batch topic reorder endpoint |
| `app/src/app/api/billing/[id]/line-items/reorder/route.ts` | Batch line item reorder + cross-topic move endpoint |
| `app/src/components/topics/TopicsContent.tsx` | Reference @dnd-kit implementation (copy patterns) |
| `app/src/app/api/topics/reorder/route.ts` | Reference reorder API (copy patterns) |

## Verification

After all tasks:
1. `cd app && npx vitest run --reporter=verbose src/app/api/billing/` — all tests pass
2. Manual test all drag interactions listed in Task 8 Step 4
3. Verify no regressions: `cd app && npx vitest run --run` — full test suite passes
