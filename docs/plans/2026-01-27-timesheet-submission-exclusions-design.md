# Timesheet Submission Exclusions by Position

## Summary

Exclude ADMIN and CONSULTANT positions from timesheet overdue tracking. Only PARTNER, SENIOR_ASSOCIATE, and ASSOCIATE are required to submit timesheets daily.

## Requirements

- ADMINs and CONSULTANTs should not see overdue warnings
- ADMINs and CONSULTANTs should be excluded from the team overdue summary
- These positions can still voluntarily submit timesheets (no blocking)

## Design

### New Position Group

Add to `lib/api-utils.ts`:

```typescript
// Positions required to submit timesheets daily
const TIMESHEET_REQUIRED_POSITIONS = ["PARTNER", "SENIOR_ASSOCIATE", "ASSOCIATE"] as const;

export function requiresTimesheetSubmission(position: string): boolean {
  return TIMESHEET_REQUIRED_POSITIONS.includes(position as (typeof TIMESHEET_REQUIRED_POSITIONS)[number]);
}
```

### API Changes

**`/api/timesheets/overdue/route.ts`:**

1. For admin team view: Filter `activeUsers` to only include positions where `requiresTimesheetSubmission()` returns true

2. For regular users: Return empty array immediately if `!requiresTimesheetSubmission(user.position)`

### UI Changes

None required. `OverdueBanner` already handles empty arrays by returning null.

## Test Cases

1. CONSULTANT user gets empty overdue array
2. ADMIN user sees team data but is excluded from personal overdue
3. Team overdue list excludes ADMIN and CONSULTANT users
4. PARTNER, SENIOR_ASSOCIATE, ASSOCIATE tracked normally
