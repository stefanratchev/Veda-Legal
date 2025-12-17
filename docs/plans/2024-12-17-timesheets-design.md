# Timesheets Entry Page Design

## Overview

A simple timesheet entry page for employees to log their work hours. Designed for minimal friction — employees select a date, pick a client, enter duration, and describe what they did.

## Page Layout

### Structure

1. **Calendar (top)** — visual month calendar. Today highlighted. Clicking any date selects it. Selected date marked with gold border. Days with existing entries show a small gold dot.

2. **Selected date header** — displays active date (e.g., "Tuesday, 17 December 2024")

3. **Entry form** — fields for new entries (uses selected date automatically)

4. **Entries list** — all entries for the selected date

5. **Daily total** — sum of hours for the selected date (e.g., "Total: 6h 15m")

### Calendar Behavior

- Shows current month by default
- Arrow buttons for previous/next month navigation
- Past dates and today are selectable
- Future dates are not selectable
- Page loads with today selected

## Entry Form

**Fields:**

| Field | Type | Details |
|-------|------|---------|
| Client | Searchable dropdown | Shows `timesheetCode - clientName`. Only ACTIVE clients. |
| Duration | Two dropdowns | Hours: 0-8 (default 1). Minutes: 00, 15, 30, 45 (default 00). |
| Description | Text area | Placeholder: "What did you do?" Minimum 10 characters. |

**Submit button:** "Add Entry"

**After submit:** Form clears, new entry appears in list below.

## Entries List

Each entry displays:
- Client code and name
- Duration (e.g., "1h 30m")
- Description text
- Edit and Delete icons

### Edit Flow

1. Click edit icon
2. Entry expands inline into editable form
3. Save/Cancel buttons appear
4. Save updates entry, Cancel collapses back

### Delete Flow

1. Click delete icon
2. Confirmation: "Delete this entry?"
3. Confirm deletes, Cancel keeps it

### Empty State

"No entries for this date. Add one above."

## Schema Changes

Remove `billable` and `rate` fields from TimeEntry:

```prisma
model TimeEntry {
  id          String   @id @default(cuid())
  date        DateTime @db.Date
  hours       Decimal  @db.Decimal(4, 2)
  description String

  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  clientId    String
  client      Client   @relation(fields: [clientId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId])
  @@index([clientId])
  @@index([date])
  @@map("time_entries")
}
```

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/timesheets?date=YYYY-MM-DD` | Fetch entries for a date (current user) |
| POST | `/api/timesheets` | Create new entry |
| PUT | `/api/timesheets/[id]` | Update entry |
| DELETE | `/api/timesheets/[id]` | Delete entry |

All endpoints scoped to logged-in user's own entries only.

## Navigation & Permissions

**Navigation:**
- Add "Timesheets" to sidebar between Dashboard and Clients
- Use clock/timesheet icon

**Permissions:**
- All employees can access `/timesheets`
- Users only see and edit their own entries
- No role-based restrictions on this page
