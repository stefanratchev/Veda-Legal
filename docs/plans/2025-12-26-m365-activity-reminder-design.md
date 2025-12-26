# M365 Activity Reminder Feature

Pull calendar events and emails from Microsoft 365 to help employees recall what they did when filling in timesheets.

## Overview

A button in the WeekStrip component allows employees to fetch their M365 activity (calendar events and emails) for the selected date. Results display in a collapsible panel between the WeekStrip and the entry form.

## UI Layout

### WeekStrip Button Placement

Right-side controls become a 2-row vertical stack (same total height as before):
- Top row: Calendar icon + Today button
- Bottom row: M365 Activity button

```
┌────────────────────────────────────────────────────────────────────────────┐
│       │                                         │     │                    │
│  [<]  │ Mon  Tue  Wed  Thu  Fri  Sat  Sun      │ [>] │  [📅] [Today]      │
│       │  23   24   25   26   27   28   29      │     │  [📨 M365 Activity]│
│       │                                         │     │                    │
└────────────────────────────────────────────────────────────────────────────┘
```

### M365ActivityPanel

Two-column layout appearing between WeekStrip and EntryForm:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📅 Calendar (3)                                           📧 Emails (5)    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 09:00  Client call - ABC Ltd (45min)                 ↑ To: john@client.com │
│        with: john@client.com, jane@partner.com         Re: Contract review │
│                                                                             │
│ 11:30  Internal standup (15min)                      ↓ From: boss@firm.com │
│        with: team@veda.uk                              Q3 billing update   │
│                                                                             │
│ 14:00  M&A discussion (1hr 30min)                    ↑ To: legal@other.com │
│        with: client@bigco.com, counsel@law.com         Due diligence docs  │
└─────────────────────────────────────────────────────────────────────────────┘
```

- Calendar: Time, subject, duration in parentheses, attendees on second line
- Emails: Arrow icon (↑ sent / ↓ received), recipient/sender, subject
- Close button (X) in top-right corner

### Panel Behavior

- Panel closes when navigating between dates
- User must click button each time to fetch data
- No automatic fetching

## Data Model

### API Endpoint

`GET /api/m365/activity?date=YYYY-MM-DD`

### Response Shape

```typescript
interface M365ActivityResponse {
  calendar: {
    subject: string;
    start: string;           // ISO timestamp
    durationMinutes: number;
    attendees: string[];     // Display names or emails
  }[];
  emails: {
    subject: string;
    timestamp: string;       // ISO timestamp
    from: string;            // Sender
    to: string[];            // Recipients
    direction: 'sent' | 'received';
  }[];
}
```

## Microsoft Graph API

### Required Scopes

```typescript
scope: "openid profile email User.Read Calendars.Read Mail.Read"
```

### API Calls

**Calendar events:**
```
GET /me/calendarView?startDateTime={startOfDay}&endDateTime={endOfDay}
$select=subject,start,end,attendees
```

**Sent emails:**
```
GET /me/mailFolders/SentItems/messages
$filter=sentDateTime ge {startOfDay} and sentDateTime lt {endOfDay}
$select=subject,sentDateTime,toRecipients
```

**Received emails:**
```
GET /me/mailFolders/Inbox/messages
$filter=receivedDateTime ge {startOfDay} and receivedDateTime lt {endOfDay}
$select=subject,receivedDateTime,from,toRecipients
```

## Token Refresh Implementation

Azure AD access tokens expire after ~1 hour. Implement automatic refresh:

```typescript
async jwt({ token, account }) {
  // Initial sign-in: store all token info
  if (account) {
    return {
      ...token,
      accessToken: account.access_token,
      refreshToken: account.refresh_token,
      expiresAt: account.expires_at * 1000,
    };
  }

  // Return existing token if not expired (with 5min buffer)
  if (Date.now() < (token.expiresAt as number) - 5 * 60 * 1000) {
    return token;
  }

  // Token expired - refresh it
  try {
    const response = await fetch(
      `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.AZURE_AD_CLIENT_ID!,
          client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
          grant_type: "refresh_token",
          refresh_token: token.refreshToken as string,
        }),
      }
    );

    const refreshed = await response.json();
    if (!response.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
    };
  } catch (error) {
    console.error("Token refresh failed:", error);
    return { ...token, error: "RefreshTokenError" };
  }
}
```

## Loading & Error States

| Scenario | User Message | Action |
|----------|--------------|--------|
| Loading | Spinner on button, skeleton in panel | - |
| Token refresh failed | "Session expired. Please refresh the page." | Refresh link |
| Graph API error (5xx) | "Couldn't reach Microsoft 365. Try again." | Retry button |
| No data for date | "No M365 activity found for [date]." | - |
| Network error | "Connection failed. Check your internet." | Retry button |

## File Changes

### Modified Files

| File | Changes |
|------|---------|
| `lib/auth.ts` | Add `Calendars.Read Mail.Read` scopes, implement token refresh, expose accessToken to session |
| `types/next-auth.d.ts` | Extend Session type with `accessToken` and `error` fields |
| `components/timesheets/WeekStrip.tsx` | Add M365 Activity button, restructure right-side to 2-row layout |
| `components/timesheets/TimesheetsContent.tsx` | Add M365ActivityPanel between WeekStrip and EntryForm, manage panel state |

### New Files

| File | Purpose |
|------|---------|
| `app/api/m365/activity/route.ts` | API endpoint for Microsoft Graph calls |
| `app/api/m365/activity/route.test.ts` | API endpoint tests |
| `components/timesheets/M365ActivityPanel.tsx` | Collapsible panel component |
| `components/timesheets/M365ActivityPanel.test.tsx` | Panel component tests |
| `types/m365.ts` | TypeScript types for M365 activity data |

## Test Coverage

### API Route Tests

- Returns calendar events and emails for valid date
- Returns 401 when not authenticated
- Returns 401 with message when token refresh failed
- Handles Graph API errors gracefully
- Filters emails/events to requested date only

### Component Tests

- Renders calendar events with subject, time, duration, attendees
- Renders sent emails with ↑ icon and recipients
- Renders received emails with ↓ icon and sender
- Shows loading state while fetching
- Shows error message on failure
- Shows empty state when no data
- Close button dismisses panel
