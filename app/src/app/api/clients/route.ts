import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireAdmin, errorResponse, successResponse } from "@/lib/auth-utils";

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

function serializeClient<T extends { hourlyRate: Prisma.Decimal | null }>(client: T) {
  return {
    ...client,
    hourlyRate: client.hourlyRate ? Number(client.hourlyRate) : null,
  };
}

// GET /api/clients - List all clients (ADMIN only)
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  try {
    const clients = await db.client.findMany({
      select: CLIENT_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return successResponse(clients.map(serializeClient));
  } catch (error) {
    console.error("Database error fetching clients:", error);
    return errorResponse("Failed to fetch clients", 500);
  }
}

// POST /api/clients - Create client (ADMIN only)
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { name, timesheetCode, invoicedName, invoiceAttn, email, hourlyRate, status } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return errorResponse("Name is required", 400);
  }

  if (!timesheetCode || typeof timesheetCode !== "string" || timesheetCode.trim().length === 0) {
    return errorResponse("Timesheet code is required", 400);
  }

  const existingClient = await db.client.findUnique({
    where: { timesheetCode: timesheetCode.trim() },
  });
  if (existingClient) {
    return errorResponse("Timesheet code already exists", 400);
  }

  if (email && typeof email === "string" && email.length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse("Invalid email format", 400);
    }
  }

  if (hourlyRate !== undefined && hourlyRate !== null && hourlyRate !== "") {
    const rate = Number(hourlyRate);
    if (isNaN(rate) || rate < 0) {
      return errorResponse("Hourly rate must be a positive number", 400);
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

    return successResponse(serializeClient(client));
  } catch (error) {
    console.error("Database error creating client:", error);
    return errorResponse("Failed to create client", 500);
  }
}

// PATCH /api/clients - Update client (ADMIN only)
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { id, name, timesheetCode, invoicedName, invoiceAttn, email, hourlyRate, status } = body;

  if (!id) {
    return errorResponse("Client ID is required", 400);
  }

  if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
    return errorResponse("Name cannot be empty", 400);
  }

  if (timesheetCode !== undefined && (typeof timesheetCode !== "string" || timesheetCode.trim().length === 0)) {
    return errorResponse("Timesheet code cannot be empty", 400);
  }

  if (timesheetCode !== undefined) {
    const existingClient = await db.client.findFirst({
      where: {
        timesheetCode: timesheetCode.trim(),
        NOT: { id },
      },
    });
    if (existingClient) {
      return errorResponse("Timesheet code already exists", 400);
    }
  }

  if (email && typeof email === "string" && email.length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse("Invalid email format", 400);
    }
  }

  if (hourlyRate !== undefined && hourlyRate !== null && hourlyRate !== "") {
    const rate = Number(hourlyRate);
    if (isNaN(rate) || rate < 0) {
      return errorResponse("Hourly rate must be a positive number", 400);
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

    return successResponse(serializeClient(client));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return errorResponse("Client not found", 404);
    }
    console.error("Database error updating client:", error);
    return errorResponse("Failed to update client", 500);
  }
}

// DELETE /api/clients - Delete client (ADMIN only)
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return errorResponse("Client ID is required", 400);
  }

  try {
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

    return successResponse({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "NOT_FOUND") {
        return errorResponse("Client not found", 404);
      }
      if (error.message === "HAS_TIME_ENTRIES") {
        return errorResponse("Cannot delete client with existing time entries", 400);
      }
    }
    console.error("Database error deleting client:", error);
    return errorResponse("Failed to delete client", 500);
  }
}
