# Timesheet Calendar Enhancements Design

## Overview

Enhance the timesheet date navigation to be more flexible for employees by:
1. Showing all 7 days in the week strip (including weekends)
2. Allowing time entries for future dates
3. Replacing the month dropdown with a mini calendar popup

## Changes

### 1. Week Strip: 7-Day View

**Current:** Week strip shows Mon–Fri (5 days)

**New:** Week strip shows Mon–Sun (7 days)

**Implementation:**
- Modify `getWeekDays()` in `lib/date-utils.ts` to return 7 days instead of 5
- Adjust day cell padding (`px-3` → `px-2`) to accommodate extra days
- Weekend days use same styling with slightly muted text color for visual distinction

### 2. Enable Future Dates

**Current:** Future dates are disabled; "Next Week" button restricted

**New:** No date restrictions; users can navigate forward and log time for upcoming dates

**Implementation:**
- Remove `isFuture()` disable logic in `WeekStrip.tsx` (line 80, 88-89)
- Remove `canGoNext` restriction (line 61, 119)
- Update `goToNextWeek()` in `TimesheetsContent.tsx` to allow unrestricted forward navigation

### 3. Mini Calendar Popup

**Current:** Month dropdown shows list of recent 6 months

**New:** Calendar icon button opens a mini calendar popup

**Popup structure:**
```
┌─────────────────────────────────┐
│  ←    December 2024    →        │  Header with nav arrows
├─────────────────────────────────┤
│  Mo  Tu  We  Th  Fr  Sa  Su     │  Day headers
├─────────────────────────────────┤
│                           1  •  │
│   2   3   4   5   6   7   8     │  Days with entry dots
│   9  10  11  12  13  14  15     │
│  16  17  18  19 [20] 21  22     │  Selected day highlighted
│  23  24  25  26  27  28  29     │
│  30  31                         │
└─────────────────────────────────┘
```

**Behavior:**
- Opens on click, closes on outside click (reuse `useClickOutside` hook)
- Left/right arrows navigate months (no limit)
- Clicking a day selects it, updates the week strip, closes popup
- Today has ring outline; selected day has pink accent background
- Days with entries show small dot indicator

**Styling:**
- `--bg-elevated` background
- `--border-subtle` borders
- `animate-fade-up` entrance animation
- Matches existing dark theme

## Data Fetching

**Existing endpoint:** `/api/timesheets/dates?year=X&month=Y` returns array of date strings

**Mini calendar approach:**
- Fetch entry dates when popup opens or user navigates to new month
- Cache fetched months in component state (`Map<string, Set<string>>`)
- Show calendar grid immediately; dots appear when data arrives

## Files to Modify

| File | Changes |
|------|---------|
| `lib/date-utils.ts` | Update `getWeekDays()` to return 7 days |
| `components/timesheets/WeekStrip.tsx` | Remove future restrictions, adjust padding, add mini calendar popup |
| `components/timesheets/TimesheetsContent.tsx` | Update `goToNextWeek()` to remove future date limit |

## What Stays the Same

- Entry form, entries list, team timesheets section
- Pink accent styling, "Today" button
- API endpoints — no modifications needed
- Database schema — no changes

## Testing Considerations

- Verify 7-day layout doesn't overflow on narrow screens
- Test future date entry creation works end-to-end
- Test mini calendar month navigation and date selection
- Verify entry dots display correctly in both week strip and mini calendar
