import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { timeEntries } from "@/lib/schema";
import {
  requireAuth,
  getUserFromSession,
  serializeDecimal,
  canViewTeamTimesheets,
} from "@/lib/api-utils";

function serializeTimeEntry(entry: {
  id: string;
  date: string;
  hours: string;
  description: string;
  clientId: string;
  client: { id: string; name: string } | null;
  subtopicId: string | null;
  topicName: string;
  subtopicName: string;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    ...entry,
    hours: serializeDecimal(entry.hours),
  };
}

// GET /api/timesheets/team/[userId]?date=YYYY-MM-DD
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const currentUser = await getUserFromSession(auth.session.user?.email);
  if (!currentUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Authorization: only ADMIN/PARTNER can view team entries
  if (!currentUser.position || !canViewTeamTimesheets(currentUser.position)) {
    return NextResponse.json(
      { error: "You don't have permission to view team timesheets" },
      { status: 403 }
    );
  }

  const { userId } = await params;
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  if (!dateParam) {
    return NextResponse.json(
      { error: "Date parameter is required" },
      { status: 400 }
    );
  }

  const date = new Date(dateParam);
  if (isNaN(date.getTime())) {
    return NextResponse.json(
      { error: "Invalid date format" },
      { status: 400 }
    );
  }

  const dateStr = date.toISOString().split("T")[0];

  try {
    const entries = await db.query.timeEntries.findMany({
      where: and(
        eq(timeEntries.userId, userId),
        eq(timeEntries.date, dateStr)
      ),
      columns: {
        id: true,
        date: true,
        hours: true,
        description: true,
        clientId: true,
        subtopicId: true,
        topicName: true,
        subtopicName: true,
        createdAt: true,
        updatedAt: true,
      },
      with: {
        client: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [desc(timeEntries.createdAt)],
    });

    return NextResponse.json(entries.map(serializeTimeEntry));
  } catch (error) {
    console.error("Database error fetching team member entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch team member entries" },
      { status: 500 }
    );
  }
}
