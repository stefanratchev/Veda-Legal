import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/Sidebar";
import { TimesheetsContent } from "@/components/timesheets/TimesheetsContent";

export default async function TimesheetsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  // Get user initials from name
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Get user from database
  const dbUser = await db.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, role: true },
  });

  if (!dbUser) {
    // User should be auto-created on login via auth callback
    // If they're here without a DB record, something went wrong - redirect to re-login
    redirect("/login");
  }

  const user = {
    name: dbUser.name || session.user.name || "User",
    role: dbUser.role,
    initials: getInitials(dbUser.name || session.user.name),
  };

  // Fetch active clients for the dropdown
  const clients = await db.client.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      timesheetCode: true,
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="flex-1 ml-[240px]">
        <div className="px-6 py-5">
          <TimesheetsContent
            userId={dbUser.id}
            clients={clients}
          />
        </div>
      </main>
    </div>
  );
}
