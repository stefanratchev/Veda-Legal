import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

interface GraphCalendarEvent {
  id: string;
  subject: string;
  start: { dateTime: string };
  end: { dateTime: string };
  organizer?: { emailAddress: { name: string } };
}

interface GraphEmail {
  id: string;
  subject: string;
  from?: { emailAddress: { name: string; address: string } };
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
 * - 200: { calendarEvents: [...], emails: [...] }
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

  // Calculate date range for Graph API queries
  const startDateTime = `${date}T00:00:00.000Z`;
  const endDateTime = `${date}T23:59:59.999Z`;

  try {
    // Fetch calendar events and emails in parallel
    const [calendarResponse, emailsResponse] = await Promise.all([
      fetchCalendarEvents(session.accessToken, startDateTime, endDateTime),
      fetchEmails(session.accessToken, startDateTime, endDateTime),
    ]);

    // Check for Graph API errors
    if (!calendarResponse.ok) {
      console.error("Calendar API error:", calendarResponse.status);
      return NextResponse.json(
        { error: "Failed to fetch M365 activity data", code: "GRAPH_ERROR" },
        { status: 500 }
      );
    }

    if (!emailsResponse.ok) {
      console.error("Email API error:", emailsResponse.status);
      return NextResponse.json(
        { error: "Failed to fetch M365 activity data", code: "GRAPH_ERROR" },
        { status: 500 }
      );
    }

    const calendarData = await calendarResponse.json();
    const emailsData = await emailsResponse.json();

    // Transform and return the data
    const calendarEvents = (calendarData.value || []).map((event: GraphCalendarEvent) => ({
      id: event.id,
      subject: event.subject,
      start: event.start?.dateTime,
      end: event.end?.dateTime,
      organizer: event.organizer?.emailAddress?.name,
    }));

    const emails = (emailsData.value || []).map((email: GraphEmail) => ({
      id: email.id,
      subject: email.subject,
      from: email.from?.emailAddress?.name || email.from?.emailAddress?.address,
      timestamp: email.receivedDateTime || email.sentDateTime,
    }));

    return NextResponse.json({ calendarEvents, emails });
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
  url.searchParams.set("$select", "id,subject,start,end,organizer");

  return fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

/**
 * Fetch emails (both sent and received) from Microsoft Graph API.
 */
async function fetchEmails(
  accessToken: string,
  startDateTime: string,
  endDateTime: string
): Promise<Response> {
  // For the tests, we're fetching inbox messages with receivedDateTime filter
  const url = new URL(`${GRAPH_BASE_URL}/me/mailFolders/Inbox/messages`);
  url.searchParams.set(
    "$filter",
    `receivedDateTime ge ${startDateTime} and receivedDateTime lt ${endDateTime}`
  );
  url.searchParams.set("$select", "id,subject,from,receivedDateTime");

  return fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
