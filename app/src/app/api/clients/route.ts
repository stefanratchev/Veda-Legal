import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import {
  requireAuth,
  requireWriteAccess,
  isValidEmail,
  serializeDecimal,
  errorResponse,
  MAX_NAME_LENGTH,
  MAX_TIMESHEET_CODE_LENGTH,
  MAX_EMAIL_LENGTH,
} from "@/lib/api-utils";

// Valid status values
const VALID_STATUS = ["ACTIVE", "INACTIVE"] as const;

const CLIENT_SELECT = {
  id: true,
  name: true,
  timesheetCode: true,
  invoicedName: true,
  invoiceAttn: true,
  email: true,
  secondaryEmails: true,
  hourlyRate: true,
  status: true,
  notes: true,
  createdAt: true,
} as const;

function serializeClient<T extends { hourlyRate: Prisma.Decimal | null }>(client: T) {
  return {
    ...client,
    hourlyRate: serializeDecimal(client.hourlyRate),
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

  const { name, timesheetCode, invoicedName, invoiceAttn, email, secondaryEmails, hourlyRate, status, notes } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return errorResponse("Name is required", 400);
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    return errorResponse(`Name cannot exceed ${MAX_NAME_LENGTH} characters`, 400);
  }

  if (!timesheetCode || typeof timesheetCode !== "string" || timesheetCode.trim().length === 0) {
    return errorResponse("Timesheet code is required", 400);
  }
  if (timesheetCode.trim().length > MAX_TIMESHEET_CODE_LENGTH) {
    return errorResponse(`Timesheet code cannot exceed ${MAX_TIMESHEET_CODE_LENGTH} characters`, 400);
  }

  // Check if timesheetCode is unique
  const existingClient = await db.client.findUnique({
    where: { timesheetCode: timesheetCode.trim() },
  });
  if (existingClient) {
    return NextResponse.json({ error: "Timesheet code already exists" }, { status: 400 });
  }

  if (email && typeof email === "string" && email.length > 0) {
    if (!isValidEmail(email)) {
      return errorResponse("Invalid email format", 400);
    }
    if (email.length > MAX_EMAIL_LENGTH) {
      return errorResponse(`Email cannot exceed ${MAX_EMAIL_LENGTH} characters`, 400);
    }
  }

  if (hourlyRate !== undefined && hourlyRate !== null && hourlyRate !== "") {
    const rate = Number(hourlyRate);
    if (isNaN(rate) || rate < 0) {
      return errorResponse("Hourly rate must be a positive number", 400);
    }
  }

  // Validate status
  const clientStatus = status || "ACTIVE";
  if (!VALID_STATUS.includes(clientStatus)) {
    return errorResponse("Invalid status value", 400);
  }

  try {
    const client = await db.client.create({
      data: {
        name: name.trim(),
        timesheetCode: timesheetCode.trim(),
        invoicedName: invoicedName?.trim() || null,
        invoiceAttn: invoiceAttn?.trim() || null,
        email: email?.trim() || null,
        secondaryEmails: secondaryEmails?.trim() || null,
        hourlyRate: hourlyRate ? new Prisma.Decimal(hourlyRate) : null,
        status: clientStatus,
        notes: notes?.trim() || null,
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

  const { id, name, timesheetCode, invoicedName, invoiceAttn, email, secondaryEmails, hourlyRate, status, notes } = body;

  if (!id) {
    return NextResponse.json(
      { error: "Client ID is required" },
      { status: 400 }
    );
  }

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return errorResponse("Name cannot be empty", 400);
    }
    if (name.trim().length > MAX_NAME_LENGTH) {
      return errorResponse(`Name cannot exceed ${MAX_NAME_LENGTH} characters`, 400);
    }
  }

  if (timesheetCode !== undefined) {
    if (typeof timesheetCode !== "string" || timesheetCode.trim().length === 0) {
      return errorResponse("Timesheet code cannot be empty", 400);
    }
    if (timesheetCode.trim().length > MAX_TIMESHEET_CODE_LENGTH) {
      return errorResponse(`Timesheet code cannot exceed ${MAX_TIMESHEET_CODE_LENGTH} characters`, 400);
    }
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
    if (!isValidEmail(email)) {
      return errorResponse("Invalid email format", 400);
    }
    if (email.length > MAX_EMAIL_LENGTH) {
      return errorResponse(`Email cannot exceed ${MAX_EMAIL_LENGTH} characters`, 400);
    }
  }

  if (hourlyRate !== undefined && hourlyRate !== null && hourlyRate !== "") {
    const rate = Number(hourlyRate);
    if (isNaN(rate) || rate < 0) {
      return errorResponse("Hourly rate must be a positive number", 400);
    }
  }

  // Validate status if provided
  if (status !== undefined && !VALID_STATUS.includes(status)) {
    return errorResponse("Invalid status value", 400);
  }

  const updateData: Prisma.ClientUpdateInput = {};
  if (name !== undefined) updateData.name = name.trim();
  if (timesheetCode !== undefined) updateData.timesheetCode = timesheetCode.trim();
  if (invoicedName !== undefined) updateData.invoicedName = invoicedName?.trim() || null;
  if (invoiceAttn !== undefined) updateData.invoiceAttn = invoiceAttn?.trim() || null;
  if (email !== undefined) updateData.email = email?.trim() || null;
  if (secondaryEmails !== undefined) updateData.secondaryEmails = secondaryEmails?.trim() || null;
  if (hourlyRate !== undefined) {
    updateData.hourlyRate = hourlyRate ? new Prisma.Decimal(hourlyRate) : null;
  }
  if (status !== undefined) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes?.trim() || null;

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
