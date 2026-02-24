# Codebase Structure

**Analysis Date:** 2026-02-24

## Directory Layout

```
app/src/
├── app/                          # Next.js App Router routes
│   ├── layout.tsx               # Root layout (theme, fonts, Providers)
│   ├── globals.css              # Design system CSS variables
│   ├── (authenticated)/         # Protected route group (requires login)
│   │   ├── layout.tsx           # Main authenticated layout (Sidebar, MainContent, contexts)
│   │   ├── page.tsx             # Dashboard (redirects to /timesheets)
│   │   ├── error.tsx            # Global error boundary for authenticated pages
│   │   ├── loading.tsx          # Loading skeleton
│   │   ├── (admin)/             # Admin-only route group (redirects non-admin to /timesheets)
│   │   │   ├── layout.tsx       # Admin layout (auth check)
│   │   │   ├── billing/         # Service description management
│   │   │   │   ├── page.tsx     # List service descriptions
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx # Edit service description (fetches and passes to client component)
│   │   │   ├── clients/         # Client management
│   │   │   │   └── page.tsx     # List/create/edit clients
│   │   │   ├── topics/          # Topic/subtopic management
│   │   │   │   └── page.tsx     # Topic tree UI
│   │   │   └── reports/         # Analytics and reports
│   │   │       └── page.tsx     # Charts and dashboards
│   │   ├── team/                # Team timesheet view (ADMIN/PARTNER only)
│   │   │   └── page.tsx         # View all employees' timesheets
│   │   └── timesheets/          # Main timesheet entry page
│   │       └── page.tsx         # Date-based time entry form
│   ├── api/                     # API routes (backend endpoints)
│   │   ├── auth/                # NextAuth authentication
│   │   │   └── [...nextauth]/route.ts
│   │   ├── admin/               # Admin-only operations
│   │   │   └── impersonate/route.ts  # Toggle user impersonation
│   │   ├── timesheets/          # Time entry CRUD + submissions
│   │   │   ├── route.ts         # GET/POST time entries
│   │   │   ├── [id]/route.ts    # PATCH/DELETE single entry
│   │   │   ├── dates/route.ts   # GET available dates with entries
│   │   │   ├── overdue/route.ts # GET overdue submissions (admin)
│   │   │   ├── submit/route.ts  # POST submit daily timesheet
│   │   │   ├── submissions/route.ts # GET/DELETE submissions
│   │   │   └── team/[userId]/route.ts # GET another user's timesheets
│   │   ├── clients/             # Client CRUD
│   │   │   └── route.ts         # GET/POST clients (admin for create)
│   │   ├── employees/           # Employee data (read-only)
│   │   │   └── route.ts         # GET employee list
│   │   ├── topics/              # Topic/subtopic management
│   │   │   ├── route.ts         # GET/POST topics
│   │   │   ├── [id]/route.ts    # PATCH/DELETE topic
│   │   │   ├── [id]/subtopics/route.ts # POST create subtopic
│   │   │   └── reorder/route.ts # PATCH reorder topics
│   │   ├── subtopics/           # Subtopic CRUD
│   │   │   ├── [id]/route.ts    # PATCH/DELETE subtopic
│   │   │   └── reorder/route.ts # PATCH reorder subtopics
│   │   ├── billing/             # Service description operations
│   │   │   ├── route.ts         # GET list, POST create
│   │   │   ├── unbilled-summary/route.ts # GET unbilled time by client
│   │   │   ├── [id]/
│   │   │   │   ├── pdf/route.tsx # GET PDF export (React PDF)
│   │   │   │   ├── topics/      # Topic-level operations
│   │   │   │   │   ├── route.ts # POST add topic to SD
│   │   │   │   │   ├── [topicId]/route.ts # PATCH topic settings
│   │   │   │   │   ├── [topicId]/items/route.ts # POST add line item
│   │   │   │   │   ├── [topicId]/items/[itemId]/route.ts # PATCH/DELETE line item
│   │   │   │   │   └── reorder/route.ts # PATCH reorder topics in SD
│   │   │   │   └── line-items/
│   │   │   │       └── reorder/route.ts # PATCH reorder line items (cross-topic)
│   │   ├── m365/                # Microsoft 365 integration
│   │   │   └── activity/route.ts # GET calendar + email events
│   │   └── reports/             # Report data aggregation
│   │       └── route.ts         # GET analytics data
│   └── login/                   # Public login page
│       └── page.tsx             # Microsoft 365 SSO button
├── components/                  # Reusable React components
│   ├── Providers.tsx            # SessionProvider wrapper
│   ├── layout/                  # Page structure
│   │   ├── Sidebar.tsx          # Navigation sidebar (collapsed state to localStorage)
│   │   ├── MainContent.tsx      # Content area wrapper
│   │   ├── Header.tsx           # Page header
│   │   ├── MobileHeader.tsx     # Mobile-only top bar with nav toggle
│   │   └── OverdueBanner.tsx    # Overdue submission alert banner
│   ├── timesheets/              # Timesheet entry UI
│   │   ├── TimesheetsContent.tsx # Main page container
│   │   ├── WeekStrip.tsx        # Date picker (week view)
│   │   ├── EntryForm.tsx        # Add/edit form with client/topic selection
│   │   ├── EntriesList.tsx      # List of entries for date
│   │   ├── EntryCard.tsx        # Single entry display card
│   │   ├── EntryRow.tsx         # Entry in table row format
│   │   ├── TeamTimesheets.tsx   # Team view table
│   │   ├── TeamMemberRow.tsx    # Single team member row
│   │   └── M365ActivityPanel.tsx # Calendar + email events sidebar
│   ├── billing/                 # Service description UI
│   │   ├── ServiceDescriptionDetail.tsx # Main editor (drag-and-drop)
│   │   ├── TopicSection.tsx     # Topic section with line items table
│   │   ├── LineItemRow.tsx      # Editable line item (inline editing)
│   │   ├── AddTopicModal.tsx    # Add topic to SD modal
│   │   ├── AddLineItemModal.tsx # Add/import line items modal
│   │   └── UnbilledClientCard.tsx # Unbilled hours summary card
│   ├── clients/                 # Client management UI
│   │   ├── ClientsContent.tsx   # Client list page
│   │   └── ClientModal.tsx      # Add/edit client form
│   ├── employees/               # Employee management UI
│   │   └── (components for CRUD)
│   ├── topics/                  # Topic/subtopic management UI
│   │   ├── TopicsContent.tsx    # Topic tree
│   │   ├── TopicModal.tsx       # Add/edit topic
│   │   └── SubtopicModal.tsx    # Add/edit subtopic
│   ├── reports/                 # Analytics UI
│   │   ├── ReportsContent.tsx   # Reports page
│   │   └── charts/              # Recharts components
│   ├── dashboard/               # Dashboard (currently minimal)
│   │   └── DashboardContent.tsx
│   └── ui/                      # Reusable UI primitives
│       ├── DataTable.tsx        # Generic sortable/filterable table
│       ├── TableFilters.tsx     # Filter bar for DataTable
│       ├── ClientSelect.tsx     # Dropdown: select client
│       ├── TopicCascadeSelect.tsx # Cascading dropdown: select topic + subtopic
│       ├── DurationPicker.tsx   # Input: hours + minutes
│       ├── ConfirmModal.tsx     # Confirmation dialog
│       └── (other UI components)
├── contexts/                    # React context providers
│   ├── MobileNavContext.tsx     # Mobile navigation drawer state
│   ├── SidebarContext.tsx       # Sidebar collapsed state (persists to localStorage)
│   └── ImpersonationContext.tsx # Admin impersonation state + API toggle
├── hooks/                       # Custom React hooks
│   └── useClickOutside.ts       # Detect clicks outside element (for dropdowns)
├── lib/                         # Shared utilities and configuration
│   ├── schema.ts                # Drizzle ORM schema (all tables, enums, relations)
│   ├── db.ts                    # Drizzle client export
│   ├── drizzle.ts               # Drizzle initialization
│   ├── auth.ts                  # NextAuth configuration + callbacks
│   ├── api-utils.ts             # Auth/validation/serialization functions
│   ├── auth-utils.ts            # Position-based access control helpers
│   ├── user.ts                  # getCurrentUser() (cached), authentication checks
│   ├── date-utils.ts            # Formatting, parsing, timezone helpers
│   ├── submission-utils.ts      # Submission deadline logic, timezone offsets
│   ├── billing-utils.ts         # Service description serialization helpers
│   ├── billing-pdf.tsx          # PDF generation + billing calculations (centralized)
│   ├── billing-config.ts        # Billing constants (BILLING_START_DATE)
│   ├── firm-details.ts          # Company info for invoices/PDFs
│   ├── db-types.ts              # Type helpers for Drizzle
│   └── (test files: *.test.ts)
├── types/                       # Shared TypeScript interfaces
│   ├── index.ts                 # Main types (Client, TimeEntry, ServiceDescription, etc.)
│   ├── m365.ts                  # Microsoft 365 API response types
│   └── next-auth.d.ts           # NextAuth session augmentation
├── test/                        # Testing utilities
│   ├── setup.ts                 # Test environment setup
│   ├── utils.tsx                # renderWithProviders() helper
│   ├── helpers/
│   │   └── api.ts               # createMockRequest() for API tests
│   └── mocks/
│       ├── auth.ts              # createMockSession(), setupMockAuth()
│       ├── db.ts                # createMockDb() with chainable methods
│       └── factories.ts         # Mock data factories (createMockUser, etc.)
├── middleware.ts                # NextAuth middleware (auth check for routes)
└── (43 test files across codebase with .test.ts or .test.tsx)
```

