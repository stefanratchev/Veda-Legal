# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Veda Legal Timesheets - A Next.js application for legal practice management and timesheet tracking. Built for a small legal firm (~10 employees, ~200 clients).

**Repository:** https://github.com/stefanratchev/Veda-Legal

## Tech Stack

- **Framework:** Next.js 16 (App Router) with TypeScript
- **Styling:** Tailwind CSS v4 with custom dark theme design system
- **Auth:** NextAuth.js with Microsoft 365 (Azure AD) SSO
- **Database:** PostgreSQL with Prisma ORM v7
- **Testing:** Vitest + React Testing Library
- **Hosting target:** Azure (EU region)

## Commands

All commands run from the `app/` directory:

```bash
npm run dev            # Start development server (localhost:3000)
npm run build          # Build for production
npm run lint           # Run ESLint
npm run test           # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Run database migrations
npm run db:studio      # Open Prisma Studio
```

## Project Structure

```
app/src/
├── app/                    # Next.js App Router
│   ├── (authenticated)/   # Protected route group (requires login)
│   │   ├── clients/       # Client management
│   │   ├── timesheets/    # Time entry page
│   │   ├── error.tsx      # Error boundary
│   │   └── page.tsx       # Dashboard
│   ├── api/               # API routes
│   │   ├── clients/       # Client CRUD
│   │   └── timesheets/    # Time entry CRUD + /dates endpoint
│   └── login/             # Public login page
├── components/
│   ├── layout/            # Sidebar, Header
│   ├── clients/           # Client list, modal
│   ├── timesheets/        # WeekStrip, EntryForm, EntryCard
│   └── ui/                # DataTable, DurationPicker, ClientSelect
├── hooks/                 # Custom React hooks (useClickOutside)
├── lib/                   # Utilities
│   ├── api-utils.ts       # Auth helpers, validation functions
│   ├── date-utils.ts      # Date formatting utilities
│   ├── auth.ts            # NextAuth configuration
│   └── db.ts              # Prisma client singleton
├── types/                 # Shared TypeScript types
└── test/                  # Test setup
```

## Architecture Patterns

### Data Flow
- **Server Components** fetch data via Prisma, serialize Decimal fields to numbers
- **Client Components** (`"use client"`) handle interactivity, call API routes for mutations
- **API Routes** use shared helpers from `lib/api-utils.ts`:
  - `requireAuth()` - Validates session (supports both server session and JWT)
  - `requireWriteAccess()` - Checks user has ADMIN, PARTNER, or ASSOCIATE role

### Shared Code
- **Types:** Import from `@/types` for Client, TimeEntry, FormData interfaces
- **Hooks:** `useClickOutside` for dropdown/modal close behavior
- **Validation:** Use `isValidEmail`, `isValidHours`, `isValidDescription` from api-utils

### Role-Based Access
| Role | Read | Write |
|------|------|-------|
| ADMIN, PARTNER, ASSOCIATE | Yes | Yes |
| PARALEGAL, EMPLOYEE | Yes | No |

## Database

**Development:** Local PostgreSQL 17 via Homebrew

```bash
# Start PostgreSQL
brew services start postgresql@17

# After schema changes
npm run db:generate && npm run db:migrate
# Then restart dev server
```

**Troubleshooting:**
- "Column does not exist" → Restart dev server after `db:generate`
- "Can't reach database" → Check `brew services list | grep postgresql`

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
- `--accent-pink` (#c97b98) - Primary accent (Dusty Rose)

**Typography:** Roboto Condensed (headings) + Roboto (body)

**Animation rule:** No page entrance animations. Use `animate-fade-up` only for interactive elements (dropdowns, modals, popovers).

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
- **timesheetCode**: Unique short code for each client (e.g., "VED001")
