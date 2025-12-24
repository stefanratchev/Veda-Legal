/**
 * Centralized authorization utilities for position-based access control.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

// Position type (matches Drizzle enum)
type Position = "ADMIN" | "PARTNER" | "SENIOR_ASSOCIATE" | "ASSOCIATE" | "CONSULTANT";

// Positions that have admin-level access
const ADMIN_POSITIONS: Position[] = ["ADMIN", "PARTNER"];

export type AuthSession = {
  user: {
    name?: string | null;
    email?: string | null;
  };
};

export type AuthUser = {
  id: string;
  email: string;
  position: Position;
};

export type AuthResult =
  | { session: AuthSession; user: AuthUser }
  | { error: string; status: number };

/**
 * Require authentication and fetch user from database.
 * Returns user with id, email, and position.
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

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, email: true, position: true },
  });

  if (!user) {
    return { error: "User not found. Contact administrator.", status: 403 };
  }

  return {
    session: { user: { name: session?.user?.name, email } },
    user: { id: user.id, email: user.email, position: user.position },
  };
}

/**
 * Require admin-level access (ADMIN or PARTNER).
 * Returns 403 if user doesn't have admin access.
 */
export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const auth = await requireAuth(request);
  if ("error" in auth) return auth;

  if (!ADMIN_POSITIONS.includes(auth.user.position)) {
    return { error: "Admin access required", status: 403 };
  }

  return auth;
}

/**
 * Check if position has admin-level access.
 */
export function hasAdminAccess(position: Position): boolean {
  return ADMIN_POSITIONS.includes(position);
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
