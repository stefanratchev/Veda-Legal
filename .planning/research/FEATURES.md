# Feature Research

**Domain:** Legal practice management reporting dashboards
**Researched:** 2026-02-24
**Confidence:** MEDIUM — based on competitor analysis (Clio, PracticePanther, Smokeball, MyCase, Rocket Matter), industry KPI literature, and existing codebase review. No direct user testing or analytics data available.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = partners/admins feel the reports page is incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Revenue by Client chart (estimated)** | Every legal PM tool shows revenue per client. Partners need to know which clients generate the most revenue. Clio, MyCase, and others all provide this. | LOW | Already have `hourlyRate * hours` calculation in the API. Just need a new chart on overview using existing `byClient` data with `revenue` field. |
| **Revenue by Employee chart (estimated)** | Originating/responsible attorney revenue attribution is a core Clio report type. Partners evaluate attorney performance partly on revenue generated. | MEDIUM | Need to compute per-employee revenue. Requires joining employee hours with client rates. Not in current API response — need to aggregate `entry.hours * client.hourlyRate` per employee. |
| **Topic breakdown in client drill-down** | When drilling into a client, the first question is "what work was done?" Matter/practice-area breakdown is standard in Clio matter reports, Smokeball firm insights, and legal PM broadly. | MEDIUM | `timeEntries` already stores `topicId` and `topicName`. Need to aggregate hours by topic for the selected client within the date range. New summary section at top of client drill-down. |
| **All entries in drill-down tables (not last 10)** | Current 10-entry limit frustrates any real analysis. Every competitor shows full entry lists with pagination or scroll. LawWare, Actionstep, and others show complete entry lists. | LOW | Remove `.slice(0, 10)` from both `ByEmployeeTab` and `ByClientTab`. Consider virtual scrolling or simple pagination if entry count exceeds ~200. |
| **Topic column in entry tables** | When viewing entries, users need to see what type of work was done. Standard column in time entry lists across Clio, Actionstep, and all competitors. | LOW | `topicName` is already on `timeEntries` but not included in the API response or table columns. Add to query, API response, and table render. |
| **Hours over time trend in client drill-down** | Time trends answer "is this client's workload increasing or decreasing?" Standard in Clio and MyCase dashboard views. | MEDIUM | Need to aggregate hours by date/week/month for selected client. Use existing `BarChart` component in horizontal layout (date on x-axis). |
| **Hours over time trend in employee drill-down** | Already exists as "Hours by Day" chart. Confirmed working in current codebase. | ALREADY EXISTS | Current `ByEmployeeTab` already shows `dailyHours` chart. Keep as-is. |
| **Topic breakdown in employee drill-down** | Cross-client topic breakdown answers "what type of work does this person spend time on?" Practice-area analysis per attorney is a standard Clio productivity report. | MEDIUM | Aggregate `topicName` across all of an employee's entries in the period. New chart section in employee drill-down. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable for a small firm.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Actual billed revenue (from finalized SDs)** | Most small-firm tools only show estimated revenue (rate x hours). Showing actual billed amount from finalized service descriptions — accounting for discounts, caps, waivers, and retainer logic — gives a true picture. This bridges the gap between "what we could bill" and "what we did bill." | HIGH | Requires querying `serviceDescriptions` (status = FINALIZED) for the selected period, running `calculateGrandTotal()` / `calculateRetainerGrandTotal()` from `billing-pdf.tsx` for each, and aggregating. Complex because retainer vs. non-retainer SDs use different calculation paths. Must handle: SD period may not align with report period; one client may have multiple SDs in a period. |
| **Estimated vs. actual revenue comparison** | Showing the delta between estimated and actual billed revenue surfaces write-offs, discounts, and retainer absorption at a glance. This is the "realization rate" concept that Clio tracks as a premium KPI — but here it's derived naturally from the existing billing system rather than requiring manual write-off tracking. | MEDIUM | Depends on actual billed revenue feature above. Once both numbers exist, showing them side-by-side (or as a comparison metric) is straightforward. Could use stacked/grouped bar chart or summary card with delta. |
| **Clickable chart-to-drill-down navigation** | Clicking a bar in "Hours by Employee" already navigates to the employee drill-down. Extending this pattern to revenue charts and topic charts creates a fluid exploration experience. Most competitors require navigating to separate report pages. | LOW | Pattern already exists (`onEmployeeClick`, `onClientClick`). Just wire up new charts with same handlers. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems, especially for a ~10 person firm with ~200 clients.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Custom report builder / drag-and-drop report designer** | "I want to build any report I need." Clio's premium tier offers this. | Massive implementation cost. For a 10-person firm, the number of useful report configurations is small and knowable. Custom report builders are used by <10% of users even in large firms (per Clio's own usage data suggesting most use prebuilt reports). Adds UI complexity, testing burden, and maintenance overhead disproportionate to the user base. | Build the 5-8 specific views that matter. If a new view is needed, add it as a feature rather than building a meta-tool. |
| **Utilization rate / billable vs. non-billable breakdown** | Industry standard KPI (avg 38% per Clio 2025 benchmarks). Sounds essential. | Requires classifying all time as "billable" or "non-billable" — which the current system does via `ClientType` (REGULAR vs INTERNAL/MANAGEMENT) but the report would need careful handling. More importantly: explicitly declared out of scope in PROJECT.md. The firm has not requested this. | Defer entirely. If needed later, the data model supports it (client type classification exists). Not worth building speculatively. |
| **Collected revenue tracking (payments received)** | The full legal billing pipeline is: worked -> billed -> collected. Clio tracks all three. | Requires a payment/collection tracking system that does not exist in this app. Service descriptions track "billed" but there is no payment recording, no accounts receivable, no aging reports. Building this is an entirely new domain. | Show estimated (rate x hours) and actual billed (from finalized SDs). Collection tracking is a separate future initiative if the firm adopts the app for accounting. |
| **CSV/PDF export of reports** | Partners want to share reports in meetings. Explicitly listed as out of scope in PROJECT.md. | Not inherently bad, but adds scope to a milestone already focused on data visualization improvements. Export formatting (page breaks, headers, summaries) is surprisingly time-consuming to get right. | Defer to a future milestone as PROJECT.md states. Browser print (Ctrl+P) works as a stopgap. |
| **Predictive analytics / AI forecasting** | "Predict next month's revenue." Emerging trend in legal PM tools. | Requires historical data depth that a new system won't have. Predictions from small datasets are unreliable and misleading. For 10 employees and 200 clients, a partner's intuition is more accurate than any model trained on <1 year of data. | Show trends (hours over time) and let humans extrapolate. Trends are honest; predictions from thin data are not. |
| **Real-time / live-updating dashboards** | "See entries as they're logged." Sounds modern. | For 10 concurrent users, real-time adds WebSocket infrastructure complexity for negligible benefit. Reports are analytical tools used periodically, not operational monitors. The data changes meaningfully at most a few times per day per user. | Fetch on page load and on date range change (current approach). Add a manual refresh button if needed. Polling at 60s intervals is the absolute maximum justified complexity. |
| **Mobile-specific report layouts** | "View reports on my phone." Explicitly out of scope in PROJECT.md. | Reports are analytical tools used at a desk with a large screen. The charts and tables are fundamentally desktop experiences. Responsive tweaks add complexity to every chart and table component. | Defer entirely. The firm did not request this. If needed, tackle as a separate responsive design pass, not interleaved with feature work. |

