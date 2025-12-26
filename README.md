# Veda Legal Timesheets

A modern timesheet management application for legal practice, built with Next.js 16 and designed for a small legal firm.

## Features

- Microsoft 365 SSO authentication via Azure AD
- Time entry management with client tracking
- Role-based access control (Admin, Employee)
- Dark theme UI aligned with Veda branding
- Responsive design for desktop and mobile

## Tech Stack

- **Framework:** Next.js 16 (App Router) with TypeScript
- **Styling:** Tailwind CSS v4 with custom design system
- **Auth:** NextAuth.js with Azure AD
- **Database:** PostgreSQL with Drizzle ORM
- **Testing:** Vitest + React Testing Library
- **Target Platform:** Azure (EU region)

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 17
- Azure AD application configured

### Installation

```bash
# Clone the repository
git clone https://github.com/stefanratchev/Veda-Legal.git
cd veda-legal-timesheets

# Install dependencies
cd app
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Generate Drizzle client
npm run db:generate

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

## Project Structure

```
veda-legal-timesheets/
├── app/                    # Next.js application
│   ├── src/
│   │   ├── app/           # App Router pages and API routes
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utilities and configurations
│   │   ├── test/          # Test setup and utilities
│   │   └── types/         # Shared TypeScript types
│   ├── drizzle/           # Database migrations
│   └── package.json
├── docs/                   # Documentation and plans
├── CLAUDE.md              # AI assistant instructions
└── README.md              # This file
```

## Development

```bash
cd app

npm run dev            # Start dev server
npm run build          # Production build
npm run lint           # Run ESLint
npm run test           # Run tests (Vitest)
npm run test:coverage  # Run tests with coverage
npm run db:generate    # Generate Drizzle migrations
npm run db:migrate     # Run migrations
npm run db:studio      # Open Drizzle Studio
```

## Environment Variables

Required in `app/.env`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | Application URL (http://localhost:3000 for dev) |
| `NEXTAUTH_SECRET` | Session encryption key |
| `AZURE_AD_CLIENT_ID` | Azure AD application ID |
| `AZURE_AD_CLIENT_SECRET` | Azure AD client secret |
| `AZURE_AD_TENANT_ID` | Azure AD tenant ID |

## Database

The application uses PostgreSQL. For local development:

```bash
# macOS with Homebrew
brew install postgresql@17
brew services start postgresql@17
/opt/homebrew/opt/postgresql@17/bin/createdb veda_legal_dev
```

## User Roles

| Role | Permissions |
|------|-------------|
| ADMIN | Full access, user management, create/edit clients and time entries |
| EMPLOYEE | Read-only access |

## License

Private - Veda Legal
