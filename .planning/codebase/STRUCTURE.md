# Codebase Structure

**Analysis Date:** 2026-02-24

## Directory Layout

```
veda-legal-timesheets/          # Repo root
├── app/                        # Next.js application (all source lives here)
│   ├── src/
│   │   ├── app/                # Next.js App Router pages and API routes
│   │   │   ├── (authenticated)/          # Protected route group
│   │   │   │   ├── (admin)/              # Admin-only route group
│   │   │   │   │   ├── billing/          # Billing list + service description detail
│   │   │   │   │   │   └── [id]/         # Service description detail page
│   │   │   │   │   ├── clients/          # Client management
│   │   │   │   │   ├── reports/          # Reports and analytics
│   │   │   │   │   └── topics/           # Topic/subtopic management
│   │   │   │   ├── team/                 # Team timesheets view (admin-visible)
│   │   │   │   ├── timesheets/           # Time entry page (all users)
│   │   │   │   ├── layout.tsx            # Auth layout with sidebar, overdue banner
│   │   │   │   ├── error.tsx             # Route-level error boundary
│   │   │   │   └── page.tsx              # Root redirect → /timesheets
│   │   │   ├── api/                      # API route handlers
│   │   │   │   ├── admin/impersonate/    # User impersonation CRUD
│   │   │   │   ├── auth/[...nextauth]/   # NextAuth handler
│   │   │   │   ├── billing/              # Service description CRUD
│   │   │   │   │   └── [id]/
│   │   │   │   │       ├── line-items/reorder/
│   │   │   │   │       ├── pdf/          # PDF generation endpoint
│   │   │   │   │       └── topics/
│   │   │   │   │           ├── reorder/
│   │   │   │   │           └── [topicId]/items/[itemId]/
│   │   │   │   ├── clients/              # Client CRUD
│   │   │   │   ├── employees/            # Employee CRUD
│   │   │   │   ├── m365/activity/        # Microsoft 365 calendar + email sync
│   │   │   │   ├── reports/              # Aggregated report data
│   │   │   │   ├── subtopics/            # Subtopic CRUD + reorder
│   │   │   │   ├── timesheets/           # Time entry CRUD + submissions + overdue
│   │   │   │   └── topics/               # Topic CRUD + reorder
│   │   │   ├── login/                    # Public login page
│   │   │   ├── layout.tsx                # Root layout (fonts, SessionProvider)
│   │   │   └── not-found.tsx             # 404 page
│   │   ├── components/
│   │   │   ├── billing/                  # Billing/service description components
│   │   │   ├── clients/                  # Client list and modal
│   │   │   ├── dashboard/                # Dashboard components
│   │   │   ├── employees/                # Employee list and modal
│   │   │   ├── layout/                   # Sidebar, Header, MobileHeader, OverdueBanner
│   │   │   ├── reports/                  # Report tabs, charts (Recharts)
│   │   │   │   └── charts/               # BarChart, DonutChart
│   │   │   ├── timesheets/               # WeekStrip, TimesheetsContent, M365ActivityPanel
│   │   │   ├── topics/                   # TopicsContent, TopicModal, SubtopicModal
│   │   │   ├── ui/                       # Shared UI primitives
│   │   │   └── Providers.tsx             # SessionProvider wrapper
│   │   ├── contexts/
│   │   │   ├── ImpersonationContext.tsx  # Admin impersonation state
│   │   │   ├── MobileNavContext.tsx      # Mobile nav drawer state
│   │   │   └── SidebarContext.tsx        # Sidebar collapsed state (localStorage)
│   │   ├── hooks/
│   │   │   ├── useClickOutside.ts        # Click-outside detection
│   │   │   └── useCurrentDate.ts         # Auto-updating current date
│   │   ├── lib/
│   │   │   ├── api-utils.ts              # Auth guards, validation, response helpers
│   │   │   ├── auth-utils.ts             # Newer auth guards (used by admin routes)
│   │   │   ├── auth.ts                   # NextAuth config (Azure AD)
│   │   │   ├── billing-config.ts         # Billing constants (BILLING_START_DATE)
│   │   │   ├── billing-pdf.tsx           # PDF template + canonical billing calculations
│   │   │   ├── billing-utils.ts          # Serialization + discount/capHours validation
│   │   │   ├── date-utils.ts             # Date/time formatting helpers
│   │   │   ├── db-types.ts               # Drizzle inferred DB types
│   │   │   ├── db.ts                     # Re-exports drizzle client + schema
│   │   │   ├── drizzle.ts                # Drizzle connection pool instance
│   │   │   ├── firm-details.ts           # Firm name/address for PDFs
│   │   │   ├── schema.ts                 # Drizzle table definitions + relations
│   │   │   ├── submission-utils.ts       # Submission deadlines, overdue logic
│   │   │   └── user.ts                   # getCurrentUser() with impersonation
│   │   ├── test/
│   │   │   ├── helpers/
│   │   │   │   ├── api.ts                # createMockRequest() for API route tests
│   │   │   │   └── index.ts              # Re-exports
│   │   │   ├── mocks/
│   │   │   │   ├── auth.ts               # createMockSession(), setupMockAuth()
│   │   │   │   ├── db.ts                 # createMockDb() with chainable Drizzle mock
│   │   │   │   ├── factories.ts          # createMockUser(), createMockClient(), etc.
│   │   │   │   └── index.ts              # Re-exports
│   │   │   ├── setup.ts                  # Vitest global setup
│   │   │   └── utils.tsx                 # renderWithProviders()
│   │   └── types/
│   │       ├── index.ts                  # Shared app types (Client, TimeEntry, ServiceDescription, etc.)
│   │       └── m365.ts                   # M365 integration types
│   ├── drizzle/                          # Migration SQL files (committed)
│   ├── public/                           # Static assets (logo, favicons)
│   ├── scripts/                          # Seed scripts (run via npm run db:*)
│   ├── drizzle.config.ts                 # Drizzle Kit config
│   ├── next.config.ts                    # Next.js config (standalone output, security headers)
│   ├── tsconfig.json                     # TypeScript config
│   └── vitest.config.ts                  # Vitest config
├── docs/plans/                           # Feature design documents (not committed plans)
├── .github/workflows/                    # CI/CD pipelines
├── .planning/codebase/                   # GSD codebase analysis documents
└── CLAUDE.md                             # Project instructions for Claude Code
```

