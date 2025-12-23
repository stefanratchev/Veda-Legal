import { redirect } from "next/navigation";
import { eq, asc, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/user";
import { db, clients, serviceDescriptions } from "@/lib/db";
import { BillingContent } from "@/components/billing/BillingContent";

export default async function BillingPage() {
  const user = await getCurrentUser();

  if (!["ADMIN", "PARTNER"].includes(user.position)) {
    redirect("/timesheets");
  }

  // Fetch service descriptions with calculated totals
  const serviceDescriptionsList = await db.query.serviceDescriptions.findMany({
    columns: {
      id: true,
      clientId: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      updatedAt: true,
    },
    with: {
      client: {
        columns: { name: true },
      },
      topics: {
        columns: {
          pricingMode: true,
          hourlyRate: true,
          fixedFee: true,
        },
        with: {
          lineItems: {
            columns: { hours: true, fixedAmount: true },
          },
        },
      },
    },
    orderBy: [desc(serviceDescriptions.updatedAt)],
  });

  // Transform to list items with calculated totals
  const listItems = serviceDescriptionsList.map((sd) => {
    let totalAmount = 0;
    for (const topic of sd.topics) {
      if (topic.pricingMode === "FIXED" && topic.fixedFee) {
        totalAmount += Number(topic.fixedFee);
      } else if (topic.pricingMode === "HOURLY" && topic.hourlyRate) {
        const totalHours = topic.lineItems.reduce(
          (sum, item) => sum + (item.hours ? Number(item.hours) : 0),
          0
        );
        totalAmount += totalHours * Number(topic.hourlyRate);
        totalAmount += topic.lineItems.reduce(
          (sum, item) => sum + (item.fixedAmount ? Number(item.fixedAmount) : 0),
          0
        );
      }
    }

    return {
      id: sd.id,
      clientId: sd.clientId,
      clientName: sd.client.name,
      // In Drizzle, date columns are strings
      periodStart: sd.periodStart,
      periodEnd: sd.periodEnd,
      status: sd.status as "DRAFT" | "FINALIZED",
      totalAmount: Math.round(totalAmount * 100) / 100,
      // In Drizzle, timestamp with mode:'string' is already ISO string
      updatedAt: sd.updatedAt,
    };
  });

  // Fetch clients for the create modal
  const clientsList = await db.query.clients.findMany({
    where: eq(clients.status, "ACTIVE"),
    columns: { id: true, name: true },
    orderBy: [asc(clients.name)],
  });

  return <BillingContent initialServiceDescriptions={listItems} clients={clientsList} />;
}