## Feature Dependencies

```
[Topic column in entry tables]
    (no dependencies, standalone data addition)

[All entries in drill-down tables]
    (no dependencies, remove slice limit)

[Revenue by Client chart (estimated)]
    (no dependencies, data already in API response)

[Revenue by Employee chart (estimated)]
    └──requires──> API change to compute per-employee revenue

[Topic breakdown in client drill-down]
    └──requires──> API to include topicId/topicName in entries response

[Topic breakdown in employee drill-down]
    └──requires──> API to include topicId/topicName in entries response

[Hours over time trend in client drill-down]
    └──requires──> Per-client daily hours aggregation (similar to existing employee dailyHours)

[Actual billed revenue from finalized SDs]
    └──requires──> New API query joining serviceDescriptions + billing calculation functions
                       └──requires──> Understanding of billing-pdf.tsx calculation functions

[Estimated vs. actual revenue comparison]
    └──requires──> [Actual billed revenue from finalized SDs]
    └──requires──> [Revenue by Client chart (estimated)]
```

### Dependency Notes

- **Topic column & topic breakdowns require the same API change:** Adding `topicId`/`topicName` to the entries response unlocks both the table column and the breakdown aggregations. Do this once.
- **Revenue by Employee requires new aggregation:** Current API computes revenue per client but not per employee. Need to sum `hours * clientRate` grouped by employee.
- **Actual billed revenue is the hardest feature:** It requires understanding the full billing calculation pipeline including retainer logic, discounts, caps, and waivers. The functions exist in `billing-pdf.tsx` but they operate on serialized `ServiceDescription` objects, not raw DB rows — so the API needs to fetch, serialize, and calculate.
- **Estimated vs. actual comparison is cheap once actual exists:** It's just displaying two numbers side by side. The hard work is in computing the "actual" number.

## MVP Definition

### Launch With (v1)

Minimum viable improvement — what's needed to make the reports page genuinely useful for this milestone.

