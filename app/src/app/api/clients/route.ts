import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { clients } from "@/lib/schema";
import {
  requireAuth,
  requireWriteAccess,
  isValidEmail,
  serializeDecimal,
  errorResponse,
  MAX_NAME_LENGTH,
  MAX_EMAIL_LENGTH,
} from "@/lib/api-utils";

// Valid status values
const VALID_STATUS = ["ACTIVE", "INACTIVE"] as const;

function serializeClient<T extends { hourlyRate: string | null }>(client: T) {
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
    const allClients = await db.query.clients.findMany({
      columns: {
        id: true,
        name: true,
        invoicedName: true,
        invoiceAttn: true,
        email: true,
        secondaryEmails: true,
        hourlyRate: true,
        status: true,
        notes: true,
        createdAt: true,
      },
      orderBy: [desc(clients.createdAt)],
    });

    return NextResponse.json(allClients.map(serializeClient));
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

  const { name, invoicedName, invoiceAttn, email, secondaryEmails, hourlyRate, status, notes } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return errorResponse("Name is required", 400);
  }
  if (name.trim().length > MAX_NAME_LENGTH) {
    return errorResponse(`Name cannot exceed ${MAX_NAME_LENGTH} characters`, 400);
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
    const now = new Date().toISOString();
    const [client] = await db.insert(clients).values({
      id: createId(),
      name: name.trim(),
      invoicedName: invoicedName?.trim() || null,
      invoiceAttn: invoiceAttn?.trim() || null,
      email: email?.trim() || null,
      secondaryEmails: secondaryEmails?.trim() || null,
      hourlyRate: hourlyRate ? String(hourlyRate) : null,
      status: clientStatus,
      notes: notes?.trim() || null,
      updatedAt: now,
    }).returning({
      id: clients.id,
      name: clients.name,
      invoicedName: clients.invoicedName,
      invoiceAttn: clients.invoiceAttn,
      email: clients.email,
      secondaryEmails: clients.secondaryEmails,
      hourlyRate: clients.hourlyRate,
      status: clients.status,
      notes: clients.notes,
      createdAt: clients.createdAt,
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

  const { id, name, invoicedName, invoiceAttn, email, secondaryEmails, hourlyRate, status, notes } = body;

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

  // Build update object - always set updatedAt
  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (name !== undefined) updateData.name = name.trim();
  if (invoicedName !== undefined) updateData.invoicedName = invoicedName?.trim() || null;
  if (invoiceAttn !== undefined) updateData.invoiceAttn = invoiceAttn?.trim() || null;
  if (email !== undefined) updateData.email = email?.trim() || null;
  if (secondaryEmails !== undefined) updateData.secondaryEmails = secondaryEmails?.trim() || null;
  if (hourlyRate !== undefined) {
    updateData.hourlyRate = hourlyRate ? String(hourlyRate) : null;
  }
  if (status !== undefined) updateData.status = status;
  if (notes !== undefined) updateData.notes = notes?.trim() || null;

  try {
    const [updatedClient] = await db.update(clients)
      .set(updateData)
      .where(eq(clients.id, id))
      .returning({
        id: clients.id,
        name: clients.name,
        invoicedName: clients.invoicedName,
        invoiceAttn: clients.invoiceAttn,
        email: clients.email,
        secondaryEmails: clients.secondaryEmails,
        hourlyRate: clients.hourlyRate,
        status: clients.status,
        notes: clients.notes,
        createdAt: clients.createdAt,
      });

    if (!updatedClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json(serializeClient(updatedClient));
  } catch (error) {
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
    // Check if client exists and has time entries
    const clientWithEntries = await db.query.clients.findFirst({
      where: eq(clients.id, id),
      with: { timeEntries: { columns: { id: true }, limit: 1 } },
    });

    if (!clientWithEntries) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    if (clientWithEntries.timeEntries.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete client with existing time entries" },
        { status: 400 }
      );
    }

    await db.delete(clients).where(eq(clients.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error deleting client:", error);
    return NextResponse.json(
      { error: "Failed to delete client" },
      { status: 500 }
    );
  }
}
