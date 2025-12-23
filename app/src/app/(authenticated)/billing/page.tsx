import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { db } from "@/lib/db";
import { BillingContent } from "@/components/billing/BillingContent";

export default async function BillingPage() {
  const user = await getCurrentUser();

  if (!["ADMIN", "PARTNER"].includes(user.position)) {
    redirect("/timesheets");
  }

  // Fetch service descriptions with calculated totals
  const serviceDescriptions = await db.serviceDescription.findMany({
    select: {
      id: true,
      clientId: true,
      client: { select: { name: true } },
      periodStart: true,
      periodEnd: true,
      status: true,
      updatedAt: true,
      topics: {
        select: {
          pricingMode: true,
          hourlyRate: true,
          fixedFee: true,
          lineItems: {
            select: { hours: true, fixedAmount: true },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Transform to list items with calculated totals
  const listItems = serviceDescriptions.map((sd) => {
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
      periodStart: sd.periodStart.toISOString().split("T")[0],
      periodEnd: sd.periodEnd.toISOString().split("T")[0],
      status: sd.status as "DRAFT" | "FINALIZED",
      totalAmount: Math.round(totalAmount * 100) / 100,
      updatedAt: sd.updatedAt.toISOString(),
    };
  });

  // Fetch clients for the create modal
  const clients = await db.client.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, timesheetCode: true },
    orderBy: { name: "asc" },
  });

  return <BillingContent initialServiceDescriptions={listItems} clients={clients} />;
}
