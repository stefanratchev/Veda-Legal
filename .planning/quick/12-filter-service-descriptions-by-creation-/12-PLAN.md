---
phase: quick-12
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/app/api/billing/route.ts
  - app/src/app/(authenticated)/(admin)/billing/page.tsx
  - app/src/components/billing/BillingContent.tsx
  - app/src/components/billing/BillingContent.test.tsx
autonomous: true
requirements: [QUICK-12]

must_haves:
  truths:
    - "Date picker on service descriptions tab filters by createdAt timestamp, not by periodStart"
    - "Selecting 'This Month' shows service descriptions created during the current month regardless of their period column"
    - "Selecting 'All Time' shows all service descriptions with no date constraint"
    - "Custom date range filters by creation date"
  artifacts:
    - path: "app/src/app/api/billing/route.ts"
      provides: "GET endpoint filtering by createdAt instead of periodStart"
      contains: "serviceDescriptions.createdAt"
    - path: "app/src/app/(authenticated)/(admin)/billing/page.tsx"
      provides: "Server-side pre-filter using createdAt"
      contains: "serviceDescriptions.createdAt"
    - path: "app/src/components/billing/BillingContent.tsx"
      provides: "Client sends createdFrom/createdTo params"
      contains: "createdFrom"
  key_links:
    - from: "app/src/components/billing/BillingContent.tsx"
      to: "/api/billing"
      via: "fetch with createdFrom/createdTo query params"
      pattern: "createdFrom|createdTo"
    - from: "app/src/app/api/billing/route.ts"
      to: "serviceDescriptions.createdAt"
      via: "Drizzle gte/lte on createdAt column"
      pattern: "serviceDescriptions\\.createdAt"
---

<objective>
Change the billing service descriptions date picker to filter by creation date (createdAt) instead of the service description's period (periodStart).

Purpose: Users want to find service descriptions based on when they were created, not the billing period they cover. A service description created in March for a January period should appear when filtering March, not January.

Output: Updated API, server page, and client component all filtering on createdAt.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@app/src/app/api/billing/route.ts
@app/src/app/(authenticated)/(admin)/billing/page.tsx
@app/src/components/billing/BillingContent.tsx
@app/src/components/billing/BillingContent.test.tsx
@app/src/lib/schema.ts (serviceDescriptions table — has createdAt timestamp column)

<interfaces>
From app/src/lib/schema.ts:
```typescript
export const serviceDescriptions = pgTable("service_descriptions", {
  // ...
  createdAt: timestamp({ precision: 3, mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp({ precision: 3, mode: 'string' }).notNull(),
  periodStart: date().notNull(),
  periodEnd: date().notNull(),
  // ...
});
```

Note: `createdAt` is a timestamp (ISO string), while `periodStart` is a date (YYYY-MM-DD string). The filtering comparison must account for this — use `gte`/`lte` on the timestamp, converting the YYYY-MM-DD boundaries to timestamp boundaries (start of day / end of day).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update API route to filter by createdAt instead of periodStart</name>
  <files>app/src/app/api/billing/route.ts</files>
  <action>
In the GET handler of `/api/billing/route.ts`:

1. Rename query params from `periodStartFrom`/`periodStartTo` to `createdFrom`/`createdTo`. Update the validation error messages accordingly.

2. Change the where conditions from filtering on `serviceDescriptions.periodStart` to `serviceDescriptions.createdAt`. Since `createdAt` is a timestamp string (ISO format like "2026-03-01T10:30:00.000") and the query params are date strings (YYYY-MM-DD), convert the boundaries:
   - For `createdFrom`: use `gte(serviceDescriptions.createdAt, createdFrom + "T00:00:00.000")` to match from start of day
   - For `createdTo`: use `lte(serviceDescriptions.createdAt, createdTo + "T23:59:59.999")` to match through end of day

3. Keep the same date format validation (YYYY-MM-DD regex). Only the column and param names change plus the timestamp boundary conversion.

Do NOT change anything in the POST handler. Only modify the GET handler.
  </action>
  <verify>cd /Users/stefan/projects/veda-legal-timesheets/app && npx tsc --noEmit --pretty 2>&1 | head -30</verify>
  <done>API GET /api/billing accepts createdFrom/createdTo params and filters on serviceDescriptions.createdAt column with proper timestamp boundaries</done>
</task>

<task type="auto">
  <name>Task 2: Update server page pre-filter and client component query params</name>
  <files>
    app/src/app/(authenticated)/(admin)/billing/page.tsx
    app/src/components/billing/BillingContent.tsx
    app/src/components/billing/BillingContent.test.tsx
  </files>
  <action>
**billing/page.tsx (server component):**
Change the initial query from filtering `serviceDescriptions.periodStart` to `serviceDescriptions.createdAt`. The current code does:
```
gte(serviceDescriptions.periodStart, monthStart),
lte(serviceDescriptions.periodStart, monthEnd),
```
Change to:
```
gte(serviceDescriptions.createdAt, monthStart + "T00:00:00.000"),
lte(serviceDescriptions.createdAt, monthEnd + "T23:59:59.999"),
```

**BillingContent.tsx (client component):**
In the `fetchServiceDescriptions` callback (~line 94-97), change the URLSearchParams keys:
- `periodStartFrom` -> `createdFrom`
- `periodStartTo` -> `createdTo`

That is the only change needed in BillingContent.tsx — the rest of the date range logic stays the same.

**BillingContent.test.tsx (tests):**
Update all test assertions that check the fetch URL. Replace:
- `periodStartFrom` -> `createdFrom`
- `periodStartTo` -> `createdTo`

Specifically update these test blocks:
- "FILT-02: Default date range is this-month" — change expected URL from `?periodStartFrom=...&periodStartTo=...` to `?createdFrom=...&createdTo=...`
- "FILT-03: Changing date range triggers API fetch" — change both assertions (last-month and all-time) to use the new param names
  </action>
  <verify>cd /Users/stefan/projects/veda-legal-timesheets/app && npm run test -- BillingContent --run 2>&1 | tail -20</verify>
  <done>Server page filters by createdAt, client sends createdFrom/createdTo params, all existing tests pass with updated param names</done>
</task>

</tasks>

<verification>
1. `cd app && npx tsc --noEmit` — no type errors
2. `cd app && npm run test -- BillingContent --run` — all billing content tests pass
3. `cd app && npm run build` — production build succeeds
</verification>

<success_criteria>
- Date picker on the service descriptions tab filters by createdAt instead of periodStart
- API accepts createdFrom/createdTo query params and queries the createdAt column
- Server-side initial load also filters by createdAt
- All existing tests updated and passing
- Build succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/12-filter-service-descriptions-by-creation-/12-SUMMARY.md`
</output>
