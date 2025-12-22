# Timesheet Topics Design

## Overview

Add predefined work topics to timesheet entries, allowing employees to categorize their time with a single click. Topics are database-managed so admins can add, edit, reorder, and deactivate them over time.

## New Entry Flow

```
Client → Topic → Duration → Description → Submit
   ↓        ↓         ↓           ↓
(auto)   (auto)    (auto)     (Enter key)
 opens    opens    focuses     submits
```

Each selection auto-advances to the next field for rapid data entry.

## Database Schema

### New Topic Model

```prisma
model Topic {
  id           String      @id @default(cuid())
  name         String      // "Legal Research"
  code         String      @unique // "LR"
  displayOrder Int         @default(0)
  status       TopicStatus @default(ACTIVE)

  timeEntries  TimeEntry[]

  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@map("topics")
}

enum TopicStatus {
  ACTIVE
  INACTIVE
}
```

### Updated TimeEntry Model

```prisma
model TimeEntry {
  // ... existing fields ...
  topicId  String?  // Nullable for legacy entries
  topic    Topic?   @relation(fields: [topicId], references: [id])

  @@index([topicId])
}
```

### Initial Seed Data

| Code | Name | displayOrder |
|------|------|--------------|
| ONB | Onboarding & Intake | 1 |
| MTG | Client Meetings/Calls | 2 |
| COM | Client Emails & Messages | 3 |
| RES | Legal Research | 4 |
| EMP | Employment: Advisory & Docs | 5 |

## API Routes

### Topics CRUD (`/api/topics`)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/topics` | List active topics (sorted by displayOrder) | All authenticated |
| GET | `/api/topics?includeInactive=true` | List all topics including inactive | Admin only |
| POST | `/api/topics` | Create new topic | Admin only |
| PATCH | `/api/topics/[id]` | Update topic (name, code, order, status) | Admin only |
| POST | `/api/topics/reorder` | Bulk update display order | Admin only |

### Updated Timesheets API

**Request** (POST/PATCH):
```typescript
{
  date: string,
  clientId: string,
  topicId: string,    // Required for new entries
  hours: number,
  description: string // No minimum length
}
```

**Response** includes topic:
```typescript
{
  id: string,
  date: string,
  hours: number,
  description: string,
  client: { id, name, timesheetCode },
  topic: { id, name, code } | null  // null for legacy entries
}
```

**Validation:**
- `topicId` required on POST (new entries)
- `topicId` optional on PATCH (can add topic to legacy entries)
- Topic must exist and be ACTIVE

## UI Components

### Topics Admin Page (`/topics`)

- New sidebar item below Employees, above Reports
- DataTable with columns: Code, Name, Status, Actions
- "Add Topic" button → modal with name, code fields
- Row actions: Edit, Deactivate/Reactivate
- Drag-and-drop or up/down arrows for reordering

### TopicSelect Component

- Searchable dropdown (filters by name or code)
- Displays: `{code} — {name}` (e.g., "MTG — Client Meetings/Calls")
- Only shows ACTIVE topics
- Sorted by displayOrder
- Exposes `.open()` ref method for auto-cascade

### Updated EntryForm

```
┌─────────────────┬─────────────────┬──────────────┬─────────────────────────────┬───────┐
│ Client ▼        │ Topic ▼         │ Duration     │ What did you work on?       │ Log   │
└─────────────────┴─────────────────┴──────────────┴─────────────────────────────┴───────┘
```

**Auto-cascade flow:**
1. Client selected → TopicSelect auto-opens
2. Topic selected → DurationPicker auto-opens
3. Duration selected → Description input auto-focused
4. Enter key → submits form (if valid)

**Validation:**
- Client: required
- Topic: required
- Duration: > 0
- Description: optional (no minimum), max 1000 chars

### Updated EntryCard

Display format:
```
VED001 · MTG · 2h 30m
Discussed contract renewal terms
```

Legacy entries without topic:
```
VED001 · 2h 30m
Some older entry description
```

## Migration Strategy

1. Add Topic model and TopicStatus enum
2. Add nullable `topicId` to TimeEntry
3. Run migration
4. Seed initial 5 topics
5. Deploy - existing entries preserved with null topic

No backfill required. Legacy entries display without topic code.

## Decisions Summary

| Aspect | Decision |
|--------|----------|
| Topic storage | Database-managed |
| Topic fields | name + code |
| Admin UI | Dedicated /topics page |
| Dropdown order | Manual (displayOrder) |
| Deletion | Soft-delete (status field) |
| Required for new entries | Yes |
| Legacy entries | topicId nullable |
| Description validation | No minimum length |
| Form submission | Enter key + Log button |
