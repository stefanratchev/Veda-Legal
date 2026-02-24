# Technology Stack

**Analysis Date:** 2026-02-24

## Languages

**Primary:**
- TypeScript 5.x - All application source code (`app/src/**/*.ts`, `app/src/**/*.tsx`)

**Secondary:**
- JavaScript (MJS) - Config files only (`eslint.config.mjs`, `postcss.config.mjs`, `app/scripts/generate-favicons.mjs`)
- CSS - Design system (`app/src/app/globals.css`)

## Runtime

**Environment:**
- Node.js 22.x (production target; local dev also runs 22.17.0)

**Package Manager:**
- npm
- Lockfile: `app/package-lock.json` (present, committed)

## Frameworks

**Core:**
- Next.js 16.0.10 - App Router; standalone output mode for Azure deployment
- React 19.2.1 - UI rendering
- React DOM 19.2.1 - DOM bindings

**Auth:**
- NextAuth.js 4.24.13 - Session management, JWT strategy, Azure AD SSO provider
  - Config: `app/src/lib/auth.ts`
  - Middleware: `app/src/middleware.ts`

**Database ORM:**
- Drizzle ORM 0.45.1 - Type-safe PostgreSQL queries
  - Schema: `app/src/lib/schema.ts`
  - Client: `app/src/lib/drizzle.ts`
  - Config: `app/drizzle.config.ts`
  - Migrations: `app/drizzle/`

**Testing:**
- Vitest 4.0.16 - Test runner
  - Config: `app/vitest.config.ts`
  - Setup: `app/src/test/setup.ts`
- React Testing Library 16.3.1 - Component testing
- @testing-library/jest-dom 6.9.1 - DOM assertions
- @vitest/coverage-v8 4.0.16 - Code coverage

**Build/Dev:**
- ESLint 9 with `eslint-config-next` - Linting; config at `app/eslint.config.mjs`
- Tailwind CSS v4 - Utility-first CSS; config via `@tailwindcss/postcss` plugin
- PostCSS - CSS processing; config at `app/postcss.config.mjs`

## Key Dependencies

**UI & Interaction:**
- `recharts` 3.6.0 - Charts and data visualization (`app/src/components/reports/charts/`)
- `@dnd-kit/core` 6.3.1 + `@dnd-kit/sortable` 10.0.0 + `@dnd-kit/utilities` 3.2.2 - Drag-and-drop for billing topic/line item reordering (`app/src/components/billing/ServiceDescriptionDetail.tsx`)
- `@react-pdf/renderer` 4.3.1 - Server-side PDF generation for service descriptions (`app/src/lib/billing-pdf.tsx`, `app/src/app/api/billing/[id]/pdf/route.tsx`)

**Database:**
- `pg` 8.16.3 - PostgreSQL driver (node-postgres), connection pool in `app/src/lib/drizzle.ts`
- `drizzle-kit` 0.31.8 - Schema migration tooling (`npm run db:generate`, `npm run db:migrate`)

**Identity & IDs:**
- `@paralleldrive/cuid2` 3.0.4 - CUID2 ID generation for all database records
- `@azure/msal-node` 3.8.4 - Azure AD MSAL SDK (installed but not directly imported in src; auth handled via NextAuth AzureADProvider)

**Utilities:**
- `dotenv` 17.2.3 - Environment loading in seed scripts
- `csv-parse` 6.1.0 - CSV parsing (available, not directly used in src; likely for scripts)
- `xlsx` 0.18.5 - Excel file handling (devDependency; available for scripts)

**Fonts:**
- Roboto + Roboto Condensed - Loaded via `next/font/google` in `app/src/app/layout.tsx`

## Configuration

**Environment:**
- `app/.env` - Local development environment variables (not committed)
- `app/.env.prod` - Production environment variables (not committed)
- Required vars: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`

**Build:**
- `app/next.config.ts` - `output: "standalone"` for Azure deployment; security headers (CSP, HSTS, X-Frame-Options, etc.)
- `app/tsconfig.json` - TypeScript strict mode, `@/*` alias maps to `app/src/*`, target ES2017
- `app/drizzle.config.ts` - Schema at `./src/lib/schema.ts`, migrations at `./drizzle/`, dialect `postgresql`

**TypeScript Path Aliases:**
- `@/*` → `app/src/*` (configured in both `tsconfig.json` and `vitest.config.ts`)

## Platform Requirements

**Development:**
- Node.js 22
- PostgreSQL 17 (local via Homebrew)
- Azure AD app registration (for SSO)

**Production:**
- Azure Web App (EU region)
- Azure PostgreSQL Flexible Server
- GitHub Actions for CI/CD (`.github/workflows/ci.yml`, `.github/workflows/deploy-prod.yml`)
- Deployment triggered by push to `main` branch
- Node.js 22 on CI runners

---

*Stack analysis: 2026-02-24*
