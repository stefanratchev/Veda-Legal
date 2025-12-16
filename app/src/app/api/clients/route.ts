import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getToken } from "next-auth/jwt";

const CLIENT_SELECT = {
  id: true,
  name: true,
  timesheetCode: true,
  invoicedName: true,
  invoiceAttn: true,
  email: true,
  hourlyRate: true,
  status: true,
  createdAt: true,
} as const;

// Roles that can modify client data
const WRITE_ROLES = ["ADMIN", "PARTNER", "ASSOCIATE"];

async function requireAuth(request: NextRequest) {
  // Try getServerSession first
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return { session };
  }

  // Fallback: check JWT token directly (works better with chunked cookies)
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) {
    return { session: { user: { name: token.name, email: token.email } } };
  }

  return { error: "Unauthorized", status: 401 };
}

async function requireWriteAccess(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) return auth;

  const userEmail = auth.session.user?.email;

  // If user has email, check their role in the database
  if (userEmail) {
    const user = await db.user.findUnique({
      where: { email: userEmail },
      select: { role: true },
    });

    // If user exists in DB and doesn't have write role, deny access
    if (user && !WRITE_ROLES.includes(user.role)) {
      return { error: "Insufficient permissions", status: 403 };
    }
  }

  // Allow access if: authenticated via SSO (even without email in session)
  // or user doesn't exist in DB yet (new SSO user)
  return { session: auth.session };
}

function serializeClient<T extends { hourlyRate: Prisma.Decimal | null }>(
  client: T
) {
  return {
    ...client,
    hourlyRate: client.hourlyRate ? Number(client.hourlyRate) : null,
  };
}

// GET /api/clients - List all clients
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const clients = await db.client.findMany({
      select: CLIENT_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(clients.map(serializeClient));
  } catch (error) {
    console.error("Database error fetching clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

// POST /api/clients - Create client
export async function POST(request: NextRequest) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, timesheetCode, invoicedName, invoiceAttn, email, hourlyRate, status } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!timesheetCode || typeof timesheetCode !== "string" || timesheetCode.trim().length === 0) {
    return NextResponse.json({ error: "Timesheet code is required" }, { status: 400 });
  }

  // Check if timesheetCode is unique
  const existingClient = await db.client.findUnique({
    where: { timesheetCode: timesheetCode.trim() },
  });
  if (existingClient) {
    return NextResponse.json({ error: "Timesheet code already exists" }, { status: 400 });
  }

  if (email && typeof email === "string" && email.length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }
  }

  if (hourlyRate !== undefined && hourlyRate !== null && hourlyRate !== "") {
    const rate = Number(hourlyRate);
    if (isNaN(rate) || rate < 0) {
      return NextResponse.json(
        { error: "Hourly rate must be a positive number" },
        { status: 400 }
      );
    }
  }

  try {
    const client = await db.client.create({
      data: {
        name: name.trim(),
        timesheetCode: timesheetCode.trim(),
        invoicedName: invoicedName?.trim() || null,
        invoiceAttn: invoiceAttn?.trim() || null,
        email: email?.trim() || null,
        hourlyRate: hourlyRate ? new Prisma.Decimal(hourlyRate) : null,
        status: status || "ACTIVE",
      },
      select: CLIENT_SELECT,
    });

    return NextResponse.json(serializeClient(client));
  } catch (error) {
    console.error("Database error creating client:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}

// PATCH /api/clients - Update client
export async function PATCH(request: NextRequest) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, name, timesheetCode, invoicedName, invoiceAttn, email, hourlyRate, status } = body;

  if (!id) {
    return NextResponse.json(
      { error: "Client ID is required" },
      { status: 400 }
    );
  }

  if (
    name !== undefined &&
    (typeof name !== "string" || name.trim().length === 0)
  ) {
    return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  }

  if (
    timesheetCode !== undefined &&
    (typeof timesheetCode !== "string" || timesheetCode.trim().length === 0)
  ) {
    return NextResponse.json({ error: "Timesheet code cannot be empty" }, { status: 400 });
  }

  // Check if timesheetCode is unique (if being changed)
  if (timesheetCode !== undefined) {
    const existingClient = await db.client.findFirst({
      where: {
        timesheetCode: timesheetCode.trim(),
        NOT: { id },
      },
    });
    if (existingClient) {
      return NextResponse.json({ error: "Timesheet code already exists" }, { status: 400 });
    }
  }

  if (email && typeof email === "string" && email.length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }
  }

  if (hourlyRate !== undefined && hourlyRate !== null && hourlyRate !== "") {
    const rate = Number(hourlyRate);
    if (isNaN(rate) || rate < 0) {
      return NextResponse.json(
        { error: "Hourly rate must be a positive number" },
        { status: 400 }
      );
    }
  }

  const updateData: Prisma.ClientUpdateInput = {};
  if (name !== undefined) updateData.name = name.trim();
  if (timesheetCode !== undefined) updateData.timesheetCode = timesheetCode.trim();
  if (invoicedName !== undefined) updateData.invoicedName = invoicedName?.trim() || null;
  if (invoiceAttn !== undefined) updateData.invoiceAttn = invoiceAttn?.trim() || null;
  if (email !== undefined) updateData.email = email?.trim() || null;
  if (hourlyRate !== undefined) {
    updateData.hourlyRate = hourlyRate ? new Prisma.Decimal(hourlyRate) : null;
  }
  if (status !== undefined) updateData.status = status;

  try {
    const client = await db.client.update({
      where: { id },
      data: updateData,
      select: CLIENT_SELECT,
    });

    return NextResponse.json(serializeClient(client));
  } catch (error) {
    // Check for Prisma "Record not found" error
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    console.error("Database error updating client:", error);
    return NextResponse.json(
      { error: "Failed to update client" },
      { status: 500 }
    );
  }
}

// DELETE /api/clients - Delete client
export async function DELETE(request: NextRequest) {
  const auth = await requireWriteAccess(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { error: "Client ID is required" },
      { status: 400 }
    );
  }

  try {
    // Use transaction to prevent race condition between check and delete
    await db.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id },
        include: { _count: { select: { timeEntries: true } } },
      });

      if (!client) {
        throw new Error("NOT_FOUND");
      }

      if (client._count.timeEntries > 0) {
        throw new Error("HAS_TIME_ENTRIES");
      }

      await tx.client.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return NextResponse.json(
          { error: "Client not found" },
          { status: 404 }
        );
      }
      if (error.message === "HAS_TIME_ENTRIES") {
        return NextResponse.json(
          { error: "Cannot delete client with existing time entries" },
          { status: 400 }
        );
      }
    }
    console.error("Database error deleting client:", error);
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: 500 }
    );
  }
}
