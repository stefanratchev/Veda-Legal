---
milestone: v1.0 Billing Improvements
slug: 01-add-date-filter-and-search-to-ready-to-bill-add-bulk-waive
shipped_at: 2026-03-12
phases: 2
plans: 3
---

# Shipped: v1.0 Billing Improvements

## Summary

Added date range filter, client name search, and bulk waive functionality to the Ready to Bill page.

## Phases

- Phase 1: Add date filter and search to Ready to Bill (completed in GSD)
- Phase 2: Add bulk waive option to Ready to Bill (2 plans, 5 tasks, 5 commits)

## Key Deliverables

- DateRangePicker and search input on Ready to Bill tab
- Summary stats bar showing filtered totals
- `PATCH /api/timesheets/bulk-waive` admin-only API endpoint
- Three-dot options menu on client cards with "Write Off All" action
- ConfirmModal integration with date-range-scoped confirmation
- 48 new tests (16 API + 32 component)
