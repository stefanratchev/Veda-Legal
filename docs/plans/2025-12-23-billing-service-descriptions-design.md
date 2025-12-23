# Billing: Service Descriptions Design

## Overview

Monthly billing system for creating service descriptions from employee timesheet entries. Allows the admin to review, adjust, and finalize billing records before exporting them as PDFs to send to clients.

## Core Requirements

1. **Monthly billing workflow**: Select a client and date range (defaults to last month), automatically pull all unbilled time entries
2. **Adjustable line items**: Edit hours and descriptions without modifying original TimeEntry records
3. **Dual pricing modes**: Hourly rate (calculated) or fixed fee per topic
4. **Standalone line items**: Add fixed-fee items not tied to any time entry
5. **Draft/Finalize workflow**: Save progress, finalize when ready, lock for audit integrity
6. **PDF export**: Generate service descriptions matching current format
7. **EUR only**: No currency conversion needed

## Data Model

### ServiceDescription

The main billing record for a client's billing period.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| clientId | String | FK to Client |
| periodStart | Date | Billing period start |
| periodEnd | Date | Billing period end |
| status | Enum | DRAFT or FINALIZED |
| finalizedAt | DateTime? | When finalized |
| finalizedById | String? | FK to User who finalized |
| createdAt | DateTime | Record creation |
| updatedAt | DateTime | Last update |

### ServiceDescriptionTopic

Groups line items by topic within a service description.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| serviceDescriptionId | String | FK to ServiceDescription |
| topicName | String | Copied from Topic (immutable) |
| displayOrder | Int | Sort order |
| pricingMode | Enum | HOURLY or FIXED |
| hourlyRate | Decimal? | Rate when HOURLY (defaults from client) |
| fixedFee | Decimal? | Amount when FIXED |

### ServiceDescriptionLineItem

Individual billable items within a topic.

| Field | Type | Description |
|-------|------|-------------|
| id | String | Primary key |
| topicId | String | FK to ServiceDescriptionTopic |
| timeEntryId | String? | FK to TimeEntry (null for manual items) |
| date | Date? | Service date |
| description | String | Editable description |
| hours | Decimal? | Editable hours (null for fixed items) |
| fixedAmount | Decimal? | For standalone fixed-fee items |
| displayOrder | Int | Sort order |

## Prisma Schema

```prisma
model ServiceDescription {
  id            String                    @id @default(cuid())
  clientId      String
  client        Client                    @relation(fields: [clientId], references: [id])
  periodStart   DateTime                  @db.Date
  periodEnd     DateTime                  @db.Date
  status        ServiceDescriptionStatus  @default(DRAFT)
  finalizedAt   DateTime?
  finalizedById String?
  finalizedBy   User?                     @relation(fields: [finalizedById], references: [id])

  topics        ServiceDescriptionTopic[]

  createdAt     DateTime                  @default(now())
  updatedAt     DateTime                  @updatedAt

  @@index([clientId])
  @@index([status])
  @@map("service_descriptions")
}

enum ServiceDescriptionStatus {
  DRAFT
  FINALIZED
}

model ServiceDescriptionTopic {
  id                   String                       @id @default(cuid())
  serviceDescriptionId String
  serviceDescription   ServiceDescription           @relation(fields: [serviceDescriptionId], references: [id], onDelete: Cascade)
  topicName            String
  displayOrder         Int                          @default(0)
  pricingMode          PricingMode                  @default(HOURLY)
  hourlyRate           Decimal?                     @db.Decimal(10, 2)
  fixedFee             Decimal?                     @db.Decimal(10, 2)

  lineItems            ServiceDescriptionLineItem[]

  createdAt            DateTime                     @default(now())
  updatedAt            DateTime                     @updatedAt

  @@index([serviceDescriptionId])
  @@map("service_description_topics")
}

enum PricingMode {
  HOURLY
  FIXED
}

model ServiceDescriptionLineItem {
  id           String                  @id @default(cuid())
  topicId      String
  topic        ServiceDescriptionTopic @relation(fields: [topicId], references: [id], onDelete: Cascade)
  timeEntryId  String?
  timeEntry    TimeEntry?              @relation(fields: [timeEntryId], references: [id])
  date         DateTime?               @db.Date
  description  String
  hours        Decimal?                @db.Decimal(4, 2)
  fixedAmount  Decimal?                @db.Decimal(10, 2)
  displayOrder Int                     @default(0)

  createdAt    DateTime                @default(now())
  updatedAt    DateTime                @updatedAt

  @@index([topicId])
  @@index([timeEntryId])
  @@map("service_description_line_items")
}
```

