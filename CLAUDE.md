# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Veda Legal Timesheets - A Next.js application for legal practice management and timesheet tracking. Built for a small legal firm (~10 employees, ~200 clients).

**Repository:** https://github.com/stefanratchev/Veda-Legal

## Tech Stack

- **Framework:** Next.js 16 (App Router) with TypeScript
- **Styling:** Tailwind CSS v4 with custom dark theme design system
- **Auth:** NextAuth.js with Microsoft 365 (Azure AD) SSO
- **Database:** PostgreSQL with Drizzle ORM
- **Testing:** Vitest + React Testing Library
- **Runtime:** Node.js 22 (production)
- **Hosting target:** Azure (EU region)

## Commands

All commands run from the `app/` directory:

```bash
npm run dev            # Start development server (localhost:3000)
npm run build          # Build for production
npm run lint           # Run ESLint
npm run test           # Run tests in watch mode
npm run test -- file   # Run specific test file
npm run test:coverage  # Run tests with coverage report
npm run db:generate    # Generate Drizzle migrations
npm run db:migrate     # Run database migrations
npm run db:push        # Push schema changes (dev)
npm run db:studio      # Open Drizzle Studio
```

## Project Structure

```
app/src/
├── app/                    # Next.js App Router
│   ├── (authenticated)/   # Protected route group (requires login)
│   │   ├── billing/       # Billing/invoicing
│   │   ├── clients/       # Client management
│   │   ├── employees/     # Employee management
│   │   ├── reports/       # Reports & analytics
│   │   ├── timesheets/    # Time entry page
│   │   └── page.tsx       # Dashboard
│   ├── api/               # API routes
│   │   ├── clients/       # Client CRUD
│   │   ├── employees/     # Employee CRUD
│   │   ├── reports/       # Aggregated report data
│   │   ├── timesheets/    # Time entry CRUD + /dates endpoint
│   │   ├── topics/        # Topics CRUD + subtopics creation
│   │   └── subtopics/     # Subtopics CRUD
│   └── login/             # Public login page
├── components/
│   ├── layout/            # Sidebar, Header
│   ├── dashboard/         # Dashboard-specific components
│   ├── clients/           # Client list, modal
│   ├── employees/         # Employee list, modal
│   ├── reports/           # Charts (Recharts), tabs, date pickers
│   ├── timesheets/        # WeekStrip, EntryForm, EntryCard
│   ├── topics/            # TopicsContent, TopicModal, SubtopicModal
│   └── ui/                # DataTable, TableFilters, DurationPicker, ClientSelect, TopicCascadeSelect
├── contexts/              # React context providers (MobileNavContext)
├── hooks/                 # Custom React hooks (useClickOutside)
├── lib/                   # Utilities
│   ├── api-utils.ts       # Auth helpers, validation functions
│   ├── date-utils.ts      # Date formatting utilities
│   ├── auth.ts            # NextAuth configuration
│   ├── db.ts              # Drizzle client instance
│   └── schema.ts          # Drizzle schema definitions
├── types/                 # Shared TypeScript types
└── test/                  # Test setup
```

## Architecture Patterns

### Data Flow
- **Server Components** fetch data via Drizzle ORM
- **Client Components** (`"use client"`) handle interactivity, call API routes for mutations
- **API Routes** use shared helpers from `lib/api-utils.ts`:
  - `requireAuth()` - Validates session (supports both server session and JWT)
  - `requireWriteAccess()` - Checks user has any valid position (all positions can write)

### Shared Code
- **Types:** Import from `@/types` for Client, TimeEntry, FormData interfaces
- **Hooks:** `useClickOutside` for dropdown/modal close behavior
- **Validation:** Use `isValidEmail`, `isValidHours`, `isValidDescription` from api-utils

### Position-Based Access
The schema uses a `Position` enum with five levels. Access is controlled via position groups in `api-utils.ts`:

| Position | Admin Access | Write Access | Team View |
|----------|--------------|--------------|-----------|
| ADMIN | ✓ | ✓ | ✓ |
| PARTNER | ✓ | ✓ | ✓ |
| SENIOR_ASSOCIATE | | ✓ | |
| ASSOCIATE | | ✓ | |
| CONSULTANT | | ✓ | |

- **Admin Access:** Can manage clients, reports, billing
- **Write Access:** Can log time entries
- **Team View:** Can view other users' timesheets

