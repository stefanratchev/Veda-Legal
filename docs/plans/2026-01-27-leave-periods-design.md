# Leave Periods Design

## Problem

When employees go on extended leave (maternity, multi-week vacations), they accumulate many "overdue" timesheet days. Upon returning, they face:
1. Tedious day-by-day submission of empty days
2. Misleading overdue status banners
3. False positives in manager overdue reports

## Solution

Add leave period tracking with an approval workflow. Employees request leave (prospectively or retroactively), admins approve, and approved leave dates are excluded from overdue calculations.

## Data Model

### New Enums

```typescript
leaveType: 'VACATION' | 'SICK_LEAVE' | 'MATERNITY_PATERNITY'
leaveStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
```

### New Table: `leavePeriods`

| Column | Type | Description |
|--------|------|-------------|
| id | text | Primary key |
| userId | text | FK to users |
| startDate | date | First day of leave |
| endDate | date | Last day of leave |
| leaveType | leaveType | Vacation, Sick Leave, Maternity/Paternity |
| status | leaveStatus | Pending, Approved, Rejected |
| reason | text (nullable) | Optional note from employee |
| reviewedById | text (nullable) | FK to users - who approved/rejected |
| reviewedAt | timestamp (nullable) | When approved/rejected |
| rejectionReason | text (nullable) | Optional explanation if rejected |
| createdAt | timestamp | When requested |
| updatedAt | timestamp | Last modified |

## API Endpoints

### `GET /api/leave`
- Returns leave periods for current user (or all if Admin/Partner)
- Query params: `status` filter, `userId` filter (admin only)

### `POST /api/leave`
- Create a new leave request
- Body: `{ startDate, endDate, leaveType, reason? }`
- Any authenticated user can create for themselves
- Admin/Partner can create pre-approved requests for anyone

### `PATCH /api/leave/[id]`
- Update a leave request
- Employee can edit their own pending requests
- Admin/Partner can approve/reject: `{ status: "APPROVED" }` or `{ status: "REJECTED", rejectionReason?: "..." }`

### `DELETE /api/leave/[id]`
- Cancel/delete a leave request
- Employee can delete their own pending requests
- Admin/Partner can delete any request

## UI

### New Page: `/leave`

Located in `(authenticated)` route group, accessible to all users.

**For regular employees:**
- "Request Leave" button at top
- List of their leave requests with status badges
- Can edit or cancel pending requests

**For Admin/Partner (additional content):**
- "Pending Approvals" section showing requests awaiting review
- Each shows: employee name, dates, type, reason
- Approve/Reject buttons (reject optionally accepts reason)
- Full list of all leave periods (filterable by employee, status)

**Request Leave Modal:**
- Date range picker (start date, end date)
- Leave type dropdown
- Optional reason text field
- Submit button

### Sidebar
- Add "Leave" link below "Timesheets" for all users

## Overdue Integration

### Changes to `submission-utils.ts`

`getOverdueDates()` accepts approved leave periods for the user. Dates within approved leave periods are skipped (like weekends).

### Changes to overdue API routes

- Personal overdue endpoint fetches user's approved leave periods
- Team overdue endpoint fetches approved leave for all relevant users

### OverdueBanner
- No changes needed - already displays what API returns
- Approved leave days won't appear in overdue count

## Validation Rules

- Start date must be ≤ end date
- Cannot request leave for dates with already-submitted timesheets
- Cannot create overlapping leave periods for same user
- Weekends within leave range are ignored (already excluded)

## Edge Cases

- **Employee edits pending request:** Allowed until approved/rejected
- **Partial overlap with existing leave:** Reject, ask to adjust dates
- **Admin creates leave for someone:** Auto-approved, no workflow

## Out of Scope (YAGNI)

- Leave balance tracking
- Calendar integration
- Email notifications
- Half-day leave
- Public holiday management
