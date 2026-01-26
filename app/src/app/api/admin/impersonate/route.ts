import { NextRequest, NextResponse } from "next/server";
import { requireAuth, errorResponse, successResponse } from "@/lib/api-utils";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

const COOKIE_NAME = "impersonate_user_id";

/**
 * POST /api/admin/impersonate
 * Start impersonating a user. Only ADMIN position can impersonate.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return errorResponse(auth.error, auth.status);
    }

    const callerEmail = auth.session.user?.email;
    if (!callerEmail) {
      return errorResponse("Email required for authorization", 403);
    }

    // Get caller from database
    const caller = await db.query.users.findFirst({
      where: eq(users.email, callerEmail),
      columns: { id: true, email: true, name: true, position: true, status: true },
    });

    if (!caller) {
      return errorResponse("User not found", 404);
    }

    // Only ADMIN position can impersonate
    if (caller.position !== "ADMIN") {
      return errorResponse("Only ADMIN can impersonate users", 403);
    }

    // Caller must be ACTIVE
    if (caller.status !== "ACTIVE") {
      return errorResponse("Admin account is not active", 403);
    }

    // Parse request body
    let body: { userId?: unknown };
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON", 400);
    }

    // Validate userId
    if (!body.userId || typeof body.userId !== "string") {
      return errorResponse("userId is required", 400);
    }

    const targetUserId = body.userId;

    // Prevent self-impersonation
    if (targetUserId === caller.id) {
      return errorResponse("Cannot impersonate yourself", 400);
    }

    // Find target user
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, targetUserId),
      columns: { id: true, email: true, name: true, position: true, status: true },
    });

    if (!targetUser) {
      return errorResponse("User not found", 404);
    }

    // Target user must be ACTIVE
    if (targetUser.status !== "ACTIVE") {
      return errorResponse("Cannot impersonate inactive user", 400);
    }

    // Create response with cookie
    const response = successResponse({
      success: true,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        position: targetUser.position,
      },
    });

    // Set session cookie (no maxAge = session cookie, clears on browser close)
    response.cookies.set(COOKIE_NAME, targetUserId, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("Failed to start impersonation:", error);
    return errorResponse("Failed to start impersonation", 500);
  }
}

/**
 * DELETE /api/admin/impersonate
 * Stop impersonating and clear the cookie.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return errorResponse(auth.error, auth.status);
    }

    // Create response with cookie cleared
    const response = successResponse({ success: true });

    // Clear the cookie by setting maxAge to 0
    response.cookies.set(COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Failed to stop impersonation:", error);
    return errorResponse("Failed to stop impersonation", 500);
  }
}

/**
 * GET /api/admin/impersonate
 * Get current impersonation state.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Check authentication
    const auth = await requireAuth(request);
    if ("error" in auth) {
      return errorResponse(auth.error, auth.status);
    }

    // Check for impersonation cookie
    const impersonateUserId = request.cookies.get(COOKIE_NAME)?.value;

    if (!impersonateUserId) {
      return successResponse({ impersonating: false });
    }

    // Fetch impersonated user
    const impersonatedUser = await db.query.users.findFirst({
      where: eq(users.id, impersonateUserId),
      columns: { id: true, name: true, position: true, image: true },
    });

    if (!impersonatedUser) {
      // User was deleted - clear stale cookie
      const response = successResponse({ impersonating: false });
      response.cookies.set(COOKIE_NAME, "", {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 0,
      });
      return response;
    }

    return successResponse({
      impersonating: true,
      user: {
        id: impersonatedUser.id,
        name: impersonatedUser.name,
        position: impersonatedUser.position,
        image: impersonatedUser.image,
      },
    });
  } catch (error) {
    console.error("Failed to get impersonation state:", error);
    return errorResponse("Failed to get impersonation state", 500);
  }
}
