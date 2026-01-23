# Internal Time Tracking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable tracking of non-billable internal time with two tiers (Internal for all employees, Management for Partners/Admins only).

**Architecture:** Add `clientType` enum to clients and `topicType` enum to topics. Filter topics shown in timesheet form based on selected client's type. Hide subtopic selection for internal/management topics.

**Tech Stack:** Next.js, Drizzle ORM, PostgreSQL, React, TypeScript

---

## Task 1: Add Database Enums and Schema Fields

**Files:**
- Modify: `app/src/lib/schema.ts`

**Step 1: Add the new enums and fields to schema**

Add after line 11 (after existing enums):

```typescript
export const clientType = pgEnum("ClientType", ['REGULAR', 'INTERNAL', 'MANAGEMENT'])
export const topicType = pgEnum("TopicType", ['REGULAR', 'INTERNAL', 'MANAGEMENT'])
```

Add to `clients` table (after `secondaryEmails` field, around line 113):

```typescript
clientType: clientType().default('REGULAR').notNull(),
```

Add to `topics` table (after `status` field, around line 120):

```typescript
topicType: topicType().default('REGULAR').notNull(),
```

**Step 2: Generate and run migration**

```bash
cd app && npm run db:generate
```

Review the generated migration file in `app/drizzle/` to ensure it:
- Creates `ClientType` enum
- Creates `TopicType` enum
- Adds `clientType` column to clients with default 'REGULAR'
- Adds `topicType` column to topics with default 'REGULAR'

```bash
npm run db:migrate
```

**Step 3: Commit**

```bash
git add app/src/lib/schema.ts app/drizzle/
git commit -m "feat(db): add clientType and topicType enums and fields"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `app/src/types/index.ts`

**Step 1: Add ClientType and TopicType types**

Add after line 11 (after Client interface):

```typescript
/**
 * Client type for categorization.
 */
export type ClientType = "REGULAR" | "INTERNAL" | "MANAGEMENT";

/**
 * Extended client with type information.
 */
export interface ClientWithType extends Client {
  clientType: ClientType;
}
```

Update the Topic interface (around line 27-33) to include topicType:

```typescript
/**
 * Topic type for categorization.
 */
export type TopicType = "REGULAR" | "INTERNAL" | "MANAGEMENT";

/**
 * Topic category containing subtopics.
 */
