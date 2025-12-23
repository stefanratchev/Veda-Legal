# Timesheet Entries Table Redesign

## Overview

Redesign the timesheet entries display from a card-based two-row layout to a compact single-row table format.

## Current State

Each entry displays as a card with:
- Row 1: Client badge (pink accent) + topic/subtopic path + duration
- Row 2: Description text

## New Design

### Table Structure

| Client | Topic | Hours | Work | |
|--------|-------|-------|------|-|
| Acme Corp | Company Incorporation | 2h 30m | Drafted shareholder agreement... | 🗑 |
| Beta Ltd | M&A Advisory | 1h 15m | Call with client | 🗑 |

### Column Specifications

| Column | Width | Alignment | Behavior |
|--------|-------|-----------|----------|
| Client | ~150px fixed | Left | Truncate with tooltip if needed |
| Topic | ~180px fixed | Left | Truncate with tooltip if needed |
| Hours | ~60px fixed | Right | Format: "2h 30m" using `formatHours()` |
| Work | Flexible | Left | Text wrapping allowed (row grows) |
| Delete | ~40px fixed | Center | Icon button only |

### Header Row

- Column labels: "Client", "Topic", "Hours", "Work"
- Styling: `text-muted` color, smaller font size
- Bottom border to separate from content

### Footer Row

- Shows "Daily Total" label on left
- Sum displayed on right in pink accent color (`--accent-pink`)
- Same styling as current implementation

### Visual Styling

- Plain text for all data columns (no badges)
- Row hover state for interactivity
- Divider lines between rows
- Consistent with existing design system

### Removed Elements

- Subtopic display (only topic name shown)
- Client badge styling (plain text instead)

## Files to Modify

- `app/src/components/timesheets/EntryCard.tsx` - Convert to table row component
- `app/src/components/timesheets/EntriesList.tsx` - Add table structure with header

## Technical Notes

- Uses existing `formatHours()` from `lib/date-utils.ts`
- Delete confirmation behavior preserved
- No changes to data model or API
