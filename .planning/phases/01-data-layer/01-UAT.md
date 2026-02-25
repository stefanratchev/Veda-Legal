---
status: testing
phase: 01-data-layer
source: 01-01-SUMMARY.md, 01-02-SUMMARY.md
started: 2026-02-24T12:00:00Z
updated: 2026-02-24T12:00:00Z
---

## Current Test

number: 1
name: Reports page loads without errors
expected: |
  Navigate to the Reports page (/reports). The page should load fully without any errors, crashes, or blank screens. Existing charts and data tables should render as before.
awaiting: user response

## Tests

### 1. Reports page loads without errors
expected: Navigate to the Reports page (/reports). The page should load fully without any errors, crashes, or blank screens. Existing charts and data tables should render as before.
result: [pending]

### 2. Reports page data refreshes on client-side navigation
expected: Navigate away from Reports (e.g., to Dashboard) and then back to Reports. The page should load identically — no stale data, no errors. SSR and client-side fetch paths return the same data.
result: [pending]

### 3. Reports API returns topic aggregations
expected: Open browser DevTools (Network tab), reload the Reports page, and find the `/api/reports` request. The response JSON should contain `topics` arrays on `byClient` items (each with `topicName`, `totalHours`, `writtenOffHours`).
result: [pending]

### 4. Revenue excludes non-billable clients
expected: In the API response, check any INTERNAL or MANAGEMENT client in `byClient` — their `revenue` should be `0`. Only REGULAR clients with an `hourlyRate` should have non-zero revenue.
result: [pending]

### 5. Per-employee revenue and billable hours visible
expected: In the API response, `byEmployee` items should have `revenue` and `billableHours` fields (numbers, not null — assuming you're logged in as admin/partner).
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0

## Gaps

[none yet]
