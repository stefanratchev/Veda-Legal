import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma, UserRole, UserStatus } from "@prisma/client";
import {
  requireAuth,
  requireAdmin,
  errorResponse,
  successResponse,
} from "@/lib/auth-utils";
import { isValidEmail } from "@/lib/api-utils";

// Valid roles for the simplified two-role system
const VALID_ROLES: UserRole[] = ["ADMIN", "EMPLOYEE"];

// Valid statuses for admin updates (PENDING is only for newly created users)
const VALID_STATUSES: UserStatus[] = ["ACTIVE", "INACTIVE"];

const MAX_NAME_LENGTH = 100;

const EMPLOYEE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  lastLogin: true,
} as const;

function serializeEmployee<T extends { createdAt: Date; lastLogin: Date | null }>(employee: T) {
  return {
    ...employee,
    createdAt: employee.createdAt.toISOString(),
    lastLogin: employee.lastLogin?.toISOString() ?? null,
  };
}

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
    const employees = await db.user.findMany({
      where: includeInactive
        ? undefined
        : { status: { in: ["PENDING", "ACTIVE"] } },
      select: EMPLOYEE_SELECT,
      orderBy: { createdAt: "desc" },
    });

    return successResponse(employees.map(serializeEmployee));
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

  const { id, name, role, status } = body;

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

  if (role !== undefined && !VALID_ROLES.includes(role)) {
    return errorResponse("Invalid role value", 400);
  }

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return errorResponse("Invalid status value", 400);
  }

  // Prevent self-deactivation via PATCH
  if (status === "INACTIVE" && id === auth.user.id) {
    return errorResponse("You cannot deactivate yourself", 400);
  }

  const updateData: Prisma.UserUpdateInput = {};
  if (name !== undefined) updateData.name = name.trim();
  if (role !== undefined) updateData.role = role;
  if (status !== undefined) updateData.status = status;

  try {
    const employee = await db.user.update({
      where: { id },
      data: updateData,
      select: EMPLOYEE_SELECT,
    });

    return successResponse(serializeEmployee(employee));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return errorResponse("Employee not found", 404);
    }
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

  const { email, name, role } = body;

  // Validate email
  if (!email || typeof email !== "string") {
    return errorResponse("Email is required", 400);
  }
  if (!isValidEmail(email.trim())) {
    return errorResponse("Invalid email format", 400);
  }

  // Validate role
  if (!role || !VALID_ROLES.includes(role)) {
    return errorResponse("Valid role is required (ADMIN or EMPLOYEE)", 400);
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
    const existing = await db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    if (existing) {
      return errorResponse("An employee with this email already exists", 409);
    }

    const employee = await db.user.create({
      data: {
        email: email.trim().toLowerCase(),
        name: name?.trim() || null,
        role,
        status: "PENDING",
      },
      select: EMPLOYEE_SELECT,
    });

    return NextResponse.json(serializeEmployee(employee), { status: 201 });
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
    const employee = await db.user.update({
      where: { id },
      data: { status: "INACTIVE" },
      select: EMPLOYEE_SELECT,
    });

    return successResponse(serializeEmployee(employee));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return errorResponse("Employee not found", 404);
    }
    console.error("Database error deactivating employee:", error);
    return errorResponse("Failed to deactivate employee", 500);
  }
}