## Directory Purposes

**`app/`:** Next.js App Router pages and API routes. Contains all user-facing endpoints and backend operations.

**`components/`:** React components organized by feature area (timesheets, billing, clients, etc.). All components are either `.tsx` (React) or import from other `.tsx` files. Test files colocated with source.

**`lib/`:** Shared utilities, database layer, authentication, validation. Single source of truth for business logic (calculations, auth rules, validation constants).

**`types/`:** TypeScript interfaces shared across server and client. Exported from `@/types` alias for consistent imports.

**`contexts/`:** React context providers for global UI state (sidebar, mobile nav, impersonation). Wrapping providers set up in `components/Providers.tsx`.

**`hooks/`:** Custom React hooks for reusable client-side logic (e.g., `useClickOutside` for dropdown/modal interactions).

**`test/`:** Testing utilities and mock factories colocated by feature, not in separate directory. Tests import from `@/test/helpers`, `@/test/mocks`, `@/test/utils`.

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout, sets up theme, fonts, Providers
- `src/app/(authenticated)/layout.tsx`: Authenticated layout, sets up sidebar, contexts, checks auth
- `src/app/login/page.tsx`: Public login page with Microsoft 365 SSO button
- `src/app/(authenticated)/(admin)/layout.tsx`: Admin layout, redirects non-admin to /timesheets