Note: Add relation to TimeEntry model:
```prisma
model TimeEntry {
  // ... existing fields ...
  billingLineItems ServiceDescriptionLineItem[]
}
```

Note: Add relation to Client model:
```prisma
model Client {
  // ... existing fields ...
  serviceDescriptions ServiceDescription[]
}
```

Note: Add relation to User model:
```prisma
model User {
  // ... existing fields ...
  finalizedServiceDescriptions ServiceDescription[] @relation("FinalizedBy")
}
```

## UI Workflow

### 1. Billing List Page (`/billing`)

- Table of all service descriptions
- Columns: Client, Period, Status, Total, Last Updated
- Filters: Client dropdown, Status (All/Draft/Finalized)
- "New Service Description" button (top right)
- Click row to open detail view

### 2. Create New Service Description

Modal with:
- Client dropdown (required)
- Date range picker (defaults to previous calendar month)
- "Create" button

On create:
1. Query unbilled TimeEntries for client within date range
2. Group by topicName
3. Create ServiceDescriptionTopic for each topic (hourlyRate from client default)
4. Create ServiceDescriptionLineItem for each TimeEntry (copy date, description, hours)
5. Redirect to edit page

### 3. Edit Service Description (`/billing/[id]`)

**Header**
- Client name, period display
- Status badge (Draft/Finalized)
- Total amount (calculated)

**Summary Section**
- List of topics with their fees (read-only, calculated)
- Matches PDF summary format

**Topic Sections** (expandable/collapsible)
For each topic:
- Topic name (heading)
- Pricing mode toggle: Hourly / Fixed
- If Hourly: Rate input field
- If Fixed: Fixed fee input field
- Line items table:
  - Date | Description | Time | Actions
  - Description and Time are inline-editable
  - Hover shows original value if changed
  - Delete button per row
- "Add Line Item" button (opens inline form or modal)

**Add Line Item Form**
- Date (optional)
- Description (required)
- Type: Hours / Fixed Amount
- If Hours: time input
- If Fixed: amount input

**Footer Actions**
- "Add Topic" button (for topics not from time entries)
- "Save Draft" button
- "Finalize" button (with confirmation)

### 4. Finalized View

Same layout as edit, but:
- All fields read-only
- "Export PDF" button (prominent)
- "Unlock for Editing" button (with confirmation warning)

## Pricing Logic

### Hourly Mode
```
topicFee = sum(lineItem.hours) × topic.hourlyRate
```

Display format:
```
Total time: 6:50
Fees rate (VAT excl.)/hrs €155
Fee: €1,059.17
```

### Fixed Mode
```
topicFee = topic.fixedFee
```

Display format:
```
Total time: 7:00
Fee (fixed) €500.00
```

Hours are shown for transparency but don't affect the fee.

### Standalone Fixed Items
Line items with `fixedAmount` set and `hours` null:
- Added to topic total directly
- Displayed without time column

### Mode Switching
- Hourly → Fixed: Pre-fill fixedFee with calculated hourly amount
- Fixed → Hourly: Recalculate from line items × rate

## Billing Status Logic

### Time Entry States
- **Unbilled**: Not linked to any ServiceDescriptionLineItem
- **In Draft**: Linked to a DRAFT ServiceDescription
- **Billed**: Linked to a FINALIZED ServiceDescription

