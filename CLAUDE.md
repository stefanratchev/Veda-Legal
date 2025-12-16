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
- **Hosting target:** Azure (EU region, with future on-prem migration capability)

## Project Structure

```
app/                        # Next.js application
├── src/
│   ├── app/               # App Router pages
│   │   ├── api/auth/      # NextAuth API routes
│   │   ├── login/         # Login page
│   │   ├── page.tsx       # Dashboard (protected)
│   │   ├── layout.tsx     # Root layout with fonts
│   │   └── globals.css    # Design system CSS variables
│   ├── components/
│   │   ├── layout/        # Sidebar, Header
│   │   ├── dashboard/     # Dashboard components
│   │   └── Providers.tsx  # Session provider
│   ├── lib/
│   │   ├── auth.ts        # NextAuth configuration
│   │   └── db.ts          # Prisma client
│   └── middleware.ts      # Auth route protection
├── prisma/
│   └── schema.prisma      # Database schema
├── .env.example           # Environment template
└── package.json
```

## Commands

```bash
cd app
npm run dev          # Start development server (localhost:3000)
npm run build        # Build for production
npm run lint         # Run ESLint
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Prisma Studio
```

## Database Setup

**Development database:** Prisma dev server (embedded PostgreSQL on port 51214)

The database runs via `prisma dev` process. It starts automatically and persists data locally.

### Schema Changes Workflow

After modifying `prisma/schema.prisma`:

1. **Generate Prisma client:** `npm run db:generate`
2. **Apply migration:** `npm run db:migrate` (or `npx prisma db push` for quick dev iterations)
3. **Restart dev server:** Required for Prisma client changes to take effect

### Troubleshooting

- **"Column does not exist" errors:** Restart the dev server after `db:generate`
- **"Can't reach database":** Check if `prisma dev` process is running (`lsof -i :51214`)

## Design System

Dark theme with gold accent. Key CSS variables in `app/src/app/globals.css`:

| Variable | Value | Use |
|----------|-------|-----|
| `--bg-deep` | #0f0f0f | Page background |
| `--bg-elevated` | #1a1a1a | Sidebar, cards |
| `--bg-surface` | #232323 | Inputs, nested elements |
| `--accent-gold` | #d4a853 | Primary brand accent |
| `--text-primary` | #f5f4f0 | Headings |
| `--text-secondary` | #a8a8a4 | Body text |
| `--text-muted` | #6b6b68 | Labels, captions |

**Typography:** Cormorant Garamond (display/headings) + DM Sans (body)

## Database Models

- **User** - Employees linked to MS365 SSO (roles: ADMIN, PARTNER, ASSOCIATE, PARALEGAL, EMPLOYEE)
- **Client** - Client records with timesheetCode, practice area, and status (ACTIVE/INACTIVE)
- **TimeEntry** - Billable hours logged against clients

## Architecture Patterns

- **Server Components** fetch data directly via Prisma, serialize for client components
- **Client Components** (`"use client"`) handle interactivity, call API routes for mutations
- **API Routes** (`app/api/`) use `requireAuth()` and `requireWriteAccess()` helpers for auth
- **Role-based access:** ADMIN, PARTNER, ASSOCIATE have write access; others read-only

## Environment Variables

Required in `app/.env`:
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>
AZURE_AD_CLIENT_ID=<from Azure Portal>
AZURE_AD_CLIENT_SECRET=<from Azure Portal>
AZURE_AD_TENANT_ID=<from Azure Portal>
DATABASE_URL=postgresql://...
```

## Domain Terminology

- **Client**: External party receiving legal services
- **Employee**: Internal staff (partners, associates, paralegals)
- **Case/Matter**: Legal matter being handled
- **Timesheet**: Record of billable/non-billable hours
- **Billable Hours**: Time chargeable to clients
- **Practice Area**: Legal specialty (Corporate, Family, IP, etc.)