**Configuration:**
- `src/lib/schema.ts`: Drizzle schema (tables, relations, constraints)
- `src/lib/auth.ts`: NextAuth configuration (Azure AD provider, callbacks, session)
- `src/lib/billing-config.ts`: Billing constants (BILLING_START_DATE)
- `src/middleware.ts`: NextAuth middleware (route protection)

**Core Logic:**
- `src/lib/api-utils.ts`: Auth functions, validation, serialization (230 lines)
- `src/lib/user.ts`: getCurrentUser() with impersonation support (110 lines)
- `src/lib/billing-pdf.tsx`: Billing calculations and PDF generation (650 lines)
- `src/lib/date-utils.ts`: Date formatting, parsing, timezone handling (170 lines)
- `src/lib/submission-utils.ts`: Submission deadline logic (150 lines)

**Timesheets:**
- Page: `src/app/(authenticated)/timesheets/page.tsx`
- API: `src/app/api/timesheets/route.ts` (GET/POST), `src/app/api/timesheets/[id]/route.ts` (PATCH/DELETE)
- Components: `src/components/timesheets/TimesheetsContent.tsx`, `EntryForm.tsx`, `WeekStrip.tsx`, `EntriesList.tsx`
- Submissions: `src/app/api/timesheets/submit/route.ts`, `src/app/api/timesheets/submissions/route.ts`

**Billing:**
- Page: `src/app/(authenticated)/(admin)/billing/page.tsx` (list), `src/app/(authenticated)/(admin)/billing/[id]/page.tsx` (detail)
- API: `src/app/api/billing/route.ts` (list/create), `src/app/api/billing/[id]/*/` (nested operations)
- Component: `src/components/billing/ServiceDescriptionDetail.tsx` (main editor with drag-and-drop)
- PDF: `src/app/api/billing/[id]/pdf/route.tsx` exports PDF

**Clients:**
- Page: `src/app/(authenticated)/(admin)/clients/page.tsx`
- API: `src/app/api/clients/route.ts`
- Components: `src/components/clients/ClientsContent.tsx`, `ClientModal.tsx`

**Topics/Subtopics:**
- Page: `src/app/(authenticated)/(admin)/topics/page.tsx`
- API: `src/app/api/topics/route.ts`, `src/app/api/subtopics/route.ts`
- Components: `src/components/topics/TopicsContent.tsx`, `TopicModal.tsx`, `SubtopicModal.tsx`

**Testing:**
- Test helpers: `src/test/helpers/api.ts`, `src/test/utils.tsx`, `src/test/mocks/`
- Colocated tests: `src/lib/date-utils.test.ts`, `src/components/billing/ServiceDescriptionDetail.test.tsx` (43 total)