### Preventing Double-Billing
When creating new ServiceDescription:
```sql
SELECT * FROM time_entries
WHERE clientId = :clientId
  AND date BETWEEN :periodStart AND :periodEnd
  AND id NOT IN (
    SELECT timeEntryId FROM service_description_line_items
    WHERE timeEntryId IS NOT NULL
      AND topicId IN (
        SELECT id FROM service_description_topics
        WHERE serviceDescriptionId IN (
          SELECT id FROM service_descriptions
          WHERE status = 'FINALIZED'
        )
      )
  )
```

Entries in DRAFT service descriptions are still available (draft might be abandoned).

### Delete Draft
- Line items deleted → TimeEntries become unbilled again

### Unlock Finalized
- Status changes to DRAFT
- Entries stay linked until re-finalized or record deleted

## PDF Export

### Format
Matches existing service description format:

**Header**
- "DESCRIPTION OF LEGAL SERVICES" (centered)
- Veda Legal logo (top right)
- Client info (left):
  - `[client.invoicedName or client.name]`
  - `Attn: [client.invoiceAttn]`
  - `Period: [MMM-YY format]`

**Summary Section**
- "Services rendered as per list of services" (underlined)
- Topic → Fee amount (right-aligned)
- Total Fees line with EUR amount

**Detail Sections** (one per topic)
- Topic name (heading, with background color)
- Table: Date | Service | Time
- Footer:
  - Total time
  - Rate or "(fixed)" indicator
  - Fee amount

### Implementation
Use a PDF generation library (e.g., `@react-pdf/renderer` or `jsPDF`) to generate client-side, or server-side with `puppeteer` for exact HTML-to-PDF rendering.

Recommended: `@react-pdf/renderer` for React-native PDF generation with precise control over layout.

## API Endpoints

### Service Descriptions
- `GET /api/billing` - List all service descriptions
- `POST /api/billing` - Create new service description
- `GET /api/billing/[id]` - Get service description with topics and line items
- `PATCH /api/billing/[id]` - Update service description (status changes)
- `DELETE /api/billing/[id]` - Delete draft service description

### Topics
- `POST /api/billing/[id]/topics` - Add topic to service description
- `PATCH /api/billing/[id]/topics/[topicId]` - Update topic (pricing mode, rate, etc.)
- `DELETE /api/billing/[id]/topics/[topicId]` - Delete topic

### Line Items
- `POST /api/billing/[id]/topics/[topicId]/items` - Add line item
- `PATCH /api/billing/[id]/topics/[topicId]/items/[itemId]` - Update line item
- `DELETE /api/billing/[id]/topics/[topicId]/items/[itemId]` - Delete line item

### PDF Export
- `GET /api/billing/[id]/pdf` - Generate and download PDF

## File Structure

```
app/src/
├── app/(authenticated)/billing/
│   ├── page.tsx                 # List page
│   └── [id]/
│       └── page.tsx             # Detail/edit page
├── components/billing/
│   ├── ServiceDescriptionList.tsx
│   ├── CreateServiceDescriptionModal.tsx
│   ├── ServiceDescriptionDetail.tsx
│   ├── TopicSection.tsx
│   ├── LineItemRow.tsx
│   ├── AddLineItemForm.tsx
│   └── ServiceDescriptionPdf.tsx  # PDF template
├── app/api/billing/
│   ├── route.ts                 # GET list, POST create
│   └── [id]/
│       ├── route.ts             # GET, PATCH, DELETE
│       ├── topics/
│       │   ├── route.ts         # POST topic
│       │   └── [topicId]/
│       │       ├── route.ts     # PATCH, DELETE topic
│       │       └── items/
│       │           ├── route.ts # POST item
│       │           └── [itemId]/
│       │               └── route.ts # PATCH, DELETE item
│       └── pdf/
│           └── route.ts         # GET PDF
└── types/billing.ts             # TypeScript interfaces
```

## Out of Scope (Future)

- Invoice generation (separate from service description)
- Email sending from the system
- BGN currency conversion
- Client portal access
- Payment tracking
