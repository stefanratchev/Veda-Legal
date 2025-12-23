import { cache } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import type { UserRole } from "@prisma/client";

export interface AuthenticatedUser {
  id: string;
  name: string;
  role: UserRole;
  initials: string;
  image: string | null;
}

/**
 * Get initials from a name string (e.g., "John Doe" -> "JD")
 */
export function getInitials(name: string | null | undefined): string {
  if (!name?.trim()) return "U";
  const parts = name.split(" ").filter((part) => part.length > 0);
  if (parts.length === 0) return "U";
  return parts
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Fetch authenticated user from database by email
 * Returns null if user not found
 */
export async function getAuthenticatedUser(
  email: string
): Promise<AuthenticatedUser | null> {
  const dbUser = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, role: true, image: true },
  });

  if (!dbUser) {
    return null;
  }

  return {
    id: dbUser.id,
    name: dbUser.name || "User",
    role: dbUser.role,
    initials: getInitials(dbUser.name),
    image: dbUser.image,
  };
}

/**
 * Get the current authenticated user (cached per request).
 * Redirects to login if not authenticated.
 * Use this in server components to avoid duplicate auth/user queries.
 */
export const getCurrentUser = cache(async (): Promise<AuthenticatedUser> => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await getAuthenticatedUser(session.user.email);

  if (!user) {
    redirect("/login");
  }

  return user;
});