export interface Topic {
  id: string;
  name: string;
  displayOrder: number;
  status: "ACTIVE" | "INACTIVE";
  topicType: TopicType;
  subtopics: Subtopic[];
}
```

**Step 2: Commit**

```bash
git add app/src/types/index.ts
git commit -m "feat(types): add ClientType and TopicType definitions"
```

---

## Task 3: Update Clients API

**Files:**
- Modify: `app/src/app/api/clients/route.ts`

**Step 1: Add clientType validation constant**

Add after line 17:

```typescript
const VALID_CLIENT_TYPES = ["REGULAR", "INTERNAL", "MANAGEMENT"] as const;
```

**Step 2: Update serializeClient to include clientType**

Update the serializeClient function (around line 19-24):

```typescript
function serializeClient<T extends { hourlyRate: string | null; clientType: string }>(client: T) {
  return {
    ...client,
    hourlyRate: serializeDecimal(client.hourlyRate),
  };
}
```

**Step 3: Update GET to include clientType and filter by type**

Update the GET function to:
1. Accept `type` query param
2. Exclude MANAGEMENT clients for non-admin users
3. Include clientType in returned columns

Replace GET function (lines 26-58):

```typescript
// GET /api/clients - List all clients
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Get user to check permissions
  const user = await getUserFromSession(auth.session.user?.email);
  const isAdmin = user?.position && hasAdminAccess(user.position);

  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("type");

  try {
    let query = db.query.clients.findMany({
      columns: {
        id: true,
        name: true,
        invoicedName: true,
        invoiceAttn: true,
        email: true,
        secondaryEmails: true,
        hourlyRate: true,
        status: true,
        clientType: true,
        notes: true,
        createdAt: true,
      },
      orderBy: [desc(clients.createdAt)],
    });

    let allClients = await query;

    // Filter by type if specified
    if (typeFilter && VALID_CLIENT_TYPES.includes(typeFilter as typeof VALID_CLIENT_TYPES[number])) {
      allClients = allClients.filter(c => c.clientType === typeFilter);
    }

    // Non-admins cannot see MANAGEMENT clients
    if (!isAdmin) {
      allClients = allClients.filter(c => c.clientType !== "MANAGEMENT");
    }

    return NextResponse.json(allClients.map(serializeClient));
  } catch (error) {
    console.error("Database error fetching clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}
```

Add import for `getUserFromSession` and `hasAdminAccess` at top of file.

**Step 4: Update POST to accept clientType**

In the POST function, add after extracting body fields (around line 74):

```typescript
const { name, invoicedName, invoiceAttn, email, secondaryEmails, hourlyRate, status, notes, clientType: clientTypeParam } = body;
```

Add validation after status validation (around line 103):

```typescript
// Validate clientType
const finalClientType = clientTypeParam || "REGULAR";
if (!VALID_CLIENT_TYPES.includes(finalClientType)) {
  return errorResponse("Invalid client type", 400);
}
```

Add to insert values (around line 116):

```typescript
clientType: finalClientType,
```

Add to returning clause:

```typescript
clientType: clients.clientType,
```

**Step 5: Update PATCH to accept clientType**

In the PATCH function, add clientType to destructuring (around line 155):

```typescript
const { id, name, invoicedName, invoiceAttn, email, secondaryEmails, hourlyRate, status, notes, clientType: clientTypeParam } = body;
```

Add validation and update logic (after status validation around line 192):

```typescript
// Validate clientType if provided
if (clientTypeParam !== undefined && !VALID_CLIENT_TYPES.includes(clientTypeParam)) {
  return errorResponse("Invalid client type", 400);
}
```

Add to updateData building (around line 207):

```typescript
if (clientTypeParam !== undefined) updateData.clientType = clientTypeParam;
```

Add to returning clause:

```typescript
clientType: clients.clientType,
```

**Step 6: Commit**

```bash
git add app/src/app/api/clients/route.ts
git commit -m "feat(api): add clientType support to clients endpoints"
```

---

## Task 4: Update Topics API

**Files:**
- Modify: `app/src/app/api/topics/route.ts`

**Step 1: Add topicType validation constant**

Add after imports:

```typescript
const VALID_TOPIC_TYPES = ["REGULAR", "INTERNAL", "MANAGEMENT"] as const;
```

**Step 2: Update GET to include topicType and filter**

Update the GET function to accept `type` query param and include topicType:

In the return mapping (around line 37-44), add topicType:

```typescript
return NextResponse.json(
  allTopics.map((t) => ({
    id: t.id,
    name: t.name,
    displayOrder: t.displayOrder,
    status: t.status,
    topicType: t.topicType,
    subtopics: t.subtopics,
  }))
);
```

Add filtering logic before the return (after fetching allTopics):

```typescript
const typeFilter = searchParams.get("type");

// Filter by type if specified
let filteredTopics = allTopics;
if (typeFilter && VALID_TOPIC_TYPES.includes(typeFilter as typeof VALID_TOPIC_TYPES[number])) {
  filteredTopics = allTopics.filter(t => t.topicType === typeFilter);
}
```

Then use `filteredTopics` in the return.

**Step 3: Update POST to accept topicType**

In the POST function, extract topicType from body (around line 66):

```typescript
const { name, topicType: topicTypeParam } = body;
```

Add validation (after name validation):

```typescript
// Validate topicType
const finalTopicType = topicTypeParam || "REGULAR";
if (!VALID_TOPIC_TYPES.includes(finalTopicType)) {
  return errorResponse("Invalid topic type", 400);
}
```

Add to insert values:

```typescript
topicType: finalTopicType,
```

Add to returning clause:

```typescript
topicType: topics.topicType,
```

Update the response to include topicType:

```typescript
return NextResponse.json({
  id: topic.id,
  name: topic.name,
  displayOrder: topic.displayOrder,
  status: topic.status,
  topicType: topic.topicType,
  subtopics: [],
});
```

**Step 4: Update topics/[id] PATCH to accept topicType**

File: `app/src/app/api/topics/[id]/route.ts`

Add topicType to the PATCH handler's body extraction and validation, similar to POST.

**Step 5: Commit**

```bash
git add app/src/app/api/topics/
git commit -m "feat(api): add topicType support to topics endpoints"
```

---

## Task 5: Update Client Modal and ClientsContent

**Files:**
- Modify: `app/src/components/clients/ClientModal.tsx`
- Modify: `app/src/components/clients/ClientsContent.tsx`

**Step 1: Add clientType to ClientModal FormData interface**

In ClientModal.tsx, update FormData interface (around line 7-16):

```typescript
type ClientType = "REGULAR" | "INTERNAL" | "MANAGEMENT";

interface FormData {
  name: string;
  invoicedName: string;
  invoiceAttn: string;
  email: string;
  secondaryEmails: string;
  hourlyRate: string;
  status: ClientStatus;
  clientType: ClientType;
  notes: string;
}
```

**Step 2: Add clientType dropdown to modal form**

Add after the Status select (around line 230):

```typescript
{/* Client Type */}
<div>
  <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">
    Client Type
  </label>
  <select
    value={formData.clientType}
    onChange={(e) => onFormChange({ clientType: e.target.value as ClientType })}
    className="
      w-full px-3 py-2 rounded text-[13px]
      bg-[var(--bg-surface)] border border-[var(--border-subtle)]
      text-[var(--text-primary)]
      focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
      focus:outline-none transition-all duration-200
      cursor-pointer
    "
  >
    <option value="REGULAR">Regular</option>
    <option value="INTERNAL">Internal</option>
    <option value="MANAGEMENT">Management</option>
  </select>
  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
    Internal: visible to all. Management: Partners/Admins only.
  </p>
</div>
```

**Step 3: Update ClientsContent**

Update the Client interface to include clientType:

```typescript
type ClientType = "REGULAR" | "INTERNAL" | "MANAGEMENT";

interface Client {
  id: string;
  name: string;
  // ... existing fields
  clientType: ClientType;
}
```

Update initialFormData:

```typescript
const initialFormData: FormData = {
  // ... existing fields
  clientType: "REGULAR",
};
```

Update openEditModal to set clientType:

```typescript
clientType: client.clientType || "REGULAR",
```

Add a badge column or inline badge in the name column for non-REGULAR clients:

```typescript
cell: (client) => (
  <div className="flex items-center gap-2">
    <span className="font-medium text-[13px] text-[var(--text-primary)]">
      {client.name}
    </span>
    {client.clientType !== "REGULAR" && (
      <span className={`
        px-1.5 py-0.5 text-[10px] font-medium rounded
        ${client.clientType === "INTERNAL"
          ? "bg-[var(--info-bg)] text-[var(--info)]"
          : "bg-[var(--warning-bg)] text-[var(--warning)]"}
      `}>
        {client.clientType === "INTERNAL" ? "Internal" : "Mgmt"}
      </span>
    )}
  </div>
),
```

Add clientType filter option to TableFilters (create a second filter or extend existing).

**Step 4: Commit**

```bash
git add app/src/components/clients/
git commit -m "feat(ui): add clientType to client modal and list"
```

---

## Task 6: Update Topic Modal and TopicsContent

**Files:**
- Modify: `app/src/components/topics/TopicModal.tsx`
- Modify: `app/src/components/topics/TopicsContent.tsx`

**Step 1: Add topicType to TopicModal**

Update TopicModal to accept and display topicType:

```typescript
interface TopicModalProps {
  topic: Topic | null;
  onSave: (data: { name: string; topicType?: string }) => void;
  onClose: () => void;
}

export function TopicModal({ topic, onSave, onClose }: TopicModalProps) {
  const [name, setName] = useState(topic?.name || "");
  const [topicType, setTopicType] = useState(topic?.topicType || "REGULAR");
  // ... rest of component

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    await onSave({ name: name.trim(), topicType });
    setIsSubmitting(false);
  };
```

Add topicType dropdown in the form:

```typescript
<div>
  <label className="block text-[13px] font-medium text-[var(--text-secondary)] mb-1">
    Type
  </label>
  <select
    value={topicType}
    onChange={(e) => setTopicType(e.target.value)}
    className="
      w-full px-4 py-2.5 rounded
      bg-[var(--bg-surface)] border border-[var(--border-subtle)]
      text-[var(--text-primary)]
      focus:border-[var(--border-accent)] focus:ring-[2px] focus:ring-[var(--accent-pink-glow)]
      focus:outline-none transition-all duration-200
    "
  >
    <option value="REGULAR">Regular</option>
    <option value="INTERNAL">Internal</option>
    <option value="MANAGEMENT">Management</option>
  </select>
  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
    Internal/Management topics have no subtopics
  </p>
</div>
```

**Step 2: Update TopicsContent**

Add badge to topic rows for non-REGULAR topics:

In TopicRowWithHandle, after the topic name span:

```typescript
{topic.topicType !== "REGULAR" && (
  <span className={`
    px-1.5 py-0.5 text-[10px] font-medium rounded
    ${topic.topicType === "INTERNAL"
      ? "bg-[var(--info-bg)] text-[var(--info)]"
      : "bg-[var(--warning-bg)] text-[var(--warning)]"}
  `}>
    {topic.topicType === "INTERNAL" ? "Internal" : "Mgmt"}
  </span>
)}
```

Hide the subtopics panel when selected topic is INTERNAL or MANAGEMENT:

```typescript
{/* Right Panel: Subtopics - only show for REGULAR topics */}
{selectedTopic?.topicType === "REGULAR" && (
  <div className="bg-[var(--bg-elevated)] ...">
    {/* existing subtopics panel content */}
  </div>
)}

{selectedTopic && selectedTopic.topicType !== "REGULAR" && (
  <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded overflow-hidden">
    <div className="p-8 text-center text-[var(--text-muted)] text-sm">
      {selectedTopic.topicType === "INTERNAL" ? "Internal" : "Management"} topics don't have subtopics
    </div>
  </div>
)}
```

Update handleSaveTopic to pass topicType:

```typescript
body: JSON.stringify({ name: data.name, topicType: data.topicType }),
```

**Step 3: Commit**

```bash
git add app/src/components/topics/
git commit -m "feat(ui): add topicType to topic modal and list"
```

---

## Task 7: Update Timesheet Entry Form

**Files:**
- Modify: `app/src/components/timesheets/EntryForm.tsx`
- Modify: `app/src/components/ui/TopicCascadeSelect.tsx`
- Modify: `app/src/app/(authenticated)/timesheets/page.tsx`

**Step 1: Update EntryForm props to receive client info**

The form needs to know the selected client's type to:
1. Filter topics appropriately
2. Hide subtopic field for internal/management topics
3. Make description optional

Update EntryFormProps:

```typescript
interface EntryFormProps {
  clients: ClientWithType[];
  topics: Topic[];
  formData: FormData;
  isLoading: boolean;
  error: string | null;
  onFormChange: (updates: Partial<FormData>) => void;
  onSubmit: () => void;
  isEditMode?: boolean;
  onCancel?: () => void;
}
```

**Step 2: Filter topics based on selected client type**

Add logic to filter topics:

```typescript
const selectedClient = clients.find(c => c.id === formData.clientId);
const clientType = selectedClient?.clientType || "REGULAR";

// Filter topics to match client type
const filteredTopics = topics.filter(t => t.topicType === clientType);
```

**Step 3: Update canSubmit logic**

For internal/management topics, subtopicId is not required:

```typescript
const selectedTopic = filteredTopics.find(t =>
  t.subtopics.some(s => s.id === formData.subtopicId) || t.id === formData.topicId
);
const isInternalOrManagement = selectedTopic?.topicType !== "REGULAR";

const canSubmit =
  formData.clientId &&
  (isInternalOrManagement ? formData.topicId : formData.subtopicId) &&
  (formData.hours > 0 || formData.minutes > 0);
```

**Step 4: Update TopicCascadeSelect for topics without subtopics**

When a topic has no subtopics (internal/management), clicking it should select the topic directly:

In TopicCascadeSelect, update handleTopicClick:

```typescript
const handleTopicClick = (topic: Topic) => {
  if (topic.subtopics.length === 0) {
    // For topics without subtopics, select the topic directly
    onChange(topic.id, null as unknown as Subtopic, topic);
    setIsOpen(false);
    setSearch("");
    setHighlightedIndex(0);
  } else {
    setSelectedTopicId(topic.id);
    setSearch("");
    setHighlightedIndex(0);
  }
};
```

Update the onChange signature and types to handle this case.

**Step 5: Update FormData type**

Add topicId for internal/management topics:

```typescript
export interface FormData {
  clientId: string;
  topicId: string;  // Used for internal/management topics
  subtopicId: string;
  hours: number;
  minutes: number;
  description: string;
}

export const initialFormData: FormData = {
  clientId: "",
  topicId: "",
  subtopicId: "",
  hours: 1,
  minutes: 0,
  description: "",
};
```

**Step 6: Commit**

```bash
git add app/src/components/timesheets/ app/src/components/ui/TopicCascadeSelect.tsx app/src/types/
git commit -m "feat(ui): update timesheet form for internal time tracking"
```

---

## Task 8: Update Timesheets API

**Files:**
- Modify: `app/src/app/api/timesheets/route.ts`

**Step 1: Update POST to handle internal/management entries**

The validation needs to:
1. Check if client is internal/management type
2. For internal/management: accept topicId instead of subtopicId
3. For internal/management: make description optional

Update the POST validation section:

```typescript
// Validate client
if (!clientId) {
  return errorResponse("Client is required", 400);
}
const client = await db.query.clients.findFirst({
  where: eq(clients.id, clientId),
  columns: { id: true, status: true, clientType: true },
});
if (!client) {
  return errorResponse("Client not found", 404);
}
if (client.status !== "ACTIVE") {
  return errorResponse("Cannot log time for inactive clients", 400);
}

const isInternalEntry = client.clientType === "INTERNAL" || client.clientType === "MANAGEMENT";

// For internal entries, we need topicId; for regular entries, we need subtopicId
let topicName = "";
let subtopicName = "";
let finalSubtopicId: string | null = null;

if (isInternalEntry) {
  // Validate topicId for internal entries
  if (!topicId) {
    return errorResponse("Topic is required", 400);
  }
  const topic = await db.query.topics.findFirst({
    where: eq(topics.id, topicId),
    columns: { id: true, name: true, status: true, topicType: true },
  });
  if (!topic) {
    return errorResponse("Topic not found", 404);
  }
  if (topic.status !== "ACTIVE") {
    return errorResponse("Cannot log time with inactive topic", 400);
  }
  if (topic.topicType !== client.clientType) {
    return errorResponse("Topic type must match client type", 400);
  }
  topicName = topic.name;
  subtopicName = ""; // No subtopic for internal entries
} else {
  // Validate subtopic (required for regular entries)
  if (!subtopicId) {
    return errorResponse("Subtopic is required", 400);
  }
  // ... existing subtopic validation ...
  finalSubtopicId = subtopicId;
}
```

Update the insert values:

```typescript
subtopicId: finalSubtopicId,
topicName: topicName,
subtopicName: subtopicName,
```

**Step 2: Commit**

```bash
git add app/src/app/api/timesheets/route.ts
git commit -m "feat(api): update timesheets POST for internal time entries"
```

---

## Task 9: Update Billing Pages to Exclude Internal Clients

**Files:**
- Modify: `app/src/app/(authenticated)/billing/page.tsx`

**Step 1: Filter out non-REGULAR clients from billing**

Update the clients query (around line 78-82):

```typescript
// Fetch clients for the create modal (only REGULAR clients for billing)
const clientsList = await db.query.clients.findMany({
  where: and(
    eq(clients.status, "ACTIVE"),
    eq(clients.clientType, "REGULAR")
  ),
  columns: { id: true, name: true },
  orderBy: [asc(clients.name)],
});
```

Add import for `and`:

```typescript
import { eq, asc, desc, and } from "drizzle-orm";
```

**Step 2: Commit**

```bash
git add app/src/app/(authenticated)/billing/page.tsx
git commit -m "feat(billing): exclude internal/management clients from billing"
```

---

## Task 10: Seed Internal and Management Topics

**Files:**
- Create: `app/scripts/seed-internal-topics.ts`

**Step 1: Create seed script**

```typescript
import { db } from "../src/lib/db";
import { topics } from "../src/lib/schema";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

const INTERNAL_TOPICS = [
  "Holiday",
  "Sick Leave",
  "KYC",
  "Leads",
  "Knowhow",
  "Marketing",
  "Misc",
];

const MANAGEMENT_TOPICS = [
  "Strategy",
  "Billing",
  "Admin",
  "Networking",
];

async function seedInternalTopics() {
  console.log("Seeding internal topics...");

  const now = new Date().toISOString();
  let displayOrder = 1000; // Start high to not conflict with existing topics

  for (const name of INTERNAL_TOPICS) {
    // Check if topic already exists
    const existing = await db.query.topics.findFirst({
      where: eq(topics.name, name),
    });

    if (existing) {
      console.log(`  Skipping "${name}" (already exists)`);
      continue;
    }

    await db.insert(topics).values({
      id: createId(),
      name,
      displayOrder: displayOrder++,
      status: "ACTIVE",
      topicType: "INTERNAL",
      updatedAt: now,
    });
    console.log(`  Created internal topic: ${name}`);
  }

  console.log("\nSeeding management topics...");

  for (const name of MANAGEMENT_TOPICS) {
    const existing = await db.query.topics.findFirst({
      where: eq(topics.name, name),
    });

    if (existing) {
      console.log(`  Skipping "${name}" (already exists)`);
      continue;
    }

    await db.insert(topics).values({
      id: createId(),
      name,
      displayOrder: displayOrder++,
      status: "ACTIVE",
      topicType: "MANAGEMENT",
      updatedAt: now,
    });
    console.log(`  Created management topic: ${name}`);
  }

  console.log("\nDone!");
  process.exit(0);
}

seedInternalTopics().catch((error) => {
  console.error("Error seeding topics:", error);
  process.exit(1);
});
```

**Step 2: Add npm script to package.json**

```json
"db:seed-internal-topics": "npx tsx scripts/seed-internal-topics.ts"
```

**Step 3: Run the seed script**

```bash
npm run db:seed-internal-topics
```

**Step 4: Commit**

```bash
git add app/scripts/seed-internal-topics.ts app/package.json
git commit -m "feat(db): add seed script for internal and management topics"
```

---

## Task 11: Update Timesheets Page to Fetch Clients with Type

**Files:**
- Modify: `app/src/app/(authenticated)/timesheets/page.tsx`

**Step 1: Include clientType in clients query**

Update the clients fetch to include clientType:

```typescript
const clientsList = await db.query.clients.findMany({
  where: eq(clients.status, "ACTIVE"),
  columns: { id: true, name: true, clientType: true },
  orderBy: [asc(clients.name)],
});
```

For non-admin users, filter out MANAGEMENT clients:

```typescript
const isAdmin = hasAdminAccess(user.position);
let filteredClients = clientsList;
if (!isAdmin) {
  filteredClients = clientsList.filter(c => c.clientType !== "MANAGEMENT");
}
```

**Step 2: Commit**

```bash
git add app/src/app/(authenticated)/timesheets/page.tsx
git commit -m "feat(timesheets): include clientType in page data"
```

---

## Task 12: Write Tests

**Files:**
- Create: `app/src/app/api/clients/route.test.ts`
- Create: `app/src/app/api/topics/route.test.ts`

**Step 1: Write client API tests**

Test that:
- GET returns clientType field
- GET excludes MANAGEMENT clients for non-admin users
- GET filters by type param
- POST accepts and validates clientType
- PATCH accepts and validates clientType

**Step 2: Write topic API tests**

Test that:
- GET returns topicType field
- GET filters by type param
- POST accepts and validates topicType
- PATCH accepts and validates topicType

**Step 3: Run tests**

```bash
npm run test -- --run
```

**Step 4: Commit**

```bash
git add app/src/app/api/clients/route.test.ts app/src/app/api/topics/route.test.ts
git commit -m "test: add tests for clientType and topicType API support"
```

---

## Summary of Changes

| Area | Changes |
|------|---------|
| Database | New `ClientType` and `TopicType` enums; new fields on clients and topics tables |
| Types | `ClientType`, `TopicType`, `ClientWithType` types; `topicType` on `Topic` interface |
| Clients API | Filter by type, exclude MANAGEMENT for non-admins, CRUD support for clientType |
| Topics API | Filter by type, CRUD support for topicType |
| Client UI | Type dropdown in modal, badges in list, type filter |
| Topics UI | Type dropdown in modal, badges on rows, hide subtopics panel for non-REGULAR |
| Timesheet Form | Filter topics by client type, handle direct topic selection for internal entries |
| Timesheets API | Support topicId for internal entries, optional description |
| Billing | Exclude non-REGULAR clients |
| Seed Data | 7 internal topics, 4 management topics |
