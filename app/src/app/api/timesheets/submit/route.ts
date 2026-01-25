import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { timeEntries, timesheetSubmissions } from "@/lib/schema";
import { requireAuth, getUserFromSession, errorResponse, parseDate } from "@/lib/api-utils";
import { MIN_SUBMISSION_HOURS } from "@/lib/submission-utils";

export async function POST(request: NextRequest) {
  // 1. Auth check
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return errorResponse("User not found", 404);
  }

  // 2. Parse and validate date from body
  let body: { date?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  if (!body.date) {
    return errorResponse("Date is required", 400);
  }

  const parsedDate = parseDate(body.date);
  if (!parsedDate) {
    return errorResponse("Invalid date format", 400);
  }

  // Format date to YYYY-MM-DD for database queries
  const dateStr = body.date;

  // 3. Calculate total hours for user+date
  const [hoursResult] = await db
    .select({
      totalHours: sql<string>`COALESCE(SUM(${timeEntries.hours}), '0')`,
    })
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, user.id),
        eq(timeEntries.date, dateStr)
      )
    );

  const totalHours = Number(hoursResult?.totalHours ?? 0);

  // 4. Verify >= 8 hours
  if (totalHours < MIN_SUBMISSION_HOURS) {
    return errorResponse("Minimum 8 hours required for submission", 400);
  }

  // 5. Check not already submitted
  const existingSubmission = await db.query.timesheetSubmissions.findFirst({
    where: and(
      eq(timesheetSubmissions.userId, user.id),
      eq(timesheetSubmissions.date, dateStr)
    ),
  });

  if (existingSubmission) {
    return errorResponse("Already submitted for this date", 400);
  }

  // 6. Create submission record
  const [submission] = await db
    .insert(timesheetSubmissions)
    .values({
      id: createId(),
      userId: user.id,
      date: dateStr,
    })
    .returning();

  // 7. Return 201 with submission
  return NextResponse.json(submission, { status: 201 });
}
