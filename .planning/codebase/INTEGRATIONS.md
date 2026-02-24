# External Integrations

**Analysis Date:** 2026-02-24

## APIs & External Services

**Microsoft 365 / Azure AD:**
- **Purpose:** User authentication, calendar events, email activity tracking
- **SDK/Client:**
  - NextAuth.js `AzureADProvider` for OAuth2
  - @azure/msal-node 3.8.4 for offline token refresh
  - Native `fetch` for Graph API calls
- **Auth:**
  - `AZURE_AD_CLIENT_ID` - Azure Portal app registration
  - `AZURE_AD_CLIENT_SECRET` - App registration client secret
  - `AZURE_AD_TENANT_ID` - Azure AD tenant ID
  - OAuth2 scopes: `openid profile email User.Read Calendars.Read Mail.Read offline_access`

**Microsoft Graph API:**
- **Calendar Events:** `GET https://graph.microsoft.com/v1.0/me/calendarview` (date range query)
- **Email:** `GET https://graph.microsoft.com/v1.0/me/messages` (filtered by date range)
- **User Photo:** `GET https://graph.microsoft.com/v1.0/me/photo/$value` (base64 encoded image)
- **Implementation:** `app/src/app/api/m365/activity/route.ts`
- **Notes:**
  - Calendar events return `start.dateTime` WITHOUT Z suffix (use separate `timeZone` field)
  - Email timestamps include Z suffix
  - Timezone handling: All users in Bulgaria (Europe/Sofia), UTC+2/+3 DST
  - Preference header: `Prefer: 'outlook.timezone="UTC"'` for consistent formatting

## Data Storage

**Databases:**
- PostgreSQL 17.x
  - Connection: `DATABASE_URL` env var (postgresql://user:pass@host:5432/dbname)
  - Client: Drizzle ORM 0.45.1 with pg driver (8.16.3)
  - Region: Europe (Azure PostgreSQL Flexible Server in production)
  - Schema: `app/src/lib/schema.ts` (12 tables: users, clients, service descriptions, line items, topics, subtopics, etc.)
  - Migrations: Drizzle-generated SQL files in `drizzle/` directory (committed)

**File Storage:**
- Local filesystem only
  - Logo: `public/logo-print.png` (used in PDF generation)
  - Static assets: `public/` directory
  - No cloud storage (S3, Azure Blob, etc.)

**Caching:**
- None configured
- JWT sessions via NextAuth (in-memory on server, httpOnly cookies on client)

## Authentication & Identity

**Auth Provider:**
- Microsoft 365 (Azure AD) via OAuth2
- Provider implementation: `app/src/lib/auth.ts` (NextAuthOptions)
- Strategy: JWT with refresh token rotation

**Key Flows:**
1. **Login:** User redirected to `https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/...`
2. **Whitelist Check:** signIn callback verifies user exists in database (email match)
3. **Token Refresh:** 5-minute buffer before expiration, refresh via `POST https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token`
4. **Session:** 8-hour maxAge, JWT strategy with custom fields
5. **Impersonation:** ADMIN-only cookie-based impersonation at `app/src/app/api/admin/impersonate/route.ts`

**Custom Session Fields (src/types/next-auth.d.ts):**
- `session.accessToken` - Microsoft Graph API bearer token
- `session.error` - Token refresh error state (RefreshTokenError)

**Middleware:** `app/src/middleware.ts` protects all routes except `/login`, `/api/auth`, and static assets

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Rollbar, or similar configured)
- Errors logged to console (development) or Azure app logs (production)

**Logs:**
- Server-side: `console.log()`, `console.error()`, `console.warn()`
- Client-side: Browser console only
- Production: Azure Web App application insights (configured by Azure, not explicitly in code)

**Debugging:**
- NextAuth debug mode: Enabled in development (`process.env.NODE_ENV === "development"`)

## CI/CD & Deployment

**Hosting:**
- Azure Web App (Node.js 22 runtime)
- Azure PostgreSQL Flexible Server (Europe region, credentials in `.env.prod`)

**CI Pipeline:**
- GitHub Actions (`.github/workflows/ci.yml`)
- Trigger: Pull requests to main branch
- Steps:
  1. Checkout code
  2. Setup Node.js 22
  3. Install dependencies (`npm ci`)
  4. Run tests (`npm run test -- --run`)
  5. Verify migrations sync'd with schema (`npx drizzle-kit generate`)
- Fails if tests fail or schema/migrations out of sync

**CD Pipeline:**
- GitHub Actions (`.github/workflows/deploy-prod.yml`)
- Trigger: Merge to main branch
- Builds standalone Next.js artifact, deploys to Azure Web App
- Requires passing CI checks

**Database Migrations:**
- Generated via `npm run db:generate` (Drizzle Kit)
- Committed alongside schema changes
- Applied via `npm run db:migrate` (local) or `/migrate-prod` command (production)
- CI enforces: Migration file must exist for every schema change (prevents production sync errors)

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_URL` - NextAuth callback URL (http://localhost:3000 dev)
- `NEXTAUTH_SECRET` - JWT signing key (generate: `openssl rand -base64 32`)
- `AZURE_AD_CLIENT_ID` - Azure Portal app registration ID
- `AZURE_AD_CLIENT_SECRET` - Azure Portal app registration secret
- `AZURE_AD_TENANT_ID` - Azure AD tenant ID
- `NODE_ENV` - "development" or "production"

**Secrets location:**
- Development: `app/.env` (git ignored, not committed)
- Production: `app/.env.prod` (git ignored, not committed, managed by Azure deployment)
- Build time: `NEXT_PUBLIC_BUILD_ID` injected from `next.config.ts`

## Webhooks & Callbacks

**Incoming:**
- None configured
- Time entries are polled via `GET /api/m365/activity?date=YYYY-MM-DD` on user request

**Outgoing:**
- None configured
- No push notifications or external webhooks triggered

**NextAuth Callbacks:**
- `signIn()` - Whitelist verification, user status check, Azure photo fetch
- `jwt()` - Token refresh logic (5-min buffer before expiration)
- `session()` - Custom session fields population (accessToken, error)

---

*Integration audit: 2026-02-24*