### Time Entry Editing
Time entries can be edited by their owner via `PATCH /api/timesheets/[id]`. Editable fields: client, topic/subtopic, hours, description. Date cannot be changed.

**Billing Lock:** Entries linked to a finalized service description cannot be edited. The `isLocked` field in the GET response indicates this state.

## Database

**Development:** Local PostgreSQL 17 via Homebrew

```bash
# Start PostgreSQL
brew services start postgresql@17

# After schema changes
npm run db:push        # Quick push for development
# OR
npm run db:generate && npm run db:migrate  # Generate and apply migration
```

**Troubleshooting:**
- "Can't reach database" → Check `brew services list | grep postgresql`
- Schema out of sync → Run `npm run db:push` to sync schema with database

## Git Worktrees

Feature development uses git worktrees in `.worktrees/` for isolation.

**After merging a feature branch to main:**
```bash
npm install   # Sync node_modules with merged package.json
```

`node_modules/` is not committed, so dependencies added in a worktree won't exist in main until `npm install` is run.

## Design System

Dark theme with CSS variables in `globals.css`:
- `--bg-deep` (#151515) - Page background
- `--bg-elevated` (#1c1c1c) - Cards, sidebar
- `--bg-surface` (#383838) - Inputs
- `--accent-pink` (#FF9999) - Primary accent (Coral Pink)
- Semantic colors: `--success`, `--warning`, `--danger`, `--info` (with matching `*-bg` variants)

**Typography:** Roboto Condensed (headings) + Roboto (body)

**Animation rule:** No page entrance animations. Use `animate-fade-up` only for interactive elements (dropdowns, modals, popovers).

## Testing

**Requirement:** New features must include unit and integration tests. Tests are not optional—they are part of the definition of done for any feature work.

Tests are colocated with source files (e.g., `lib/date-utils.test.ts`). Run with:
```bash
npm run test              # Watch mode
npm run test -- api-utils # Run specific file
npm run test -- --run     # Run all tests once (no watch)
```

**Test utilities in `src/test/`:**
- `utils.tsx` - `renderWithProviders()` wraps components with required contexts
- `mocks/auth.ts` - `createMockSession()`, `setupMockAuth()` for NextAuth mocking
- `mocks/db.ts` - `createMockDb()` for Drizzle ORM mocking with chainable methods

## Environment Variables

Required in `app/.env`:
```
DATABASE_URL=postgresql://...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>
AZURE_AD_CLIENT_ID=<from Azure Portal>
AZURE_AD_CLIENT_SECRET=<from Azure Portal>
AZURE_AD_TENANT_ID=<from Azure Portal>
```

## Domain Terminology

- **Client**: External party receiving legal services (not to be confused with client-side code)
- **TimeEntry**: Billable hours logged against a client
- **Topic**: High-level work category (e.g., "Company Incorporation", "M&A Advisory")
- **Subtopic**: Specific task type within a topic (e.g., "Client correspondence:", "Drafting documents:")
- **isPrefix**: Subtopics ending with ":" are prefixes - user should add details after selecting
- **ServiceDescription**: Invoice-like document grouping time entries for a client and period
- **ServiceDescriptionTopic**: A topic section within a service description with pricing mode (hourly/fixed)
- **LineItem**: Individual line within a service description topic (linked to a time entry or manual)

## Topic/Subtopic Hierarchy

TimeEntries reference a Subtopic, with denormalized `topicName` and `subtopicName` fields for immutability. When a subtopic is selected:
- If `isPrefix` is true: pre-fill description with subtopic name, user adds specifics
- If `isPrefix` is false: use subtopic name as the full description

To update topics/subtopics, edit `scripts/seed-topics.ts` and run:
```bash
npm run db:seed-topics                                    # Local
DATABASE_URL="<prod-url>" npm run db:seed-topics          # Production
```

## Production Deployment

**Pre-deployment requirement:** Always run tests before deploying to production. Deployment must fail if tests don't pass—never skip this step, even if not explicitly requested.

**Deployment method:** Push to `prod` branch triggers GitHub Actions workflow (`.github/workflows/deploy-prod.yml`)

**Running migrations on production:**
```bash
/migrate-prod   # Claude Code slash command - applies pending migrations to Azure PostgreSQL
```

**Production environment:** Azure Web App with Azure PostgreSQL Flexible Server. Credentials stored in `app/.env.prod` (not committed).
