# Phase 2: Overview Revenue Charts - Context

**Gathered:** 2026-02-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add "Revenue by Client" and "Revenue by Employee" charts to the Reports overview tab, visible only to Admin/Partner users. Revenue is calculated as hourlyRate x hours (no service description integration). Charts respect the selected date range and comparison period.

</domain>

<decisions>
## Implementation Decisions

### Chart placement & layout
- Paired rows: Hours by Client | Revenue by Client on row 1, Hours by Employee | Revenue by Employee on row 2
- No extra section headings — each chart has its own title label (e.g., "Revenue by Client")
- On narrow/mobile screens, paired charts stack vertically (hours above revenue)

### Chart visual style
- Revenue charts use vertical bar charts (distinct from existing horizontal bar hours charts)
- Distinct accent color for revenue bars — separate from coral pink used for hours (e.g., green/teal for money)
- Show top 10 clients/employees by revenue, group the rest as "Other"
- EUR labels abbreviated for large values (€12.5K, €1.2M); tooltip shows exact amount

### Comparison period display
- % change badge on each bar when comparison period is active (matches existing hours chart pattern)
- Clients/employees with zero revenue in current period are excluded from the chart (even if they had revenue in comparison period)
- New clients/employees with no comparison period data show no badge (omit rather than "New" label)
- Tooltip shows: current value + % change only (e.g., "€12,450 (+22%)"), not both absolute values

### Non-admin experience
- Revenue charts are not rendered at all for non-admin users (no empty placeholders)
- Hours charts remain at half width even when revenue charts are absent (consistent card size across roles)

### Claude's Discretion
- Exact accent color choice for revenue bars (within the dark theme design system)
- Loading skeleton design for revenue charts
- Error/empty state handling (no revenue data for period)
- Exact spacing, padding, and typography within charts

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow existing Recharts patterns from the hours charts.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-overview-revenue-charts*
*Context gathered: 2026-02-24*
