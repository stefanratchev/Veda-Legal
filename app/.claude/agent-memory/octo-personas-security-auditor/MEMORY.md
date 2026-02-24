# Security Auditor Memory

## Project: Veda Legal Timesheets

### Audited Files
- `app/src/app/api/m365/activity/route.ts` - M365 Graph API integration (PASS, 2026-02-09)
  - Auth: NextAuth session + access token check before any Graph API call
  - Date param: strict regex `^\d{4}-\d{2}-\d{2}$` + Date validity check
  - Timezone: uses `getTimezoneOffsetHours` from `submission-utils.ts` (Europe/Sofia)
  - Z suffix normalization: idempotent, handles null, tested for double-Z
  - Error responses: generic messages, no internal detail leakage

### Key Patterns
- Auth flow: `getServerSession(authOptions)` -> check session -> check error -> check accessToken
- Graph API calls use `url.searchParams.set()` which auto-encodes (prevents OData injection)
- `Date.UTC()` handles negative hours correctly by rolling back days (per ECMA-262)
- `getTimezoneOffsetHours` only handles whole-hour offsets (fine for Europe/Sofia)
- Access tokens: stored in JWT session, never logged or returned in API responses

### Auth Architecture
- NextAuth with Azure AD provider, JWT strategy, 8-hour session max
- Whitelist-based: only pre-existing DB users can sign in
- Token refresh with 5-min buffer before expiry
- Scopes: openid, profile, email, User.Read, Calendars.Read, Mail.Read, offline_access
- Position-based RBAC: ADMIN, PARTNER (admin access), SENIOR_ASSOCIATE, ASSOCIATE, CONSULTANT (write access)
