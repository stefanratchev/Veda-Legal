# Topic & Subtopic Hierarchy Design

**Date:** 2025-12-22
**Status:** Approved

## Overview

Transform the flat topic system into a two-level hierarchy (Topic > Subtopic) to better organize legal work categories. When lawyers select a subtopic, it pre-fills the description field, which they can modify as needed.

## Data Model

### Topic Table (repurposed from existing)

```prisma
model Topic {
  id           String      @id @default(cuid())
  name         String      // e.g., "Company Incorporation"
  displayOrder Int         @default(0)
  status       TopicStatus @default(ACTIVE)

  subtopics    Subtopic[]

  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@map("topics")
}
```

**Changes from current:**
- Remove `code` field (no longer needed)
- Add `subtopics` relation

### Subtopic Table (new)

```prisma
model Subtopic {
  id           String         @id @default(cuid())
  topicId      String
  topic        Topic          @relation(fields: [topicId], references: [id])
  name         String         // e.g., "Client correspondence:"
  isPrefix     Boolean        @default(false) // true if name ends with ":"
  displayOrder Int            @default(0)
  status       SubtopicStatus @default(ACTIVE)

  timeEntries  TimeEntry[]

  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt

  @@map("subtopics")
}

enum SubtopicStatus {
  ACTIVE
  INACTIVE
}
```

### TimeEntry Changes

```prisma
model TimeEntry {
  // ... existing fields ...

  // Remove: topicId, topic relation

  // Add:
  subtopicId   String?
  subtopic     Subtopic?  @relation(fields: [subtopicId], references: [id])
  topicName    String     // Snapshot at creation (immutable)
  subtopicName String     // Snapshot at creation (immutable)

  @@index([subtopicId])
}
```

**Immutability:** `topicName` and `subtopicName` are copied from the selected subtopic at creation time. Changes to Topic/Subtopic names do not affect historical entries.

## UI Components

### TopicCascadeSelect (replaces TopicSelect)

Single dropdown with drill-down navigation:

**Initial state:**
- Button shows "Select topic..." placeholder
- Click opens panel with list of topics

**Topic view:**
- Lists all active topics sorted by `displayOrder`
- Search box filters by topic name
- Click topic → slides to subtopic view

**Subtopic view:**
- Header: back arrow + selected topic name
- Lists subtopics for that topic sorted by `displayOrder`
- Search box filters subtopics
- Click subtopic → closes dropdown, fires selection event

**Selected state:**
- Button displays: "Topic > Subtopic" (truncated with tooltip for full text)
- Example: "Company Incorporation > Client cor..."

**Keyboard support:**
- Arrow keys: navigate list
- Enter: select item
- Escape: close dropdown or go back one level
- Typing: filters current list

**Animation:**
- Slide transition between views (~150ms)
- Pink accent on hover/selection (matches design system)

### EntryForm Changes

**Selection flow:**
1. Client selected → TopicCascadeSelect auto-opens
2. Subtopic selected → Description pre-filled → DurationPicker auto-opens
3. Duration selected → Form ready for submit

**Description pre-fill logic:**

When subtopic is selected:
- If `isPrefix` is false: pre-fill description with subtopic name exactly
- If `isPrefix` is true: pre-fill with subtopic name + space, apply visual highlight to description field (brief glow using `--accent-pink`, fades after 1s or on typing)

**Conflict handling:**
- If description has content when changing subtopic: prompt "Replace description with new topic?" (Yes/No)
- If description is empty: pre-fill without prompt

### EntryCard Changes

**Display only (no edit mode):**
- Remove edit button and edit state
- Show delete button with confirmation dialog

**Layout:**
```
┌─────────────────────────────────────────┐
│ VED001 · Client correspondence...       │
│ 2h 30m                            [🗑️]  │
│ "Client correspondence: discussed..."   │
└─────────────────────────────────────────┘
```

**Subtopic display:**
- Shows `subtopicName` (stored on entry, not looked up)
- Truncated with "..." if too long
- Hover tooltip: "Topic > Subtopic" full text

**Delete behavior:**
- Confirmation dialog: "Delete this time entry?"
- On confirm: DELETE request to API

## Admin UI

### Topics Admin Page (repurposed /topics)

**Two-panel layout:**

**Left panel - Topics:**
- "Add Topic" button
- List of topics with: name, subtopic count, status badge
- Click to select → shows subtopics in right panel
- Drag handle or up/down buttons for reordering
- Actions per topic: Edit, Deactivate/Reactivate, Delete

**Right panel - Subtopics:**
- Header: selected topic name
- "Add Subtopic" button
- List of subtopics with: name, prefix indicator (shows ":" badge if isPrefix), status badge
- Drag handle or up/down buttons for reordering
- Actions per subtopic: Edit, Deactivate/Reactivate, Delete

**Add/Edit modals:**

Topic modal:
- Name field (required)

Subtopic modal:
- Name field (required)
- Hint text: "End with ':' if lawyers should add specifics"
- `isPrefix` auto-set based on name ending with ":"

**Deletion rules:**
- Topic: only if no subtopics exist
- Subtopic: only if no time entries reference it
- Use deactivation to hide from selection while preserving history

## API Changes

### GET /api/topics

Returns topics with their subtopics:
```json
[
  {
    "id": "...",
    "name": "Company Incorporation",
    "displayOrder": 1,
    "status": "ACTIVE",
    "subtopics": [
      {
        "id": "...",
        "name": "Client correspondence:",
        "isPrefix": true,
        "displayOrder": 1,
        "status": "ACTIVE"
      }
    ]
  }
]
```

