# Phase 8: Data Layer Foundation - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Extended types, aggregation utilities, and filter logic enabling the Detail tab. Deliverables: `ReportEntry` type with `subtopicName` and `revenue` fields, per-entry revenue computation server-side, pure utility functions (`filterEntries`, `aggregateByClient`, `aggregateByEmployee`, `aggregateByTopic`) with full test coverage. No UI components in this phase.

</domain>

<decisions>
## Implementation Decisions

### Revenue per entry
- All REGULAR client entries: revenue = `hourlyRate * hours`, regardless of retainer status
- Revenue is `number | null` — returned as `null` for non-admin users (no client-side rate exposure)
- Written-off entries on REGULAR clients: revenue excluded from totals (matches existing behavior)
- INTERNAL/MANAGEMENT entries: non-billable, revenue not applicable

### Written-off entry handling
- Written-off entries ARE included in hours aggregations (Hours by Client/Employee/Topic charts)
- Written-off entries are EXCLUDED from revenue aggregations (Revenue charts show only effective revenue)
- The `isWrittenOff` flag must be present on the entry type so the UI can render visual distinction in Phase 10
- No separate filter toggle for written-off entries — they're always visible alongside normal entries

### Aggregation output shape
- Each aggregation function returns: `{ id: string, name: string, totalHours: number, revenue: number | null }`
- Results sorted by `totalHours` descending (biggest contributors first)
- No top-N limit — return all entities (data volume is trivially small: ~200 clients, ~10 employees)
- No entry count or percentage fields — charts only need label + value
- IDs are included to enable chart-click-to-filter in Phase 11 (CHRT-07)

### Filter composition
- AND across dimensions, OR within: entry must match ANY selected client AND ANY selected employee AND ANY selected topic
- "Empty Set = show all" convention: if no clients are selected, all clients pass; same for employees and topics
- Date range filtering stays server-side (API query parameter) — `filterEntries` only handles client/employee/topic
- Filter options (available choices in dropdowns) are derived from entries in the current date range, not a static list

### Claude's Discretion
- INTERNAL/MANAGEMENT entry revenue: null vs explicit zero (recommend null for consistency)
- Written-off entry revenue: null vs computed-but-excluded (recommend null)
- REGULAR clients with no hourly rate set: revenue null vs zero (recommend null — "unknown" vs "free")
- Filter parameter type: Sets vs arrays for filter values (success criteria specifies Sets)
- Exact function signatures and internal implementation details

</decisions>

<specifics>
## Specific Ideas

- Revenue calculation mirrors existing `report-utils.ts` logic (line 144): `!isWrittenOff && isBillable && clientRate > 0`
- Aggregation sort order matches existing `byClient`/`byEmployee` patterns (sorted by `totalHours` descending)
- Filter architecture: date range = server-side query, entity filters = client-side pure functions

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-data-layer-foundation*
*Context gathered: 2026-02-25*
