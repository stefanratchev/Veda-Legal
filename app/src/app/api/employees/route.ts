import { NextRequest, NextResponse } from "next/server";
import { eq, desc, inArray } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import {
  requireAuth,
  requireAdmin,
  errorResponse,
  successResponse,
} from "@/lib/auth-utils";
import { isValidEmail } from "@/lib/api-utils";

// Valid positions that can be set via the UI (Admin is not selectable)
const VALID_POSITIONS = ["PARTNER", "SENIOR_ASSOCIATE", "ASSOCIATE", "CONSULTANT"] as const;

// Valid statuses for admin updates (PENDING is only for newly created users)
const VALID_STATUSES = ["ACTIVE", "INACTIVE"] as const;

const MAX_NAME_LENGTH = 100;

// GET /api/employees - List all employees
// Both ADMIN and EMPLOYEE can view
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  try {
    const employees = await db.query.users.findMany({
      where: includeInactive
        ? undefined
        : inArray(users.status, ["PENDING", "ACTIVE"]),
      columns: {
        id: true,
        name: true,
        email: true,
        position: true,
        status: true,
        createdAt: true,
        lastLogin: true,
      },
      orderBy: [desc(users.createdAt)],
    });

    return successResponse(employees);
  } catch (error) {
    console.error("Database error fetching employees:", error);
    return errorResponse("Failed to fetch employees", 500);
  }
}

// PATCH /api/employees - Update employee
// Only ADMIN can modify
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

  const { id, name, position, status } = body;

  if (!id) {
    return errorResponse("Employee ID is required", 400);
  }

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return errorResponse("Name cannot be empty", 400);
    }
    if (name.trim().length > MAX_NAME_LENGTH) {
      return errorResponse(`Name cannot exceed ${MAX_NAME_LENGTH} characters`, 400);
    }
  }

  if (position !== undefined && !VALID_POSITIONS.includes(position)) {
    return errorResponse("Invalid position value", 400);
  }

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return errorResponse("Invalid status value", 400);
  }

  // Prevent self-deactivation via PATCH
  if (status === "INACTIVE" && id === auth.user.id) {
    return errorResponse("You cannot deactivate yourself", 400);
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (name !== undefined) updateData.name = name.trim();
  if (position !== undefined) updateData.position = position;
  if (status !== undefined) updateData.status = status;

  try {
    const [employee] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        position: users.position,
        status: users.status,
        createdAt: users.createdAt,
        lastLogin: users.lastLogin,
      });

    if (!employee) {
      return errorResponse("Employee not found", 404);
    }

    return successResponse(employee);
  } catch (error) {
    console.error("Database error updating employee:", error);
    return errorResponse("Failed to update employee", 500);
  }
}

// POST /api/employees - Create new employee
// Only ADMIN can create
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

  const { email, name, position } = body;

  // Validate email
  if (!email || typeof email !== "string") {
    return errorResponse("Email is required", 400);
  }
  if (!isValidEmail(email.trim())) {
    return errorResponse("Invalid email format", 400);
  }

  // Validate position
  if (!position || !VALID_POSITIONS.includes(position)) {
    return errorResponse("Valid position is required (PARTNER, SENIOR_ASSOCIATE, ASSOCIATE, or CONSULTANT)", 400);
  }

  // Validate name if provided
  if (name !== undefined && name !== null) {
    if (typeof name !== "string") {
      return errorResponse("Name must be a string", 400);
    }
    if (name.trim().length > MAX_NAME_LENGTH) {
      return errorResponse(`Name cannot exceed ${MAX_NAME_LENGTH} characters`, 400);
    }
  }

  try {
    // Check for existing user
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email.trim().toLowerCase()),
    });

    if (existing) {
      return errorResponse("An employee with this email already exists", 409);
    }

    const now = new Date().toISOString();
    const [employee] = await db.insert(users).values({
      id: createId(),
      email: email.trim().toLowerCase(),
      name: name?.trim() || null,
      position,
      status: "PENDING",
      updatedAt: now,
    }).returning({
      id: users.id,
      name: users.name,
      email: users.email,
      position: users.position,
      status: users.status,
      createdAt: users.createdAt,
      lastLogin: users.lastLogin,
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error("Database error creating employee:", error);
    return errorResponse("Failed to create employee", 500);
  }
}

// DELETE /api/employees - Deactivate employee (soft delete)
// Only ADMIN can deactivate
export async function DELETE(request: NextRequest) {
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

  const { id } = body;

  if (!id || typeof id !== "string") {
    return errorResponse("Employee ID is required", 400);
  }

  // Prevent self-deactivation
  if (id === auth.user.id) {
    return errorResponse("You cannot deactivate yourself", 400);
  }

  try {
    const [employee] = await db.update(users)
      .set({
        status: "INACTIVE",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        position: users.position,
        status: users.status,
        createdAt: users.createdAt,
        lastLogin: users.lastLogin,
      });

    if (!employee) {
      return errorResponse("Employee not found", 404);
    }

    return successResponse(employee);
  } catch (error) {
    console.error("Database error deactivating employee:", error);
    return errorResponse("Failed to deactivate employee", 500);
  }
}
