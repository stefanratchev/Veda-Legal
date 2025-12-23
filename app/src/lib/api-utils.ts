/**
 * Shared API route utilities for authentication, authorization, and validation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { eq } from 'drizzle-orm';
import { users } from './schema';

// Positions that have admin-level access (can manage clients, reports, billing)
const ADMIN_POSITIONS = ["ADMIN", "PARTNER"] as const;

// All positions can write (log time entries)
const WRITE_POSITIONS = ["ADMIN", "PARTNER", "SENIOR_ASSOCIATE", "ASSOCIATE", "CONSULTANT"] as const;

/**
 * Check if a position has admin-level access.
 */
export function hasAdminAccess(position: string): boolean {
  return ADMIN_POSITIONS.includes(position as (typeof ADMIN_POSITIONS)[number]);
}

// Common validation patterns
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Minimum description length for time entries
export const MIN_DESCRIPTION_LENGTH = 10;

// Maximum hours per time entry
export const MAX_HOURS_PER_ENTRY = 12;

// Maximum string lengths for client fields
export const MAX_NAME_LENGTH = 255;
export const MAX_EMAIL_LENGTH = 255;
export const MAX_DESCRIPTION_LENGTH = 1000;

type AuthSession = { user: { name?: string | null; email?: string | null } };
type AuthResult = { session: AuthSession } | { error: string; status: number };

/**
 * Require authentication for API routes.
 * Supports both server session and JWT token authentication.
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  // Try getServerSession first
  const session = await getServerSession(authOptions);
  if (session?.user) {
    return { session: { user: { name: session.user.name, email: session.user.email } } };
  }

  // Fallback: check JWT token directly (works better with chunked cookies)
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) {
    return { session: { user: { name: token.name, email: token.email } } };
  }

  return { error: "Unauthorized", status: 401 };
}

/**
 * Require write access (any position can write).
 */
export async function requireWriteAccess(request: NextRequest): Promise<AuthResult> {
  const auth = await requireAuth(request);
  if ("error" in auth) return auth;

  const userEmail = auth.session.user?.email;

  // Email is required for authorization
  if (!userEmail) {
    return { error: "Email required for authorization", status: 403 };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, userEmail),
    columns: { position: true },
  });

  // User must exist in database to have write access
  if (!user) {
    return { error: "User not registered. Contact administrator.", status: 403 };
  }

  // User must have a valid position
  if (!WRITE_POSITIONS.includes(user.position as (typeof WRITE_POSITIONS)[number])) {
    return { error: "Insufficient permissions", status: 403 };
  }

  return { session: auth.session };
}

/**
 * Get user from session email.
 */
export async function getUserFromSession(email: string | null | undefined) {
  if (!email) return null;

  return db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, email: true, name: true },
  });
}

/**
 * Serialize numeric string to number for JSON response.
 * Drizzle returns numeric fields as strings.
 */
export function serializeDecimal(value: string | null): number | null {
  return value ? Number(value) : null;
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

/**
 * Validate email format.
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Validate hours range (0 < hours <= MAX_HOURS_PER_ENTRY).
 */
export function isValidHours(hours: number): boolean {
  return !isNaN(hours) && hours > 0 && hours <= MAX_HOURS_PER_ENTRY;
}

/**
 * Validate description length.
 */
export function isValidDescription(description: string): boolean {
  return typeof description === "string" && description.trim().length >= MIN_DESCRIPTION_LENGTH;
}

/**
 * Parse and validate date from string.
 * Returns null if invalid.
 */
export function parseDate(dateStr: string): Date | null {
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Check if date is not in the future.
 */
export function isNotFutureDate(date: Date): boolean {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date <= today;
}
