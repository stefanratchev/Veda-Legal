import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { DashboardContent } from "@/components/dashboard/DashboardContent";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
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

  const user = {
    name: session.user.name || "User",
    role: "Employee", // This would come from the database in a real app
    initials: getInitials(session.user.name),
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="flex-1 ml-[240px]">
        <div className="px-6 py-5">
          <DashboardContent />
        </div>
      </main>
    </div>
  );
}
