# Topics Drag-and-Drop Reorder Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace up/down arrow buttons with drag-and-drop reordering for topics and subtopics.

**Architecture:** Use @dnd-kit library with DndContext wrapping the topics panel. Each sortable section (active topics, inactive topics, active subtopics per topic, inactive subtopics) gets its own SortableContext. Drag handles initiate drag, items animate to make space, and batch API calls persist the new order.

**Tech Stack:** @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities

---

## Task 1: Install Dependencies

**Files:**
- Modify: `app/package.json`

**Step 1: Install @dnd-kit packages**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/topics-drag-drop-reorder/app && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**Step 2: Verify installation**

Run:
```bash
grep -A1 "@dnd-kit" package.json
```

Expected: Shows @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities in dependencies.

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @dnd-kit for drag-and-drop reordering"
```

---

## Task 2: Create Topics Reorder API Endpoint

**Files:**
- Create: `app/src/app/api/topics/reorder/route.ts`

**Step 1: Create the reorder endpoint**

Create file `app/src/app/api/topics/reorder/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWriteAccess, errorResponse } from "@/lib/api-utils";

interface ReorderItem {
  id: string;
  displayOrder: number;
}

// PATCH /api/topics/reorder - Batch update topic display orders
export async function PATCH(request: NextRequest) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

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

  // Validate each item
  for (const item of items) {
    if (typeof item.id !== "string" || item.id.length === 0) {
      return errorResponse("Each item must have a valid id", 400);
    }
    if (typeof item.displayOrder !== "number" || item.displayOrder < 0) {
      return errorResponse("Each item must have a valid displayOrder", 400);
    }
  }

  try {
    // Update all topics in a transaction
    await db.$transaction(
      items.map((item: ReorderItem) =>
        db.topic.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error reordering topics:", error);
    return errorResponse("Failed to reorder topics", 500);
  }
}
```

**Step 2: Verify endpoint compiles**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/topics-drag-drop-reorder/app && npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/api/topics/reorder/route.ts
git commit -m "feat(api): add PATCH /api/topics/reorder endpoint"
```

---

## Task 3: Create Subtopics Reorder API Endpoint

**Files:**
- Create: `app/src/app/api/subtopics/reorder/route.ts`

**Step 1: Create the reorder endpoint**

Create file `app/src/app/api/subtopics/reorder/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWriteAccess, errorResponse } from "@/lib/api-utils";

interface ReorderItem {
  id: string;
  displayOrder: number;
}

// PATCH /api/subtopics/reorder - Batch update subtopic display orders
export async function PATCH(request: NextRequest) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

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

  // Validate each item
  for (const item of items) {
    if (typeof item.id !== "string" || item.id.length === 0) {
      return errorResponse("Each item must have a valid id", 400);
    }
    if (typeof item.displayOrder !== "number" || item.displayOrder < 0) {
      return errorResponse("Each item must have a valid displayOrder", 400);
    }
  }

  try {
    // Update all subtopics in a transaction
    await db.$transaction(
      items.map((item: ReorderItem) =>
        db.subtopic.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error reordering subtopics:", error);
    return errorResponse("Failed to reorder subtopics", 500);
  }
}
```

**Step 2: Verify endpoint compiles**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/topics-drag-drop-reorder/app && npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/app/api/subtopics/reorder/route.ts
git commit -m "feat(api): add PATCH /api/subtopics/reorder endpoint"
```

---

## Task 4: Add DragHandle Component and DndContext to TopicsContent

**Files:**
- Modify: `app/src/components/topics/TopicsContent.tsx`

**Step 1: Add imports and DragHandle component**

At the top of the file, add the @dnd-kit imports after the existing imports:

```typescript
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

Add a DragHandle icon component after the other icon components (at the bottom of the file, before the closing):

```typescript
function DragHandleIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <circle cx="9" cy="5" r="1.5" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
    </svg>
  );
}
```

**Step 2: Verify file still compiles**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/topics-drag-drop-reorder/app && npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/topics/TopicsContent.tsx
git commit -m "feat(topics): add dnd-kit imports and DragHandle icon"
```

---

## Task 5: Replace Topic Reorder Logic with Drag-and-Drop

**Files:**
- Modify: `app/src/components/topics/TopicsContent.tsx`

**Step 1: Remove old move functions and add new drag handlers**

In `TopicsContent` function, remove the `moveTopicInDirection` function (lines ~303-367) and replace with:

```typescript
  // Handle topic drag end
  const handleTopicDragEnd = useCallback(
    async (event: DragEndEvent, status: "ACTIVE" | "INACTIVE") => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const itemsInSection = topics
        .filter((t) => t.status === status)
        .sort((a, b) => a.displayOrder - b.displayOrder);

      const oldIndex = itemsInSection.findIndex((t) => t.id === active.id);
      const newIndex = itemsInSection.findIndex((t) => t.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(itemsInSection, oldIndex, newIndex);

      // Calculate which items changed
      const updates: { id: string; displayOrder: number }[] = [];
      reordered.forEach((item, index) => {
        if (item.displayOrder !== index) {
          updates.push({ id: item.id, displayOrder: index });
        }
      });

      if (updates.length === 0) return;

      // Optimistic update
      setTopics((prev) =>
        prev.map((t) => {
          const update = updates.find((u) => u.id === t.id);
          return update ? { ...t, displayOrder: update.displayOrder } : t;
        })
      );

      try {
        const response = await fetch("/api/topics/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: updates }),
        });

        if (!response.ok) {
          // Revert on failure
          setTopics((prev) =>
            prev.map((t) => {
              const original = itemsInSection.find((o) => o.id === t.id);
              return original ? { ...t, displayOrder: original.displayOrder } : t;
            })
          );
          setError("Failed to reorder topics");
        }
      } catch {
        // Revert on failure
        setTopics((prev) =>
          prev.map((t) => {
            const original = itemsInSection.find((o) => o.id === t.id);
            return original ? { ...t, displayOrder: original.displayOrder } : t;
          })
        );
        setError("Failed to reorder topics");
      }
    },
    [topics]
  );
