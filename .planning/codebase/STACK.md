# Technology Stack

**Analysis Date:** 2026-02-24

## Languages

**Primary:**
- TypeScript 5.x - Full codebase, strict mode enabled, used in all source files
- JSX/TSX - React components and Next.js pages
- SQL - Database migrations and schema (PostgreSQL dialect)

**Secondary:**
- JavaScript - Build configuration files (ESLint, PostCSS, Vitest configs)

## Runtime

**Environment:**
- Node.js 22 (production target per `.github/workflows/ci.yml`)
- Built with Next.js 16 App Router

**Package Manager:**
- npm 10.x (inferred from Node 22)
- Lockfile: `package-lock.json` present and committed

## Frameworks

**Core:**
- Next.js 16.0.10 - Full-stack React framework with App Router
- React 19.2.1 - UI library with concurrent features
- React DOM 19.2.1 - React rendering engine

**Testing:**
- Vitest 4.0.16 - Unit/integration test runner (jsdom environment)
- @testing-library/react 16.3.1 - Component testing utilities
- @testing-library/dom 10.4.1 - DOM testing utilities
- @testing-library/jest-dom 6.9.1 - Custom matchers (@testing-library/jest-dom/vitest)
- @vitest/coverage-v8 4.0.16 - Code coverage reports

**Build/Dev:**
- TypeScript 5.x - Language compiler
- ESLint 9.x - Linting (Next.js web vitals + TypeScript config)
- Tailwind CSS 4.x - Utility-first CSS framework
- PostCSS 8.x - CSS processing pipeline
- @tailwindcss/postcss 4.x - Tailwind PostCSS integration
- Drizzle Kit 0.31.8 - Database schema generation and migrations
- tsx - TypeScript execution (used for seed scripts)

## Key Dependencies

**Critical:**
- next-auth 4.24.13 - JWT-based authentication with Azure AD SSO
- drizzle-orm 0.45.1 - TypeScript ORM for PostgreSQL
- pg 8.16.3 - PostgreSQL client library

**Infrastructure:**
- @azure/msal-node 3.8.4 - Microsoft Authentication Library for Node (offline token refresh)
- @paralleldrive/cuid2 3.0.4 - Collision-resistant IDs for database records

**UI/Visualization:**
- @dnd-kit/core 6.3.1 - Drag-and-drop primitives
- @dnd-kit/sortable 10.0.0 - Sortable list components (topics, line items)
- @dnd-kit/utilities 3.2.2 - DnD utilities (CSS transforms)
- @react-pdf/renderer 4.3.1 - PDF generation for service descriptions
- recharts 3.6.0 - React charting library for reports/analytics

**Data Handling:**
- csv-parse 6.1.0 - CSV parsing for timesheet imports
- xlsx 0.18.5 - Excel file read/write for exports
- dotenv 17.2.3 - Environment variable loading for scripts

## Configuration

**Environment:**
- `.env` file in `app/` directory - Development configuration
- `.env.prod` file - Production secrets (not committed, Azure deployment)
- `NEXTAUTH_SECRET` - JWT signing key (openssl rand -base64 32)
- `NEXTAUTH_URL` - Session callback URL (http://localhost:3000 dev, production URL in prod)

**Build:**
- `next.config.ts` - Next.js configuration with security headers (CSP, HSTS, X-Frame-Options)
- `tsconfig.json` - TypeScript compiler options (ES2017 target, strict mode)
- `drizzle.config.ts` - Drizzle ORM schema generation (PostgreSQL dialect)
- `vitest.config.ts` - Test runner configuration (jsdom, global test APIs)
- `eslint.config.mjs` - ESLint rules (Next.js web vitals + TypeScript)
- `postcss.config.mjs` - PostCSS pipeline for Tailwind CSS

## Platform Requirements

**Development:**
- Node.js 22.x
- PostgreSQL 17.x (local via Homebrew: `brew services start postgresql@17`)
- npm 10.x
- Git with worktrees support (feature development uses `.worktrees/`)

**Production:**
- Azure Web App (Node.js runtime)
- Azure PostgreSQL Flexible Server (Europe region)
- Output: `standalone` mode for containerization
- Security headers: CSP with Microsoft login domains, HSTS enabled

## Build Optimization

**Output Mode:** `standalone` - Self-contained deployment artifact excluding node_modules

**Security Headers (next.config.ts):**
- Content-Security-Policy: Allows `'self'`, Microsoft login domains, `unsafe-inline`/`unsafe-eval` (Next.js requirement)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security: 31536000 seconds (1 year, production)
- Referrer-Policy: strict-origin-when-cross-origin

**Build Timestamp:** Generated at build time in Europe/Sofia timezone and injected as `NEXT_PUBLIC_BUILD_ID` env var

---

*Stack analysis: 2026-02-24*
