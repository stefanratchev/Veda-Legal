import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { Prisma, UserRole } from "@prisma/client";
import {
  requireAuth,
  requireAdmin,
  errorResponse,
  successResponse,
} from "@/lib/auth-utils";

// Valid roles for the simplified two-role system
const VALID_ROLES: UserRole[] = ["ADMIN", "EMPLOYEE"];

const MAX_NAME_LENGTH = 100;

const EMPLOYEE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

function serializeEmployee<T extends { createdAt: Date }>(employee: T) {
  return {
    ...employee,
    createdAt: employee.createdAt.toISOString(),
  };
}

// GET /api/employees - List all employees
// Both ADMIN and EMPLOYEE can view
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return errorResponse(auth.error, auth.status);
  }

  try {
    const employees = await db.user.findMany({
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

  const { id, name, role } = body;

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

  const updateData: Prisma.UserUpdateInput = {};
  if (name !== undefined) updateData.name = name.trim();
  if (role !== undefined) updateData.role = role;

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
