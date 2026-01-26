import { desc } from "drizzle-orm";
import { db, clients } from "@/lib/db";
import { ClientsContent } from "@/components/clients/ClientsContent";

export default async function ClientsPage() {
  const clientsList = await db.query.clients.findMany({
    columns: {
      id: true,
      name: true,
      invoicedName: true,
      invoiceAttn: true,
      email: true,
      secondaryEmails: true,
      hourlyRate: true,
      phone: true,
      address: true,
      practiceArea: true,
      status: true,
      clientType: true,
      notes: true,
      createdAt: true,
    },
    orderBy: [desc(clients.createdAt)],
  });

  // Convert for client component (numeric string to number, timestamp string already ISO)
  const serializedClients = clientsList.map((client) => ({
    ...client,
    hourlyRate: client.hourlyRate ? Number(client.hourlyRate) : null,
    createdAt: client.createdAt,
  }));

  return <ClientsContent initialClients={serializedClients} />;
}
