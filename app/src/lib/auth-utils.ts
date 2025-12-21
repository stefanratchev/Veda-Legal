/**
 * Centralized authorization utilities for role-based access control.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { UserRole } from "@prisma/client";

export type AuthSession = {
  user: {
    name?: string | null;
    email?: string | null;
  };
};

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
};

export type AuthResult =
  | { session: AuthSession; user: AuthUser }
  | { error: string; status: number };

/**
 * Require authentication and fetch user from database.
 * Returns user with id, email, and role.
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  // Try getServerSession first
  const session = await getServerSession(authOptions);
  let email: string | null | undefined = session?.user?.email;

  // Fallback: check JWT token directly (works better with chunked cookies)
  if (!email) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    email = token?.email;
  }

  if (!email) {
    return { error: "Unauthorized", status: 401 };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    return { error: "User not found. Contact administrator.", status: 403 };
  }

  return {
    session: { user: { name: session?.user?.name, email } },
    user: { id: user.id, email: user.email, role: user.role },
  };
}

/**
 * Require ADMIN role.
 * Returns 403 if user is EMPLOYEE.
 */
export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const auth = await requireAuth(request);
  if ("error" in auth) return auth;

  if (auth.user.role !== "ADMIN") {
    return { error: "Admin access required", status: 403 };
  }

  return auth;
}

/**
 * Check if user is admin.
 */
export function isAdmin(role: UserRole): boolean {
  return role === "ADMIN";
}

/**
 * Create a JSON error response.
 */
export function errorResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

/**
 * Create a JSON success response.
 */
export function successResponse<T>(data: T): NextResponse {
  return NextResponse.json(data);
}