- [x] Revenue by Client chart (estimated) — already have the data, just need the chart
- [x] Revenue by Employee chart (estimated) — new aggregation but straightforward
- [x] Topic column in entry tables — trivial addition, high information value
- [x] All entries in drill-down tables — remove artificial limit, immediate usability win
- [x] Topic breakdown in client drill-down — summary section showing hours per topic
- [x] Topic breakdown in employee drill-down — cross-client topic distribution
- [x] Hours over time trend in client drill-down — new chart, existing chart component

### Add After Validation (v1.x)

Features to add once core charts and drill-downs are working and validated with actual users.

- [ ] Actual billed revenue from finalized SDs — add once users confirm the estimated revenue charts are useful and want to see the billed/estimated delta
- [ ] Estimated vs. actual revenue comparison — natural follow-on to actual billed revenue

### Future Consideration (v2+)

Features to defer until there's clear demand.

- [ ] CSV/PDF export — explicit out-of-scope per PROJECT.md
- [ ] Utilization rate — not requested, defer
- [ ] Collection tracking — requires new domain (payments), not in scope

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| All entries in drill-down tables | HIGH | LOW | P1 |
| Topic column in entry tables | HIGH | LOW | P1 |
| Revenue by Client chart (estimated) | HIGH | LOW | P1 |
| Topic breakdown in client drill-down | HIGH | MEDIUM | P1 |
| Hours over time trend in client drill-down | MEDIUM | MEDIUM | P1 |
| Revenue by Employee chart (estimated) | HIGH | MEDIUM | P1 |
| Topic breakdown in employee drill-down | MEDIUM | MEDIUM | P1 |
| Actual billed revenue (from finalized SDs) | HIGH | HIGH | P2 |
| Estimated vs. actual revenue comparison | MEDIUM | MEDIUM (after P2 above) | P2 |

**Priority key:**
- P1: Must have for this milestone (matches PROJECT.md Active requirements)
- P2: Should have, add when possible (extends revenue reporting value)
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Clio | MyCase | Smokeball | Our Approach |
|---------|------|--------|-----------|--------------|
| Revenue by client | Yes, in revenue reports | Yes, in financial dashboard | Limited | Chart in overview tab (estimated + actual billed) |
| Revenue by attorney | Yes, originating attorney revenue report | Yes, per-attorney billing | Limited, document-focused | Revenue by employee chart in overview |
| Matter/topic breakdown | Yes, matter reports with practice area grouping | Practice type segmentation | Matter type breakdown | Topic breakdown in client and employee drill-downs |
| Time trends | Yes, via custom reports | Monthly charts | Yes, in firm insights | Hours over time charts in client drill-down |
| Entry detail tables | Full entry lists with filters | Full lists | Full lists | All entries with topic column (removing 10-entry limit) |
| Estimated vs billed | Realization rate as KPI | Billed vs collected | Not prominent | Estimated vs actual billed comparison |
| Drill-down navigation | Separate report pages | Separate pages | Separate pages | In-page drill-down via chart clicks (smoother UX) |
| Export | CSV, PDF | CSV, PDF | PDF | Deferred (browser print as stopgap) |
| Custom report builder | Yes (premium tier) | Limited | Limited | Deliberately not building (anti-feature) |

## Sources

- [Clio Financial Reporting](https://www.clio.com/features/law-firm-financial-reporting/) — MEDIUM confidence, feature descriptions from marketing page
- [Clio Revenue Reports](https://help.clio.com/hc/en-us/articles/14352205073051-Clio-Manage-Revenue-Reports) — MEDIUM confidence, help article (blocked by 403, used search snippet)
- [Clio 62 Essential KPIs](https://www.clio.com/blog/law-firm-kpis/) — MEDIUM confidence, industry benchmarks (38% utilization, 88% realization)
- [Law Firm Financial Dashboards: Turning Data into Decisions](https://www.lawfirmvelocity.com/post/financial-dashboard) — MEDIUM confidence, best practices for dashboard design
- [MyCase Financial Dashboard](https://www.mycase.com/blog/law-firm-financial-management/financial-dashboard/) — MEDIUM confidence, dashboard feature recommendations
- [BigHand 5 Revenue Metrics](https://www.bighand.com/en-us/resources/blog/five-revenue-metrics-all-law-firm-leaders-need-to-know-and-track/) — MEDIUM confidence, revenue metric definitions
- [Smokeball Reporting](https://www.smokeball.com/features/legal-reporting-software) — LOW confidence, limited detail from search snippets
- [Rocket Matter Key Reports](https://www.rocketmatter.com/blog/six-key-reports-for-better-law-practice-management/) — LOW confidence, limited detail
- Existing codebase analysis — HIGH confidence, direct code review of reports API, components, schema, and billing utilities

---
*Feature research for: Legal practice management reporting dashboards*
*Researched: 2026-02-24*
