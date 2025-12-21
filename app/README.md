# Veda Legal Timesheets - Next.js Application

This directory contains the Next.js 16 application for Veda Legal Timesheets.

## Development

```bash
npm run dev          # Start development server at http://localhost:3000
npm run build        # Build for production
npm run lint         # Run ESLint
npm run test         # Run tests (when configured)
```

## Database Commands

```bash
npm run db:generate  # Generate Prisma client after schema changes
npm run db:migrate   # Run pending migrations
npm run db:studio    # Open Prisma Studio for data inspection
```

## Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (authenticated)/   # Protected routes (require login)
│   │   ├── clients/       # Client management page
│   │   ├── timesheets/    # Timesheet entry page
│   │   └── page.tsx       # Dashboard
│   ├── api/               # API routes
│   │   ├── auth/          # NextAuth handlers
│   │   ├── clients/       # Client CRUD
│   │   └── timesheets/    # Time entry CRUD
│   ├── login/             # Public login page
│   ├── globals.css        # Design system variables
│   ├── layout.tsx         # Root layout with providers
│   └── not-found.tsx      # 404 page
├── components/
│   ├── layout/            # Sidebar, Header
│   ├── dashboard/         # Dashboard widgets
│   ├── clients/           # Client list and forms
│   ├── timesheets/        # Timesheet components
│   └── ui/                # Reusable UI components
├── hooks/                 # Custom React hooks
│   └── useClickOutside.ts
├── lib/                   # Utilities
│   ├── auth.ts            # NextAuth configuration
│   ├── db.ts              # Prisma client singleton
│   ├── api-utils.ts       # API route helpers
│   └── date-utils.ts      # Date formatting utilities
└── types/                 # Shared TypeScript types
    └── index.ts

prisma/
├── schema.prisma          # Database schema
└── migrations/            # Migration history
```

## Design System

The application uses CSS variables for theming (defined in `globals.css`):

- `--bg-deep` - Main background (#151515)
- `--bg-elevated` - Card/sidebar background (#1c1c1c)
- `--bg-surface` - Input/nested elements (#383838)
- `--accent-pink` - Primary accent color (#c97b98)
- `--text-primary` - Headings (#ffffff)
- `--text-secondary` - Body text (#d1d1d1)
- `--text-muted` - Labels/captions (#888888)

## Authentication

Uses NextAuth.js with Microsoft 365 (Azure AD) SSO. Configure in `.env`:

```env
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret
AZURE_AD_TENANT_ID=your-tenant-id
```

## API Routes

All API routes require authentication. Write operations require ADMIN, PARTNER, or ASSOCIATE role.

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/clients` | GET, POST, PATCH, DELETE | Client management |
| `/api/timesheets` | GET, POST, PATCH, DELETE | Time entry management |
| `/api/timesheets/dates` | GET | Dates with entries |

## Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_URL` - Application URL
- `NEXTAUTH_SECRET` - Session encryption (generate with `openssl rand -base64 32`)
- Azure AD credentials (see Authentication section)
