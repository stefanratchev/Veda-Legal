# Internal Time Tracking Design

## Overview

Enable tracking of non-billable internal time for employees, with two tiers:
- **Internal** - Visible to all employees (Holiday, Sick Leave, KYC, Leads, Knowhow, Marketing, Misc)
- **Management** - Visible to Partners/Admins only (Strategy, Billing, Admin, Networking)

**Purpose:** Tracking where non-billable time goes and capacity planning (understanding internal vs billable time split). No approval workflows or payroll integration needed.

## Database Changes

### New Enums

```typescript
export const clientType = pgEnum("ClientType", ['REGULAR', 'INTERNAL', 'MANAGEMENT'])
export const topicType = pgEnum("TopicType", ['REGULAR', 'INTERNAL', 'MANAGEMENT'])
```

### Schema Changes

**`clients` table:**
- Add `clientType` field with type `ClientType`, default `'REGULAR'`

**`topics` table:**
- Add `topicType` field with type `TopicType`, default `'REGULAR'`

### Seed Data

**Internal topics** (topicType = `INTERNAL`):
1. Holiday
2. Sick Leave
3. KYC
4. Leads
5. Knowhow
6. Marketing
7. Misc

**Management topics** (topicType = `MANAGEMENT`):
1. Strategy
2. Billing
3. Admin
4. Networking

All internal/management topics have no subtopics.

## UI Changes

### Client Management (Partners/Admins)

- **Client edit modal:** Add "Client Type" dropdown (Regular / Internal / Management)
- **Client list:** Visual badge/indicator for Internal and Management clients
- **Client list filtering:** Option to filter by client type

### Topic Management (Partners/Admins)

- **Topic list:** Add "Type" column with badges (Regular / Internal / Management)
- **Topic list filtering:** Dropdown to filter by topic type
- **Create topic modal:** Add "Topic Type" dropdown (defaults to Regular)
- **Edit topic modal:** Include "Topic Type" dropdown
- **Subtopic section:** Hidden when topic type is `INTERNAL` or `MANAGEMENT`

### Timesheet Entry Form

- **Client dropdown:** Filter out `MANAGEMENT` clients for non-admin users
- **Topic dropdown:** Show only topics matching selected client's `clientType`
- **Subtopic field:** Hidden when selected topic is `INTERNAL` or `MANAGEMENT` type
- **Description field:** Optional (not required) when client is `INTERNAL` or `MANAGEMENT`

## API Changes

### GET /api/clients
- Accept optional `type` query param to filter by client type
- For non-admin users, automatically exclude `MANAGEMENT` clients from results

### GET /api/topics
- Accept `type` query param to filter by topic type
- Used by timesheet form to fetch appropriate topics based on selected client

### POST /api/timesheets
- Relax description validation: allow empty/missing description when client type is `INTERNAL` or `MANAGEMENT`

## Edge Cases & Constraints

### Migration
- All existing topics default to `topicType = 'REGULAR'`
- All existing clients default to `clientType = 'REGULAR'`
- No data migration needed - existing entries remain valid

### Changing Client Type
- Allowed freely
- Existing time entries retain their denormalized `topicName`/`subtopicName` fields
- New entries against the client must use topics matching the new type

### Billing Integration
- `INTERNAL` and `MANAGEMENT` clients excluded from billing/service description workflows
- Filter non-`REGULAR` clients from billing pages

## Visibility Matrix

| Client Type | Visible To | Topics Shown |
|-------------|------------|--------------|
| `REGULAR` | All employees | Regular work topics |
| `INTERNAL` | All employees | Internal topics (Holiday, Sick Leave, etc.) |
| `MANAGEMENT` | Partners & Admins only | Management topics (Strategy, Billing, etc.) |

## Out of Scope

- Reporting (to be handled separately)
- Approval workflows for leave
- Payroll/HR integration