## Naming Conventions

**Files:**
- React components: PascalCase (e.g., `EntryForm.tsx`, `ServiceDescriptionDetail.tsx`)
- API routes: kebab-case directories with `route.ts` file (e.g., `api/billing/[id]/pdf/route.tsx`)
- Utility files: camelCase (e.g., `api-utils.ts`, `date-utils.ts`)
- Type files: kebab-case (e.g., `next-auth.d.ts`, `m365.ts`)
- Test files: same as source with `.test.ts` or `.test.tsx` suffix (e.g., `date-utils.test.ts`)

**Directories:**
- Lowercase with optional hyphens (e.g., `components/`, `api/`, `billing/`, `line-items/`)
- Dynamic segments in brackets (e.g., `[id]/`, `[userId]/`, `[topicId]/`)
- Route groups in parentheses (e.g., `(authenticated)/`, `(admin)/`)

**Functions:**
- camelCase, descriptive (e.g., `getCurrentUser()`, `requireAdmin()`, `isValidHours()`, `serializeDecimal()`)

**Variables:**
- camelCase (e.g., `serviceDescription`, `displayOrder`, `hourlyRate`)

**Types/Interfaces:**
- PascalCase (e.g., `TimeEntry`, `ServiceDescription`, `ServiceDescriptionTopic`)

**Constants:**
- UPPERCASE_WITH_UNDERSCORES for module-level constants (e.g., `MAX_HOURS_PER_ENTRY`, `ADMIN_POSITIONS`, `MIN_SUBMISSION_HOURS`)

## Where to Add New Code

**New Feature (e.g., expense tracking):**
- Create API routes: `src/app/api/expenses/route.ts`, `src/app/api/expenses/[id]/route.ts`
- Create schema tables: Add to `src/lib/schema.ts`, generate migration with `npm run db:generate`
- Create page: `src/app/(authenticated)/(admin)/expenses/page.tsx` (if admin-only) or `src/app/(authenticated)/expenses/page.tsx`
- Create components: `src/components/expenses/ExpensesContent.tsx`, `ExpenseForm.tsx`, etc.
- Create types: Add to `src/types/index.ts`
- Create utilities: Add functions to existing `src/lib/*-utils.ts` or create `src/lib/expense-utils.ts`
- Create tests: Colocate with source (e.g., `src/app/api/expenses/route.test.ts`)

**New UI Component:**
- Location: `src/components/` subdirectory by feature (e.g., `src/components/timesheets/NewComponent.tsx`)
- If reusable primitive: `src/components/ui/NewComponent.tsx`
- Import from `@/components` alias
- Add tests alongside: `NewComponent.test.tsx`

**New API Endpoint:**
- Location: `src/app/api/*/route.ts` following resource structure
- Auth pattern: Call `requireAuth()`, `requireAdmin()`, or `requireWriteAccess()` at start
- Error handling: Use `errorResponse()` for 4xx/5xx, `successResponse()` for 2xx
- Serialization: Call `serializeDecimal()` before returning numeric fields

**New Shared Utility:**
- If validation/formatting: Add to `src/lib/api-utils.ts`
- If calculations: Add to `src/lib/billing-utils.ts` or create domain-specific file
- If date-related: Add to `src/lib/date-utils.ts`
- Export from lib, import via `@/lib` alias
- Write tests colocated: `src/lib/my-utils.test.ts`

**New Type:**
- Location: `src/types/index.ts` (main types) or `src/types/domain.ts` (domain-specific)
- Export from `@/types`
- Use PascalCase, add JSDoc comments

## Special Directories

**`node_modules/`:**
- Purpose: npm packages
- Generated: Yes (not committed)
- Committed: No
- Sync with: `npm install` after merging features (dependencies may change)

**`drizzle/`:**
- Purpose: Database migrations (generated SQL)
- Generated: Yes (`npm run db:generate`)
- Committed: Yes (required for reproducible deploys)
- Pattern: Each schema change requires migration file committed alongside schema.ts

**`.next/`:**
- Purpose: Build output, caching
- Generated: Yes (build time)
- Committed: No (regenerated on each build)

**`public/`:**
- Purpose: Static assets (icons, fonts served at root)
- Generated: No (manually added)
- Committed: Yes

**`.env`:**
- Purpose: Environment variables (DATABASE_URL, NEXTAUTH_*, AZURE_AD_*)
- Generated: No (developer-created)
- Committed: No (security risk, list in `.env.example`)
- Note: `.env.prod` exists but not committed; used in production deployment

---

*Structure analysis: 2026-02-24*
