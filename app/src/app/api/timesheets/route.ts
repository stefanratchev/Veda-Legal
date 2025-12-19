import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getToken } from "next-auth/jwt";

const TIMEENTRY_SELECT = {
  id: true,
  date: true,
  hours: true,
  description: true,
  clientId: true,
  client: {
    select: {
      id: true,
      name: true,
      timesheetCode: true,
    },
  },
  createdAt: true,
  updatedAt: true,
} as const;

async function requireAuth(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return { session };
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) {
    return { session: { user: { name: token.name, email: token.email } } };
  }

  return { error: "Unauthorized", status: 401 };
}

async function getUserFromSession(email: string | null | undefined) {
  if (!email) return null;

  return db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });
}

function serializeTimeEntry<T extends { hours: Prisma.Decimal; date: Date }>(entry: T) {
  return {
    ...entry,
    hours: Number(entry.hours),
    date: entry.date.toISOString().split("T")[0],
  };
}

// GET /api/timesheets?date=YYYY-MM-DD - List entries for a date
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  if (!dateParam) {
    return NextResponse.json({ error: "Date parameter is required" }, { status: 400 });
  }

  // Parse the date
  const date = new Date(dateParam);
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  try {
    const entries = await db.timeEntry.findMany({
      where: {
        userId: user.id,
        date: date,
      },
      select: TIMEENTRY_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(entries.map(serializeTimeEntry));
  } catch (error) {
    console.error("Database error fetching time entries:", error);
    return NextResponse.json(
      { error: "Failed to fetch time entries" },
      { status: 500 }
    );
  }
}

// GET dates with entries for a month (for calendar dots)
export async function HEAD(request: NextRequest) {
  // This is a workaround - we'll use a separate endpoint for this
  return new NextResponse(null, { status: 405 });
}

// POST /api/timesheets - Create time entry
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { date, clientId, hours, description } = body;

  // Validate date
  if (!date) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  // Don't allow future dates
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (parsedDate > today) {
    return NextResponse.json({ error: "Cannot log time for future dates" }, { status: 400 });
  }

  // Validate client
  if (!clientId) {
    return NextResponse.json({ error: "Client is required" }, { status: 400 });
  }
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, status: true },
  });
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  if (client.status !== "ACTIVE") {
    return NextResponse.json({ error: "Cannot log time for inactive clients" }, { status: 400 });
  }

  // Validate hours
  if (hours === undefined || hours === null) {
    return NextResponse.json({ error: "Hours is required" }, { status: 400 });
  }
  const hoursNum = Number(hours);
  if (isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 12) {
    return NextResponse.json({ error: "Hours must be between 0 and 12" }, { status: 400 });
  }

  // Validate description
  if (!description || typeof description !== "string") {
    return NextResponse.json({ error: "Description is required" }, { status: 400 });
  }
  if (description.trim().length < 10) {
    return NextResponse.json({ error: "Description must be at least 10 characters" }, { status: 400 });
  }

  try {
    const entry = await db.timeEntry.create({
      data: {
        date: parsedDate,
        hours: new Prisma.Decimal(hoursNum),
        description: description.trim(),
        userId: user.id,
        clientId: clientId,
      },
      select: TIMEENTRY_SELECT,
    });

    return NextResponse.json(serializeTimeEntry(entry));
  } catch (error) {
    console.error("Database error creating time entry:", error);
    return NextResponse.json(
      { error: "Failed to create time entry" },
      { status: 500 }
    );
  }
}

// PATCH /api/timesheets - Update time entry
export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, clientId, hours, description } = body;

  if (!id) {
    return NextResponse.json({ error: "Entry ID is required" }, { status: 400 });
  }

  // Verify the entry exists and belongs to this user
  const existingEntry = await db.timeEntry.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!existingEntry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  if (existingEntry.userId !== user.id) {
    return NextResponse.json({ error: "You can only edit your own entries" }, { status: 403 });
  }

  // Build update data
  const updateData: Prisma.TimeEntryUpdateInput = {};

  // Validate client if provided
  if (clientId !== undefined) {
    const client = await db.client.findUnique({
      where: { id: clientId },
      select: { id: true, status: true },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    if (client.status !== "ACTIVE") {
      return NextResponse.json({ error: "Cannot log time for inactive clients" }, { status: 400 });
    }
    updateData.client = { connect: { id: clientId } };
  }

  // Validate hours if provided
  if (hours !== undefined) {
    const hoursNum = Number(hours);
    if (isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 12) {
      return NextResponse.json({ error: "Hours must be between 0 and 12" }, { status: 400 });
    }
    updateData.hours = new Prisma.Decimal(hoursNum);
  }

  // Validate description if provided
  if (description !== undefined) {
    if (typeof description !== "string" || description.trim().length < 10) {
      return NextResponse.json({ error: "Description must be at least 10 characters" }, { status: 400 });
    }
    updateData.description = description.trim();
  }

  try {
    const entry = await db.timeEntry.update({
      where: { id },
      data: updateData,
      select: TIMEENTRY_SELECT,
    });

    return NextResponse.json(serializeTimeEntry(entry));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
    console.error("Database error updating time entry:", error);
    return NextResponse.json(
      { error: "Failed to update time entry" },
      { status: 500 }
    );
  }
}

// DELETE /api/timesheets?id=xxx - Delete time entry
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const user = await getUserFromSession(auth.session.user?.email);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Entry ID is required" }, { status: 400 });
  }

  try {
    await db.$transaction(async (tx) => {
      const existingEntry = await tx.timeEntry.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!existingEntry) {
        throw new Error("NOT_FOUND");
      }

      if (existingEntry.userId !== user.id) {
        throw new Error("FORBIDDEN");
      }

      await tx.timeEntry.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Entry not found" }, { status: 404 });
      }
      if (error.message === "FORBIDDEN") {
        return NextResponse.json({ error: "You can only delete your own entries" }, { status: 403 });
      }
    }
    console.error("Database error deleting time entry:", error);
    return NextResponse.json(
      { error: "Failed to delete time entry" },
      { status: 500 }
    );
  }
}
