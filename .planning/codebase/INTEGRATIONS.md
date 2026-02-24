# External Integrations

**Analysis Date:** 2026-02-24

## APIs & External Services

**Microsoft 365 / Azure AD:**
- Azure Active Directory (Azure AD) - Identity provider for SSO authentication
  - SDK/Client: `next-auth/providers/azure-ad` (NextAuth AzureAD provider)
  - Auth: `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`
  - OAuth scopes: `openid profile email User.Read Calendars.Read Mail.Read offline_access`
  - Token refresh: Handled in `app/src/lib/auth.ts` JWT callback via `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token`

- Microsoft Graph API - Calendar and email activity data for timesheet context
  - Base URL: `https://graph.microsoft.com/v1.0`
  - Endpoints used:
    - `GET /me/calendarView` - Fetch calendar events for a date range
    - `GET /me/mailFolders/Inbox/messages` - Fetch received emails
    - `GET /me/mailFolders/SentItems/messages` - Fetch sent emails
    - `GET /me/photo/$value` - Fetch user profile photo (called at sign-in)
  - Implementation: `app/src/app/api/m365/activity/route.ts`
  - Auth: Bearer token from session (`session.accessToken`) obtained during Azure AD login
  - Timezone header: `Prefer: 'outlook.timezone="UTC"'` sent on calendar requests

**Google Fonts:**
- Roboto and Roboto Condensed loaded via Next.js `next/font/google` at build time
  - Implementation: `app/src/app/layout.tsx`
  - CSP allows: `font-src 'self' https://fonts.gstatic.com`
  - No API key required (public CDN)

## Data Storage

**Databases:**
- PostgreSQL 17
  - Development: Local PostgreSQL 17 via Homebrew
  - Production: Azure PostgreSQL Flexible Server (EU region)
  - Connection: `DATABASE_URL` environment variable (connection string format)
  - Client: Drizzle ORM (`drizzle-orm/node-postgres`) with `pg` connection pool
  - Pool config: max 10 connections, 30s idle timeout, 5s connection timeout
  - Pool implementation: `app/src/lib/drizzle.ts` (singleton pattern using `globalThis`)

**File Storage:**
- Local filesystem only
  - PDF export is generated on-demand and streamed directly to the browser; not persisted
  - User profile photos are fetched from Microsoft Graph API on login and stored as base64 data URLs in the `users.image` database column

**Caching:**
- None (no Redis, Memcached, or other cache layer)
- Next.js default fetch caching applies for server components

## Authentication & Identity

**Auth Provider:**
- NextAuth.js with Azure AD (Microsoft 365 SSO) — the only login method
  - Implementation: `app/src/lib/auth.ts`
  - Sign-in page: `app/src/app/login/` (custom)
  - Session strategy: JWT, max 8 hours
  - Whitelist enforcement: Only users pre-existing in `users` table can log in; checked in `signIn` callback
  - Inactive users are blocked at login
  - Token auto-refresh: Implemented in JWT callback; refreshes ~5 minutes before expiry

**Session Extension Fields:**
- `session.accessToken` — Microsoft Graph API Bearer token
- `session.error` — Set to `"RefreshTokenError"` when token refresh fails
- Types: `app/src/types/next-auth.d.ts`

**Middleware Protection:**
- `app/src/middleware.ts` uses NextAuth `withAuth` to protect all routes except `/login` and `/api/auth/*`
- Admin routes additionally protected by position check in layout and `requireAdmin()` in API routes

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, or equivalent integrated)

**Logs:**
- `console.log`, `console.warn`, `console.error` used throughout server-side code
- No structured logging library

## CI/CD & Deployment

**Hosting:**
- Azure Web App (EU region)
- Build output: `next build` with `output: "standalone"` in `app/next.config.ts`
- Deployed as standalone Next.js package (`.next/standalone/`)

**CI Pipeline:**
- GitHub Actions — `.github/workflows/ci.yml`
  - Trigger: Pull requests to `main`
  - Steps: Install deps → Run all tests → Check migrations are in sync with schema
  - Node 22 on `ubuntu-latest`

**Deployment Pipeline:**
- GitHub Actions — `.github/workflows/deploy-prod.yml`
  - Trigger: Push to `main` branch
  - Steps: Install deps → Build → Deploy to Azure Web App
  - Credentials: `AZURE_CREDENTIALS` and `AZURE_WEBAPP_NAME` GitHub secrets

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_URL` — Public app URL (e.g., `http://localhost:3000`)
- `NEXTAUTH_SECRET` — NextAuth JWT encryption secret
- `AZURE_AD_CLIENT_ID` — Azure app registration client ID
- `AZURE_AD_CLIENT_SECRET` — Azure app registration client secret
- `AZURE_AD_TENANT_ID` — Azure AD tenant ID

**Secrets location:**
- Local: `app/.env` (not committed)
- Production: `app/.env.prod` (not committed) + GitHub Actions secrets for deployment credentials

## Webhooks & Callbacks

**Incoming:**
- `/api/auth/callback/azure-ad` — NextAuth OAuth callback from Azure AD (handled automatically by NextAuth)

**Outgoing:**
- None (no outgoing webhooks configured)

---

*Integration audit: 2026-02-24*
