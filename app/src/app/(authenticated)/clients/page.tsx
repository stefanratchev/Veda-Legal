import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/user";
import { ClientsContent } from "@/components/clients/ClientsContent";

export default async function ClientsPage() {
  const user = await getCurrentUser();

  // Only ADMIN or PARTNER can access clients page
  if (!["ADMIN", "PARTNER"].includes(user.position)) {
    redirect("/timesheets");
  }

  const clients = await db.client.findMany({
    select: {
      id: true,
      name: true,
      timesheetCode: true,
      invoicedName: true,
      invoiceAttn: true,
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

  return <ClientsContent initialClients={serializedClients} />;
}