## Directory Purposes

**`app/src/app/(authenticated)/`:**
- Purpose: All protected routes requiring a valid session
- Contains: Server Component pages, route group layouts, error boundary
- Key files: `layout.tsx` (sidebar + provider composition), `(admin)/layout.tsx` (admin redirect guard)

**`app/src/app/api/`:**
- Purpose: API route handlers for all mutations and client-fetched data
- Contains: `route.ts` files (REST handlers), co-located `route.test.ts` files
- Pattern: Each resource gets its own directory; nested resources use nested directories

**`app/src/components/`:**
- Purpose: All React components, organized by feature domain
- Contains: Client Components (`"use client"`) and a few server-compatible components
- Pattern: Feature-specific components live in domain folders; shared primitives in `ui/`

**`app/src/components/ui/`:**
- Purpose: Reusable, domain-agnostic UI primitives
- Key files: `DataTable.tsx`, `TableFilters.tsx`, `DurationPicker.tsx`, `ClientSelect.tsx`, `TopicCascadeSelect.tsx`, `ConfirmModal.tsx`

**`app/src/components/billing/`:**
- Purpose: Service description editor components
- Key files: `ServiceDescriptionDetail.tsx` (main DnD editor), `TopicSection.tsx`, `LineItemRow.tsx`, `BillingContent.tsx`

**`app/src/lib/`:**
- Purpose: All shared utilities, server-side logic, DB access
- Contains: No React components — pure TypeScript functions and the Drizzle client
- Key distinction: `api-utils.ts` vs `auth-utils.ts` — both provide auth guards; `auth-utils.ts` is newer and returns `user` directly (preferred for new admin API routes)

**`app/src/test/`:**
- Purpose: Shared test infrastructure
- Contains: Mock factories, auth mocks, DB mocks, render helpers
- Import from: `@/test/helpers`, `@/test/mocks` (aliases set in `tsconfig.json`)

**`app/drizzle/`:**
- Purpose: Committed migration SQL files (generated by `npm run db:generate`)
- Generated: Yes (by Drizzle Kit)
- Committed: Yes — required for CI validation and production deployment

## Key File Locations

**Entry Points:**
- `app/src/middleware.ts`: JWT auth gate for all routes
- `app/src/app/layout.tsx`: Root HTML, fonts, `SessionProvider`
- `app/src/app/(authenticated)/layout.tsx`: Auth layout, sidebar, context providers

**Configuration:**
- `app/next.config.ts`: Standalone output, security headers, build timestamp
- `app/drizzle.config.ts`: Drizzle Kit connection and schema paths
- `app/vitest.config.ts`: Test runner config
- `app/tsconfig.json`: Path aliases (`@/` → `src/`)

