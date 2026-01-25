# Timesheet Submissions Design

## Overview

Enforce daily timesheet submission with 8-hour minimum. Employees must submit their timesheets by 10am the next business day. Overdue submissions are surfaced via persistent global banners.

## Requirements

- Employees must log at least 8 hours before submitting a day's timesheet
- Auto-prompt to submit when 8 hours is reached
- Soft lock after submission (entries remain editable)
- Deadline: 10am next business day (Friday deadline is Monday 10am)
- Weekdays only (Mon-Fri)
- Leave/vacation logged as time entries (no exemptions)
- In-app notifications only (no email)

## Data Model

### New Table: `timesheetSubmissions`

| Column | Type | Description |
|--------|------|-------------|
| id | text (PK) | UUID |
| userId | text (FK) | Reference to users |
| date | date | The workday being submitted (YYYY-MM-DD) |
| submittedAt | timestamp | When the submission occurred |

**Unique constraint:** `(userId, date)` - one submission per user per day.

No changes to `timeEntries` table. Entries remain editable after submission.

## Submission Flow

### Submit Button

- **Enabled:** Total hours >= 8 and no submission exists for that date
- **Disabled:** Total hours < 8 (tooltip: "Log at least 8 hours to submit")
- **Hidden:** Already submitted for that date
- **Location:** Below the entries list for the selected day
- **Display:** Shows current total, e.g., "Submit (8.5 hours)" or "Log 8 hours to submit (5.5 logged)"

### Auto-Prompt Modal

After saving an entry, if:
- New total >= 8 hours, AND
- No submission exists for that date

Show modal: "You've logged 8 hours for [date]. Submit your timesheet?"

Buttons: "Submit" | "Not yet"

### API Endpoint

`POST /api/timesheets/submit`

Request body:
```json
{ "date": "YYYY-MM-DD" }
```

Validation:
- User must be authenticated
- User must have >= 8 hours logged for that date
- No existing submission for that user+date

Response:
- 201: Submission created
- 400: Insufficient hours or already submitted
- 401: Unauthorized

## Submission Revocation

If an entry edit or delete causes total hours to drop below 8:
- Automatically delete the submission record for that date
- Display toast notification: "Your timesheet submission for [date] has been revoked. You now have X.X hours logged (8 required)."

## Overdue Detection

### Definition

A day is overdue when:
1. It is a weekday (Monday-Friday)
2. Current time is past the deadline (next business day 10am)
3. No submission record exists for that user+date

### Deadline Rules

| Workday | Deadline |
|---------|----------|
| Monday | Tuesday 10:00 AM |
| Tuesday | Wednesday 10:00 AM |
| Wednesday | Thursday 10:00 AM |
| Thursday | Friday 10:00 AM |
| Friday | Monday 10:00 AM |

### Lookback Period

Check the last 30 calendar days. Prevents infinite accumulation of old overdue days.

### API Endpoint

`GET /api/timesheets/overdue`

Response varies by role:

**Regular employees:**
```json
{
  "overdue": ["2026-01-22", "2026-01-23"]
}
```

**Admins/Partners:**
```json
{
  "overdue": [
    { "userId": "...", "name": "John Doe", "dates": ["2026-01-22", "2026-01-23"] },
    { "userId": "...", "name": "Jane Smith", "dates": ["2026-01-24"] }
  ]
}
```

## Global Banner UI

### Placement

- Rendered in root layout, above main content area
- Appears on every page when overdue days exist
- Persistent (cannot be dismissed)
- Polls every 5 minutes to update status

### Employee Banner

- Red/danger background color
- Text: "You have overdue timesheets for: Mon Jan 20, Wed Jan 22"
- Clicking banner navigates to timesheets page

### Admin/Partner Banner

- Red/danger background color
- Text: "Overdue timesheets: John Doe (2 days), Jane Smith (1 day)"
- View only, no drill-down links
- If admin has personal overdue days, show both banners (personal + team)

## WeekStrip Visual Indicators

Icons displayed below the day number in each WeekStrip cell:

| State | Icon |
|-------|------|
| Submitted | Green checkmark |
| Overdue | Red clock |
| Everything else | No icon |

Icons should be large enough to be immediately visible.

## Edge Cases

### Zero entries for a weekday

Treated the same as partial entries - if no submission and past deadline, it's overdue.

### Weekend days

Saturday and Sunday are excluded. No submission required.

### Leave/Vacation

Must be logged as time entries (using a leave-type client/topic). No special exemptions.

## Implementation Notes

### Files to Create/Modify

**Schema:**
- `app/src/lib/schema.ts` - Add `timesheetSubmissions` table

**API Routes:**
- `app/src/app/api/timesheets/submit/route.ts` - POST handler for submission
- `app/src/app/api/timesheets/overdue/route.ts` - GET handler for overdue check
- `app/src/app/api/timesheets/route.ts` - Modify PATCH/DELETE to check for revocation

**Components:**
- `app/src/components/timesheets/SubmitButton.tsx` - Submit button with hours display
- `app/src/components/timesheets/SubmitPromptModal.tsx` - Auto-prompt modal
- `app/src/components/layout/OverdueBanner.tsx` - Global banner component
- `app/src/components/timesheets/WeekStrip.tsx` - Add submission status icons

**Layout:**
- `app/src/app/(authenticated)/layout.tsx` - Include OverdueBanner

### Testing

- Unit tests for deadline calculation logic
- Unit tests for overdue detection
- Integration tests for submit/revoke flow
- Component tests for banner and WeekStrip indicators