```

**Step 2: Add sensors configuration**

Inside `TopicsContent` function, add after the existing state declarations:

```typescript
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
```

**Step 3: Commit**

```bash
git add src/components/topics/TopicsContent.tsx
git commit -m "feat(topics): add topic drag-end handler and sensors"
```

---

## Task 6: Create SortableTopicRow Component

**Files:**
- Modify: `app/src/components/topics/TopicsContent.tsx`

**Step 1: Create SortableTopicRow wrapper component**

Add this new component after the `TopicRow` component definition (~line 772):

```typescript
// Sortable wrapper for TopicRow
interface SortableTopicRowProps extends Omit<TopicRowProps, "onMoveUp" | "onMoveDown" | "isFirst" | "isLast"> {
  id: string;
  disabled?: boolean;
}

function SortableTopicRow({ id, disabled, ...props }: SortableTopicRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? "relative" as const : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TopicRowWithHandle
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
        disabled={disabled}
      />
    </div>
  );
}
```

**Step 2: Create TopicRowWithHandle component**

Replace the existing `TopicRow` component with a version that accepts drag handle props:

```typescript
// Topic row component with drag handle
interface TopicRowWithHandleProps {
  topic: Topic;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
  isInactive?: boolean;
  disabled?: boolean;
}

function TopicRowWithHandle({
  topic,
  isSelected,
  onSelect,
  onEdit,
  onToggleStatus,
  onDelete,
  dragHandleProps,
  isDragging,
  isInactive,
  disabled,
}: TopicRowWithHandleProps) {
  return (
    <div
      onClick={onSelect}
      className={`
        p-3 flex items-center justify-between cursor-pointer transition-colors
        ${isSelected ? "bg-[var(--accent-pink-glow)] border-l-2 border-l-[var(--accent-pink)]" : "hover:bg-[var(--bg-hover)]"}
        ${isInactive ? "opacity-60" : ""}
        ${isDragging ? "shadow-lg bg-[var(--bg-elevated)] rounded" : ""}
      `}
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          {...dragHandleProps}
          className={`p-1 -ml-1 transition-colors touch-none ${
            disabled
              ? "text-[var(--text-muted)] opacity-30 cursor-not-allowed"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-grab active:cursor-grabbing"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <DragHandleIcon />
        </button>
        <span
          className={`font-medium text-sm truncate ${isInactive ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}`}
        >
          {topic.name}
        </span>
        <span className="text-[var(--text-muted)] text-xs shrink-0">
          ({topic.subtopics.length})
        </span>
      </div>
      <div
        className="flex items-center gap-1 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onEdit}
          className="p-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          title="Edit"
        >
          <EditIcon />
        </button>
        <button
          onClick={onToggleStatus}
          className={`p-1.5 text-xs transition-colors ${
            isInactive
              ? "text-[var(--success)] hover:text-[var(--success)]"
              : "text-[var(--text-muted)] hover:text-[var(--warning)]"
          }`}
          title={isInactive ? "Reactivate" : "Deactivate"}
        >
          {isInactive ? <ActivateIcon /> : <DeactivateIcon />}
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
          title="Delete"
        >
          <DeleteIcon />
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Delete old TopicRow component and TopicRowProps interface**

Remove the old `TopicRow` component and its interface (the version with onMoveUp/onMoveDown props).

**Step 4: Verify file compiles**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/topics-drag-drop-reorder/app && npx tsc --noEmit
```

Expected: Errors about TopicRow usage - we'll fix in next task.

**Step 5: Commit**

```bash
git add src/components/topics/TopicsContent.tsx
git commit -m "feat(topics): add SortableTopicRow and TopicRowWithHandle components"
```

---

## Task 7: Update Topic Lists to Use SortableContext

**Files:**
- Modify: `app/src/components/topics/TopicsContent.tsx`

**Step 1: Wrap active topics in DndContext and SortableContext**

In the JSX where active topics are rendered (~line 524), replace:

```typescript
{activeTopics.map((topic, index) => (
  <TopicRow
    key={topic.id}
    topic={topic}
    isSelected={topic.id === effectiveSelectedTopicId}
    onSelect={() => setSelectedTopicId(topic.id)}
    onEdit={() => openEditTopic(topic)}
    onToggleStatus={() => toggleTopicStatus(topic)}
    onDelete={() => deleteTopic(topic)}
    onMoveUp={() => moveTopicInDirection(topic, "up")}
    onMoveDown={() => moveTopicInDirection(topic, "down")}
    isFirst={index === 0}
    isLast={index === activeTopics.length - 1}
  />
))}
```

With:

```typescript
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={(event) => handleTopicDragEnd(event, "ACTIVE")}
>
  <SortableContext
    items={activeTopics.map((t) => t.id)}
    strategy={verticalListSortingStrategy}
  >
    {activeTopics.map((topic) => (
      <SortableTopicRow
        key={topic.id}
        id={topic.id}
        topic={topic}
        isSelected={topic.id === effectiveSelectedTopicId}
        onSelect={() => setSelectedTopicId(topic.id)}
        onEdit={() => openEditTopic(topic)}
        onToggleStatus={() => toggleTopicStatus(topic)}
        onDelete={() => deleteTopic(topic)}
        disabled={activeTopics.length <= 1}
      />
    ))}
  </SortableContext>
</DndContext>
```

**Step 2: Wrap inactive topics in DndContext and SortableContext**

Similarly, replace the inactive topics mapping (~line 546) with:

```typescript
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={(event) => handleTopicDragEnd(event, "INACTIVE")}
>
  <SortableContext
    items={inactiveTopics.map((t) => t.id)}
    strategy={verticalListSortingStrategy}
  >
    {inactiveTopics.map((topic) => (
      <SortableTopicRow
        key={topic.id}
        id={topic.id}
        topic={topic}
        isSelected={topic.id === effectiveSelectedTopicId}
        onSelect={() => setSelectedTopicId(topic.id)}
        onEdit={() => openEditTopic(topic)}
        onToggleStatus={() => toggleTopicStatus(topic)}
        onDelete={() => deleteTopic(topic)}
        isInactive
        disabled={inactiveTopics.length <= 1}
      />
    ))}
  </SortableContext>
</DndContext>
```

**Step 3: Verify file compiles**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/topics-drag-drop-reorder/app && npx tsc --noEmit
```

Expected: No errors related to topic rows. May still have subtopic errors.

**Step 4: Commit**

```bash
git add src/components/topics/TopicsContent.tsx
git commit -m "feat(topics): wrap topic lists with DndContext and SortableContext"
```

---

## Task 8: Replace Subtopic Reorder Logic with Drag-and-Drop

**Files:**
- Modify: `app/src/components/topics/TopicsContent.tsx`

**Step 1: Remove old moveSubtopicInDirection and add new handler**

Remove the `moveSubtopicInDirection` function (~lines 370-457) and replace with:

```typescript
  // Handle subtopic drag end
  const handleSubtopicDragEnd = useCallback(
    async (event: DragEndEvent, status: "ACTIVE" | "INACTIVE") => {
      const { active, over } = event;
      if (!over || active.id === over.id || !selectedTopic) return;

      const itemsInSection = selectedTopic.subtopics
        .filter((s) => s.status === status)
        .sort((a, b) => a.displayOrder - b.displayOrder);

      const oldIndex = itemsInSection.findIndex((s) => s.id === active.id);
      const newIndex = itemsInSection.findIndex((s) => s.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(itemsInSection, oldIndex, newIndex);

      // Calculate which items changed
      const updates: { id: string; displayOrder: number }[] = [];
      reordered.forEach((item, index) => {
        if (item.displayOrder !== index) {
          updates.push({ id: item.id, displayOrder: index });
        }
      });

      if (updates.length === 0) return;

      // Optimistic update
      setTopics((prev) =>
        prev.map((t) =>
          t.id === effectiveSelectedTopicId
            ? {
                ...t,
                subtopics: t.subtopics.map((s) => {
                  const update = updates.find((u) => u.id === s.id);
                  return update ? { ...s, displayOrder: update.displayOrder } : s;
                }),
              }
            : t
        )
      );

      try {
        const response = await fetch("/api/subtopics/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: updates }),
        });

        if (!response.ok) {
          // Revert on failure
          setTopics((prev) =>
            prev.map((t) =>
              t.id === effectiveSelectedTopicId
                ? {
                    ...t,
                    subtopics: t.subtopics.map((s) => {
                      const original = itemsInSection.find((o) => o.id === s.id);
                      return original ? { ...s, displayOrder: original.displayOrder } : s;
                    }),
                  }
                : t
            )
          );
          setError("Failed to reorder subtopics");
        }
      } catch {
        // Revert on failure
        setTopics((prev) =>
          prev.map((t) =>
            t.id === effectiveSelectedTopicId
              ? {
                  ...t,
                  subtopics: t.subtopics.map((s) => {
                    const original = itemsInSection.find((o) => o.id === s.id);
                    return original ? { ...s, displayOrder: original.displayOrder } : s;
                  }),
                }
              : t
          )
        );
        setError("Failed to reorder subtopics");
      }
    },
    [selectedTopic, effectiveSelectedTopicId]
  );
```

**Step 2: Commit**

```bash
git add src/components/topics/TopicsContent.tsx
git commit -m "feat(topics): add subtopic drag-end handler"
```

---

## Task 9: Create SortableSubtopicRow Component

**Files:**
- Modify: `app/src/components/topics/TopicsContent.tsx`

**Step 1: Create SortableSubtopicRow wrapper component**

Add after the `SubtopicRow` component definition:

```typescript
// Sortable wrapper for SubtopicRow
interface SortableSubtopicRowProps extends Omit<SubtopicRowWithHandleProps, "dragHandleProps" | "isDragging"> {
  id: string;
  disabled?: boolean;
}

function SortableSubtopicRow({ id, disabled, ...props }: SortableSubtopicRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? "relative" as const : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SubtopicRowWithHandle
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
        disabled={disabled}
      />
    </div>
  );
}
```

**Step 2: Create SubtopicRowWithHandle component**

Replace the existing `SubtopicRow` component with:

```typescript
// Subtopic row component with drag handle
interface SubtopicRowWithHandleProps {
  subtopic: Subtopic;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
  isInactive?: boolean;
  disabled?: boolean;
}

function SubtopicRowWithHandle({
  subtopic,
  onEdit,
  onToggleStatus,
  onDelete,
  dragHandleProps,
  isDragging,
  isInactive,
  disabled,
}: SubtopicRowWithHandleProps) {
  return (
    <div
      className={`
        p-3 flex items-center justify-between transition-colors hover:bg-[var(--bg-hover)]
        ${isInactive ? "opacity-60" : ""}
        ${isDragging ? "shadow-lg bg-[var(--bg-elevated)] rounded" : ""}
      `}
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          {...dragHandleProps}
          className={`p-1 -ml-1 transition-colors touch-none ${
            disabled
              ? "text-[var(--text-muted)] opacity-30 cursor-not-allowed"
              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-grab active:cursor-grabbing"
          }`}
        >
          <DragHandleIcon />
        </button>
        <span
          className={`text-sm truncate ${isInactive ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}`}
        >
          {subtopic.name}
        </span>
        {subtopic.isPrefix && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[var(--info-bg)] text-[var(--info)] rounded">
            prefix
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          title="Edit"
        >
          <EditIcon />
        </button>
        <button
          onClick={onToggleStatus}
          className={`p-1.5 text-xs transition-colors ${
            isInactive
              ? "text-[var(--success)] hover:text-[var(--success)]"
              : "text-[var(--text-muted)] hover:text-[var(--warning)]"
          }`}
          title={isInactive ? "Reactivate" : "Deactivate"}
        >
          {isInactive ? <ActivateIcon /> : <DeactivateIcon />}
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
          title="Delete"
        >
          <DeleteIcon />
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Delete old SubtopicRow and SubtopicRowProps**

Remove the old `SubtopicRow` component and its interface.

**Step 4: Commit**

```bash
git add src/components/topics/TopicsContent.tsx
git commit -m "feat(topics): add SortableSubtopicRow and SubtopicRowWithHandle components"
```

---

## Task 10: Update Subtopic Lists to Use SortableContext

**Files:**
- Modify: `app/src/components/topics/TopicsContent.tsx`

**Step 1: Wrap active subtopics in DndContext and SortableContext**

Replace the active subtopics mapping (~line 608) with:

```typescript
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={(event) => handleSubtopicDragEnd(event, "ACTIVE")}
>
  <SortableContext
    items={activeSubtopics.map((s) => s.id)}
    strategy={verticalListSortingStrategy}
  >
    {activeSubtopics.map((subtopic) => (
      <SortableSubtopicRow
        key={subtopic.id}
        id={subtopic.id}
        subtopic={subtopic}
        onEdit={() => openEditSubtopic(subtopic)}
        onToggleStatus={() => toggleSubtopicStatus(subtopic)}
        onDelete={() => deleteSubtopic(subtopic)}
        disabled={activeSubtopics.length <= 1}
      />
    ))}
  </SortableContext>
</DndContext>
```

**Step 2: Wrap inactive subtopics in DndContext and SortableContext**

Replace the inactive subtopics mapping (~line 630) with:

```typescript
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={(event) => handleSubtopicDragEnd(event, "INACTIVE")}
>
  <SortableContext
    items={inactiveSubtopics.map((s) => s.id)}
    strategy={verticalListSortingStrategy}
  >
    {inactiveSubtopics.map((subtopic) => (
      <SortableSubtopicRow
        key={subtopic.id}
        id={subtopic.id}
        subtopic={subtopic}
        onEdit={() => openEditSubtopic(subtopic)}
        onToggleStatus={() => toggleSubtopicStatus(subtopic)}
        onDelete={() => deleteSubtopic(subtopic)}
        isInactive
        disabled={inactiveSubtopics.length <= 1}
      />
    ))}
  </SortableContext>
</DndContext>
```

**Step 3: Verify file compiles**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/topics-drag-drop-reorder/app && npx tsc --noEmit
```

Expected: No errors.

**Step 4: Commit**

```bash
git add src/components/topics/TopicsContent.tsx
git commit -m "feat(topics): wrap subtopic lists with DndContext and SortableContext"
```

---

## Task 11: Remove Unused Code

**Files:**
- Modify: `app/src/components/topics/TopicsContent.tsx`

**Step 1: Remove ChevronUpIcon and ChevronDownIcon**

Delete the `ChevronUpIcon` and `ChevronDownIcon` function components (~lines 873-907).

**Step 2: Verify file compiles**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/topics-drag-drop-reorder/app && npx tsc --noEmit
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/topics/TopicsContent.tsx
git commit -m "refactor(topics): remove unused ChevronUp/Down icons"
```

---

## Task 12: Run Lint and Fix Issues

**Files:**
- Modify: `app/src/components/topics/TopicsContent.tsx` (if lint errors)

**Step 1: Run lint**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/topics-drag-drop-reorder/app && npm run lint
```

**Step 2: Fix any lint errors**

Address any lint errors that appear.

**Step 3: Commit if fixes were needed**

```bash
git add -A
git commit -m "fix: address lint issues"
```

---

## Task 13: Run Build to Verify Everything Works

**Step 1: Run production build**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/topics-drag-drop-reorder/app && npm run build
```

Expected: Build completes successfully.

**Step 2: If build fails, fix issues and commit**

---

## Task 14: Manual Testing

**Step 1: Start dev server**

Run:
```bash
cd /Users/stefan/projects/veda\ legal\ timesheets/.worktrees/topics-drag-drop-reorder/app && npm run dev
```

**Step 2: Test in browser**

Navigate to http://localhost:3000/topics and verify:
- [ ] Drag handles appear on topic rows
- [ ] Drag handles appear on subtopic rows
- [ ] Dragging a topic reorders it within active section
- [ ] Dragging a topic reorders it within inactive section
- [ ] Dragging a subtopic reorders it within its topic's active section
- [ ] Dragging a subtopic reorders it within its topic's inactive section
- [ ] Cannot drag between active/inactive sections
- [ ] Order persists after page refresh
- [ ] Keyboard navigation works (Tab to handle, Space to pick up, arrows to move)
- [ ] Single items have disabled (dimmed) handles

**Step 3: Stop dev server when done**

---

## Task 15: Final Commit and Summary

**Step 1: Verify all changes are committed**

Run:
```bash
git status
```

If any unstaged changes, commit them.

**Step 2: View commit history**

Run:
```bash
git log --oneline -10
```

Expected: Clean series of commits implementing drag-and-drop.