**Core Logic:**
- `app/src/lib/schema.ts`: Database schema (single source of truth for all tables/enums)
- `app/src/lib/api-utils.ts`: Auth guards + validation helpers for API routes
- `app/src/lib/user.ts`: `getCurrentUser()` — used by every authenticated server page
- `app/src/lib/billing-pdf.tsx`: Canonical billing calculations + PDF template
- `app/src/lib/billing-utils.ts`: Serialization for billing API responses
- `app/src/types/index.ts`: Shared TypeScript interfaces for API payloads

**Testing:**
- `app/src/test/mocks/factories.ts`: Mock data factories
- `app/src/test/mocks/auth.ts`: Auth mocking utilities
- `app/src/test/mocks/db.ts`: Drizzle mock with chainable methods
- `app/src/test/helpers/api.ts`: `createMockRequest()` for API route tests

## Naming Conventions

**Files:**
- React components: PascalCase, e.g., `ServiceDescriptionDetail.tsx`, `TopicSection.tsx`
- Non-component modules: kebab-case, e.g., `api-utils.ts`, `billing-pdf.tsx`, `date-utils.ts`
- Test files: Co-located, same name + `.test.ts` or `.test.tsx`, e.g., `route.test.ts`, `DataTable.test.tsx`
- Page files: Always `page.tsx` (Next.js convention)
- API files: Always `route.ts` or `route.tsx` (Next.js convention)

**Directories:**
- Feature domains: kebab-case, e.g., `billing/`, `timesheets/`, `topics/`
- Dynamic route segments: bracket notation, e.g., `[id]/`, `[topicId]/`
- Route groups: parentheses notation, e.g., `(authenticated)/`, `(admin)/`

**Components:**
- Feature-area components named `*Content.tsx` (e.g., `BillingContent.tsx`, `TimesheetsContent.tsx`) — top-level client component for a page
- Detail editors named `*Detail.tsx` (e.g., `ServiceDescriptionDetail.tsx`)
- Modals named `*Modal.tsx`

## Where to Add New Code

**New admin page (billing, clients, reports, topics):**
- Page: `app/src/app/(authenticated)/(admin)/[feature]/page.tsx`
- Component: `app/src/components/[feature]/[Feature]Content.tsx`
- API: `app/src/app/api/[feature]/route.ts`
- Tests: Co-located `route.test.ts` and `[Feature]Content.test.tsx`

**New all-user page (timesheets, team):**
- Page: `app/src/app/(authenticated)/[feature]/page.tsx`
- Component: `app/src/components/[feature]/[Feature]Content.tsx`

**New API endpoint:**
- File: `app/src/app/api/[resource]/route.ts`
- Use `requireAuth()` from `app/src/lib/api-utils.ts` for user routes
- Use `requireAdmin()` from `app/src/lib/auth-utils.ts` for admin-only routes
- Test: `app/src/app/api/[resource]/route.test.ts`

**New shared UI component:**
- File: `app/src/components/ui/[ComponentName].tsx`
- Test: `app/src/components/ui/[ComponentName].test.tsx`

**New utility / helper function:**
- Domain-specific: `app/src/lib/[domain]-utils.ts`
- General: `app/src/lib/[descriptive-name].ts`
- Test: Co-located `.test.ts`

**New shared type:**
- Add to `app/src/types/index.ts`

**Database schema change:**
- Edit `app/src/lib/schema.ts`
- Run `npm run db:generate` to create migration file in `app/drizzle/`
- Run `npm run db:migrate` to apply locally
- Commit both `schema.ts` and the migration file together

## Special Directories

**`app/drizzle/`:**
- Purpose: SQL migration files generated by Drizzle Kit
- Generated: Yes (by `npm run db:generate`)
- Committed: Yes — required for CI and production

**`app/public/`:**
- Purpose: Static assets served at root — logo images, favicons
- Key files: `logo-print.png` (used in PDF generation via filesystem path)
- Generated: Partially (favicons via `scripts/generate-favicons.mjs`)

**`app/scripts/`:**
- Purpose: One-off database seed scripts
- Key files: `seed-topics.ts`, `seed-internal-topics.ts`, `seed-clients.ts`, `seed-admin.ts`
- Run via: `npm run db:seed-*` commands

**`.worktrees/`:**
- Purpose: Git worktrees for parallel feature development
- Generated: No — created manually
- Note: Each worktree has its own `node_modules/`; run `npm install` after merging

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: Yes (by `/gsd:map-codebase`)
- Committed: Yes

---

*Structure analysis: 2026-02-24*
