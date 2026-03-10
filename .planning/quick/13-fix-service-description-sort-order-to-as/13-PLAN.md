---
phase: 13-fix-service-description-sort-order
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/app/api/billing/route.ts
autonomous: true
requirements:
  - SORT-01

must_haves:
  truths:
    - "Line items within a topic are ordered by date ascending, then by creation time ascending for same-day entries"
    - "displayOrder assigned at SD creation reflects correct chronological order"
  artifacts:
    - path: "app/src/app/api/billing/route.ts"
      provides: "SD creation with correct sort order"
      contains: "asc(timeEntries.createdAt)"
  key_links:
    - from: "app/src/app/api/billing/route.ts"
      to: "timeEntries table"
      via: "orderBy clause in unbilled entries query"
      pattern: "asc\\(timeEntries\\.date\\).*asc\\(timeEntries\\.createdAt\\)"
---

<objective>
Fix service description line item sort order so same-day entries appear in chronological creation order.

Purpose: Currently line items from the same day may appear in arbitrary order within a topic. Adding createdAt as a tiebreaker ensures entries appear in the order they were logged.
Output: Updated POST /api/billing handler with corrected orderBy clause.
</objective>

<execution_context>
@/Users/stefan/.claude/get-shit-done/workflows/execute-plan.md
@/Users/stefan/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/13-fix-service-description-sort-order-to-as/13-CONTEXT.md

<interfaces>
From app/src/app/api/billing/route.ts (line 215):
```typescript
// Current sort order (WRONG — no createdAt tiebreaker):
orderBy: [asc(timeEntries.topicName), asc(timeEntries.date)],
```

From app/src/lib/schema.ts (line 158+):
```typescript
export const timeEntries = pgTable("time_entries", {
  // ...
  createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  // ...
});
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add createdAt as third sort key in SD creation query</name>
  <files>app/src/app/api/billing/route.ts</files>
  <action>
In the POST handler, update line 215 from:
```typescript
orderBy: [asc(timeEntries.topicName), asc(timeEntries.date)],
```
to:
```typescript
orderBy: [asc(timeEntries.topicName), asc(timeEntries.date), asc(timeEntries.createdAt)],
```

This adds `createdAt` as a tiebreaker for entries on the same day within the same topic. The `asc` import is already present (line 2). No other changes needed — the `entries.map((entry, itemIndex)` on line 282 assigns `displayOrder: itemIndex` which will now reflect the correct chronological order since the source array is sorted correctly.
  </action>
  <verify>
    <automated>cd /Users/stefan/projects/veda-legal-timesheets/app && npx tsc --noEmit src/app/api/billing/route.ts 2>&1 | head -20</automated>
  </verify>
  <done>The orderBy clause in POST /api/billing includes three sort keys: topicName asc, date asc, createdAt asc. TypeScript compiles without errors.</done>
</task>

</tasks>

<verification>
- `grep -n "createdAt" app/src/app/api/billing/route.ts` shows createdAt in the orderBy clause
- TypeScript compilation passes
- `npm run build` succeeds (confirms no type errors in production build)
</verification>

<success_criteria>
Line items created for new service descriptions are sorted by topic name, then date ascending, then creation time ascending. Same-day entries within a topic appear in the order they were originally logged.
</success_criteria>

<output>
After completion, create `.planning/quick/13-fix-service-description-sort-order-to-as/13-SUMMARY.md`
</output>
