# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Veda Legal Timesheets - A Next.js application for legal practice management and timesheet tracking.

## Tech Stack

- **Framework:** Next.js 16 (App Router) with TypeScript
- **Styling:** Tailwind CSS v4 with custom design system
- **Auth:** NextAuth.js with Microsoft 365 (Azure AD) SSO
- **Database:** PostgreSQL with Prisma ORM v7
- **Hosting target:** Azure (with future on-prem migration capability)

## Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Prisma Studio
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/auth/          # NextAuth API routes
│   ├── login/             # Login page
│   ├── page.tsx           # Dashboard (protected)
│   ├── layout.tsx         # Root layout with fonts
│   └── globals.css        # Design system CSS variables
├── components/
│   ├── layout/            # Sidebar, Header
│   ├── dashboard/         # Dashboard components
│   └── Providers.tsx      # Session provider
├── lib/
│   ├── auth.ts            # NextAuth configuration
│   └── db.ts              # Prisma client
└── middleware.ts          # Auth protection
prisma/
└── schema.prisma          # Database schema
```

## Design System

Dark theme with gold accent (#d4a853). Key CSS variables defined in `globals.css`:
- `--bg-deep`, `--bg-elevated`, `--bg-surface` - background hierarchy
- `--accent-gold` - brand color
- `--text-primary`, `--text-secondary`, `--text-muted` - text hierarchy

Typography: Cormorant Garamond (display) + DM Sans (body)

## Database Models

- **User** - Employees linked to MS365, with role and hourly rate
- **Client** - Client records with practice area and status
- **TimeEntry** - Billable hours logged against clients

## Environment Variables

Required in `.env`:
```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
AZURE_AD_CLIENT_ID=<from Azure Portal>
AZURE_AD_CLIENT_SECRET=<from Azure Portal>
AZURE_AD_TENANT_ID=<from Azure Portal>
DATABASE_URL=postgresql://...
```
