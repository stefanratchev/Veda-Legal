# Phase 1: Data Layer - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the reports API to return topic aggregations and revenue calculations. The API already returns byClient (with revenue), byEmployee, and entries arrays. This phase adds topicName to entries, topics arrays inside byClient/byEmployee items, revenue on byEmployee, and fixes existing revenue calculations for consistency. No new endpoints — this extends the existing GET /api/reports response.

</domain>

<decisions>
## Implementation Decisions

### Written-off entry handling
- Written-off entries (isWrittenOff=true) are **included in hours totals** but **excluded from revenue calculations**
- Written-off entries **appear in the entries array** with isWrittenOff flag visible
- In topic aggregations, written-off hours appear **under their real topic** (not a separate pseudo-topic)
- Each topic item in the topics array carries a **writtenOffHours** field alongside totalHours so UI can distinguish
- Summary-level includes **totalWrittenOffHours** field for write-off visibility
- All revenue fields (summary.totalRevenue, byClient.revenue, byEmployee.revenue) consistently **exclude written-off entry hours**

### Missing data handling
- Clients with null hourlyRate: **revenue = 0** (not null)
- Entries with empty or null topicName: resolve to **"Uncategorized"** — this applies both on individual entries AND as a topic item in the topics array
- INTERNAL/MANAGEMENT clients: **included in byClient** with revenue = 0, with a **clientType field** so the UI can separate billable from non-billable
- Employee items: include **billableHours** field alongside totalHours to distinguish billable from internal/management work

### Comparison period support
- **Extend existing response shape** — no comparison-specific API changes
- Frontend already calls the API twice with different date ranges for comparison; this pattern continues for revenue/topic data
- **Fix existing revenue calculations** (summary.totalRevenue, byClient.revenue) to be consistent with new rules: exclude written-off entries, INTERNAL/MANAGEMENT = 0

### Entry data enrichment
- Entries include **isWrittenOff** flag for UI styling/filtering
- Entries include **clientType** for filtering billable vs internal
- **Return all entries** for the date range; frontend handles pagination (appropriate for ~10-person firm)

### Claude's Discretion
- Whether to include per-entry revenue (hourlyRate x hours) on individual entries, or let frontend derive it from client data
- Whether to add potentialRevenue (including written-off) alongside revenue on byClient items
- Employee revenue calculation consistency with written-off exclusion (recommended: keep consistent — exclude written-off from employee revenue too)
- Exact field naming conventions for new response fields

</decisions>

<specifics>
## Specific Ideas

- All revenue fields must tell the same story: exclude written-off entries, INTERNAL/MANAGEMENT = 0, null rates = 0
- "Uncategorized" is a real topic item in aggregations, not just a label on entries
- The firm is ~10 employees, ~200 clients — data volumes are small enough that returning all entries without server-side pagination is fine

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-data-layer*
*Context gathered: 2026-02-24*