Query params:
- `?includeInactive=true` - include inactive topics/subtopics

### POST /api/topics

Create topic (admin only):
```json
{ "name": "New Topic" }
```

### PATCH /api/topics/[id]

Update topic (admin only):
```json
{ "name": "...", "displayOrder": 1, "status": "INACTIVE" }
```

### DELETE /api/topics/[id]

Delete topic (admin only). Fails if topic has subtopics.

### POST /api/topics/[id]/subtopics

Create subtopic (admin only):
```json
{ "name": "New subtopic:" }
```

`isPrefix` auto-calculated from name.

### PATCH /api/subtopics/[id]

Update subtopic (admin only):
```json
{ "name": "...", "displayOrder": 1, "status": "INACTIVE" }
```

### DELETE /api/subtopics/[id]

Delete subtopic (admin only). Fails if time entries reference it.

### POST /api/timesheets

Updated to require `subtopicId`:
```json
{
  "clientId": "...",
  "subtopicId": "...",
  "hours": 2,
  "minutes": 30,
  "description": "Client correspondence: discussed contract terms"
}
```

Server looks up subtopic + topic, stores:
- `subtopicId` (reference)
- `topicName` (snapshot)
- `subtopicName` (snapshot)

### PATCH /api/timesheets/[id]

**Removed** - entries are immutable.

### DELETE /api/timesheets/[id]

Unchanged - deletes the entry.

## Migration Plan

1. **Schema migration:**
   - Remove `code` from Topic table
   - Create Subtopic table
   - Add `subtopicId`, `topicName`, `subtopicName` to TimeEntry
   - Remove `topicId` from TimeEntry

2. **Data migration:**
   - Delete all existing Topic records
   - Run seed script with 15 topics and ~120 subtopics

3. **Legacy entries:**
   - Existing TimeEntry records have null `subtopicId` and empty `topicName`/`subtopicName`
   - UI displays these without topic info (existing graceful fallback)

## Seed Data

### Topics (15)

1. Internal
2. Company Incorporation
3. UBO Disclosure
4. Corporate Changes
5. Bank Account
6. Employment Agreement
7. Employment Internal Rules
8. Employment Advisory
9. Intercompany Agreement
10. Contracts
11. Terms & Conditions
12. Data Protection
13. Legal Advisory

### Subtopics (see appendix)

Full list provided by user with ~8-12 subtopics per topic. Subtopics ending with ":" are marked as `isPrefix: true`.

---

## Appendix: Full Subtopic List

### Internal
- Onboarding
- AML/ KYC
- Admin:
- Meeting:
- Marketing:
- Research:
- Other:

### Company Incorporation
- Drafting incorporation documents
- Revising incorporation documents
- Modifications to standard documents
- Client correspondence:
- Client meeting:
- Strategic consideration:
- Legal research:
- Commercial Register filing: preparation for filing
- Commercial Register filing: submission of application
- Commercial Register filing: additional requests
- VAT registration: document preparation
- VAT registration: NRA correspondence
- Other:

### UBO Disclosure
- Client correspondence:
- Client meeting:
- Drafting UBO declaration
- Revising UBO declaration
- Commercial Register filing: preparation for filing
- Commercial Register filing: submission of application
- Commercial Register filing: additional requests

### Corporate Changes
- Client correspondence:
- Client meeting:
- Drafting documents:
- Revising documents:
- Strategic consideration:
- Legal Research:
- Commercial Register filing: preparation for filing
- Commercial Register filing: submission of application
- Commercial Register filing: additional requests
- Other:

### Bank Account
- Correspondence with the bank
- Research and summary of bank requirements
- Client correspondence:
- Client meeting:
- Strategic consideration:
- Legal research:
- Drafting documents:
- Revising documents:
- Bank visit: opening account
- Internal: Case Management

### Employment Agreement
- Drafting employment agreement
- Revising employment agreement
- Reflecting client comments in employment agreement
- Client correspondence:
- Client meeting:
- Strategic consideration:
- Legal research:
- Other:

### Employment Internal Rules
- Drafting Internal Labour Rules
- Revising Internal Labour Rules
- Drafting Internal Remuneration Rules
- Revising Internal Remuneration Rules
- Reflecting client comments in Internal Rules
- Client correspondence:
- Client meeting:
- Strategic consideration:
- Legal research:
- Other:

### Employment Advisory
- Client correspondence:
- Client meeting:
- Strategic consideration:
- Legal research:
- Drafting documents:
- Revising documents:
- Other:

### Intercompany Agreement
- Drafting Intercompany Agreement
- Revising Intercompany Agreement
- Client correspondence:
- Client meeting:
- Strategic consideration:
- Legal research:
- Other:

### Contracts
- Drafting contract:
- Revising contract:
- Client correspondence:
- Client meeting:
- Strategic consideration:
- Legal research:
- Other:

### Terms & Conditions
- Drafting T&C:
- Revising T&C:
- Client correspondence:
- Client meeting:
- Strategic consideration:
- Legal research:
- Other:

### Data Protection
- Drafting a Privacy Policy
- Revision a Privacy Policy
- Drafting Data Protection Instruction
- Revising Data Protection Instruction
- Drafting Cookies Policy
- Revising Cookies Policy
- Client correspondence:
- Client meeting:
- Strategic consideration:
- Legal research:
- Other:

### Legal Advisory
- Drafting:
- Revising:
- Client correspondence:
- Client meeting:
- Strategic consideration:
- Legal research:
- Other:
