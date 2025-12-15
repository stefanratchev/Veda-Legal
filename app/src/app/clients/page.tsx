import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ClientsContent } from "@/components/clients/ClientsContent";

export default async function ClientsPage() {
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

  // Fetch clients from database
  const clients = await db.client.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      hourlyRate: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Convert for client component (Decimal to number, Date to string)
  const serializedClients = clients.map((client) => ({
    ...client,
    hourlyRate: client.hourlyRate ? Number(client.hourlyRate) : null,
    createdAt: client.createdAt.toISOString(),
  }));

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="flex-1 ml-[280px]">
        <Header userName={session.user.name?.split(" ")[0]} />
        <div className="px-10 py-8">
          <ClientsContent initialClients={serializedClients} />
        </div>
      </main>
    </div>
  );
}
