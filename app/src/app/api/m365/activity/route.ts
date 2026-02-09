import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DEADLINE_TIMEZONE, getTimezoneOffsetHours } from "@/lib/submission-utils";
import type { M365CalendarEvent, M365Email, M365ActivityResponse } from "@/types/m365";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

/**
 * Validate date string is in YYYY-MM-DD format and represents a valid date.
 */
function isValidDateFormat(dateStr: string): boolean {
  // Check format matches YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return false;
  }

  // Check it's a valid date
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

interface GraphAttendee {
  emailAddress: { name?: string; address: string };
}

interface GraphCalendarEvent {
  subject: string;
  start: { dateTime: string };
  end: { dateTime: string };
  attendees?: GraphAttendee[];
}

interface GraphRecipient {
  emailAddress: { name?: string; address: string };
}

interface GraphEmail {
  subject: string;
  from?: { emailAddress: { name?: string; address: string } };
  toRecipients?: GraphRecipient[];
  receivedDateTime?: string;
  sentDateTime?: string;
}

/**
 * GET /api/m365/activity
 *
 * Fetches calendar events and emails for a given date from Microsoft 365.
 *
 * Query params:
 * - date: Required, YYYY-MM-DD format
 *
 * Returns:
 * - 200: M365ActivityResponse { calendar: [...], emails: [...] }
 * - 400: Invalid or missing date parameter
 * - 401: Not authenticated or session expired
 * - 500: Graph API error
 */
export async function GET(request: NextRequest) {
  // Get session with access token
  const session = await getServerSession(authOptions);

  // Check authentication
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check for token refresh error
  if (session.error === "RefreshTokenError") {
    return NextResponse.json(
      { error: "Session expired. Please sign in again.", code: "SESSION_EXPIRED" },
      { status: 401 }
    );
  }

  // Check for access token
  if (!session.accessToken) {
    return NextResponse.json(
      { error: "No access token available. Please sign in again.", code: "NO_ACCESS_TOKEN" },
      { status: 401 }
    );
  }

  // Validate date parameter
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Date parameter is required" }, { status: 400 });
  }

  if (!isValidDateFormat(date)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  // Calculate date range aligned to the user's local day (Europe/Sofia).
  // Sofia midnight = 22:00 UTC (winter, UTC+2) or 21:00 UTC (summer, UTC+3).
  const queryDate = new Date(`${date}T12:00:00Z`);
  const offsetHours = getTimezoneOffsetHours(queryDate, DEADLINE_TIMEZONE);
  const startDateTime = new Date(Date.UTC(
    queryDate.getUTCFullYear(), queryDate.getUTCMonth(), queryDate.getUTCDate(),
    -offsetHours, 0, 0, 0
  )).toISOString();
  const endDateTime = new Date(Date.UTC(
    queryDate.getUTCFullYear(), queryDate.getUTCMonth(), queryDate.getUTCDate(),
    24 - offsetHours, 0, 0, 0
  )).toISOString();

  try {
    // Fetch calendar events and emails (inbox + sent) in parallel
    const [calendarResponse, inboxResponse, sentResponse] = await Promise.all([
      fetchCalendarEvents(session.accessToken, startDateTime, endDateTime),
      fetchInboxEmails(session.accessToken, startDateTime, endDateTime),
      fetchSentEmails(session.accessToken, startDateTime, endDateTime),
    ]);

    // Check for Graph API errors
    if (!calendarResponse.ok) {
      console.error("Calendar API error:", calendarResponse.status);
      return NextResponse.json(
        { error: "Failed to fetch M365 activity data", code: "GRAPH_ERROR" },
        { status: 500 }
      );
    }

    if (!inboxResponse.ok) {
      console.error("Inbox API error:", inboxResponse.status);
      return NextResponse.json(
        { error: "Failed to fetch M365 activity data", code: "GRAPH_ERROR" },
        { status: 500 }
      );
    }

    if (!sentResponse.ok) {
      console.error("Sent mail API error:", sentResponse.status);
      return NextResponse.json(
        { error: "Failed to fetch M365 activity data", code: "GRAPH_ERROR" },
        { status: 500 }
      );
    }

    const calendarData = await calendarResponse.json();
    const inboxData = await inboxResponse.json();
    const sentData = await sentResponse.json();

    // Transform calendar events - calculate duration, extract attendees
    // Graph API returns dateTime without Z suffix even for UTC values,
    // so we normalize by appending Z for unambiguous frontend parsing.
    const calendar: M365CalendarEvent[] = (calendarData.value || []).map(
      (event: GraphCalendarEvent) => {
        const startDt = event.start?.dateTime;
        const endDt = event.end?.dateTime;
        const startUtc = startDt && !startDt.endsWith("Z") ? startDt + "Z" : startDt;
        const endUtc = endDt && !endDt.endsWith("Z") ? endDt + "Z" : endDt;

        const startTime = new Date(startUtc);
        const endTime = new Date(endUtc);
        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

        const attendees = (event.attendees || []).map(
          (a: GraphAttendee) => a.emailAddress?.name || a.emailAddress?.address
        );

        return {
          subject: event.subject,
          start: startUtc,
          durationMinutes,
          attendees,
        };
      }
    );

    // Transform inbox emails (received)
    const receivedEmails: M365Email[] = (inboxData.value || []).map(
      (email: GraphEmail) => ({
        subject: email.subject,
        timestamp: email.receivedDateTime || "",
        from: email.from?.emailAddress?.name || email.from?.emailAddress?.address || "",
        to: (email.toRecipients || []).map(
          (r: GraphRecipient) => r.emailAddress?.name || r.emailAddress?.address
        ),
        direction: "received" as const,
      })
    );

    // Transform sent emails
    const sentEmails: M365Email[] = (sentData.value || []).map((email: GraphEmail) => ({
      subject: email.subject,
      timestamp: email.sentDateTime || "",
      from: email.from?.emailAddress?.name || email.from?.emailAddress?.address || "",
      to: (email.toRecipients || []).map(
        (r: GraphRecipient) => r.emailAddress?.name || r.emailAddress?.address
      ),
      direction: "sent" as const,
    }));

    // Combine and sort emails by timestamp
    const emails = [...receivedEmails, ...sentEmails].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const response: M365ActivityResponse = { calendar, emails };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching M365 activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch M365 activity data", code: "GRAPH_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * Fetch calendar events from Microsoft Graph API.
 */
async function fetchCalendarEvents(
  accessToken: string,
  startDateTime: string,
  endDateTime: string
): Promise<Response> {
  const url = new URL(`${GRAPH_BASE_URL}/me/calendarView`);
  url.searchParams.set("startDateTime", startDateTime);
  url.searchParams.set("endDateTime", endDateTime);
  url.searchParams.set("$select", "subject,start,end,attendees");

  return fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  });
}

/**
 * Fetch inbox (received) emails from Microsoft Graph API.
 */
async function fetchInboxEmails(
  accessToken: string,
  startDateTime: string,
  endDateTime: string
): Promise<Response> {
  const url = new URL(`${GRAPH_BASE_URL}/me/mailFolders/Inbox/messages`);
  url.searchParams.set(
    "$filter",
    `receivedDateTime ge ${startDateTime} and receivedDateTime lt ${endDateTime}`
  );
  url.searchParams.set("$select", "subject,from,toRecipients,receivedDateTime");

  return fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

/**
 * Fetch sent emails from Microsoft Graph API.
 */
async function fetchSentEmails(
  accessToken: string,
  startDateTime: string,
  endDateTime: string
): Promise<Response> {
  const url = new URL(`${GRAPH_BASE_URL}/me/mailFolders/SentItems/messages`);
  url.searchParams.set(
    "$filter",
    `sentDateTime ge ${startDateTime} and sentDateTime lt ${endDateTime}`
  );
  url.searchParams.set("$select", "subject,from,toRecipients,sentDateTime");

  return fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
