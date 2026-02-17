import { eq, asc, desc, and } from "drizzle-orm";
import { db, clients, serviceDescriptions } from "@/lib/db";
import { BillingContent } from "@/components/billing/BillingContent";
import { calculateRetainerGrandTotal, calculateGrandTotal } from "@/lib/billing-pdf";

export default async function BillingPage() {
  // Fetch service descriptions with calculated totals
  const serviceDescriptionsList = await db.query.serviceDescriptions.findMany({
    columns: {
      id: true,
      clientId: true,
      periodStart: true,
      periodEnd: true,
      status: true,
      discountType: true,
      discountValue: true,
      retainerFee: true,
      retainerHours: true,
      retainerOverageRate: true,
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
          capHours: true,
          discountType: true,
          discountValue: true,
        },
        with: {
          lineItems: {
            columns: { hours: true, fixedAmount: true, waiveMode: true },
          },
        },
      },
    },
    orderBy: [desc(serviceDescriptions.updatedAt)],
  });

  // Transform to list items with calculated totals
  const listItems = serviceDescriptionsList.map((sd) => {
    const sdRetainerFee = sd.retainerFee ? Number(sd.retainerFee) : null;
    const sdRetainerHours = sd.retainerHours ? Number(sd.retainerHours) : null;
    const sdRetainerOverageRate = sd.retainerOverageRate ? Number(sd.retainerOverageRate) : 0;
    const isRetainer = sdRetainerFee != null && sdRetainerHours != null;

    const topics = sd.topics.map((t) => ({
      id: "", topicName: "", displayOrder: 0,
      pricingMode: t.pricingMode as "HOURLY" | "FIXED",
      hourlyRate: t.hourlyRate ? Number(t.hourlyRate) : null,
      fixedFee: t.fixedFee ? Number(t.fixedFee) : null,
      capHours: t.capHours ? Number(t.capHours) : null,
      discountType: (t.discountType as "PERCENTAGE" | "AMOUNT" | null) || null,
      discountValue: t.discountValue ? Number(t.discountValue) : null,
      lineItems: t.lineItems.map((li) => ({
        id: "", timeEntryId: null, date: null, description: "", displayOrder: 0,
        hours: li.hours ? Number(li.hours) : null,
        fixedAmount: li.fixedAmount ? Number(li.fixedAmount) : null,
        waiveMode: (li.waiveMode as "EXCLUDED" | "ZERO" | null) || null,
      })),
    }));
    const discountType = (sd.discountType as "PERCENTAGE" | "AMOUNT" | null) || null;
    const discountValue = sd.discountValue ? Number(sd.discountValue) : null;

    const totalAmount = isRetainer
      ? calculateRetainerGrandTotal(topics, sdRetainerFee, sdRetainerHours, sdRetainerOverageRate, discountType, discountValue)
      : calculateGrandTotal(topics, discountType, discountValue);

    return {
      id: sd.id,
      clientId: sd.clientId,
      clientName: sd.client.name,
      periodStart: sd.periodStart,
      periodEnd: sd.periodEnd,
      status: sd.status as "DRAFT" | "FINALIZED",
      totalAmount: Math.round(totalAmount * 100) / 100,
      updatedAt: sd.updatedAt,
    };
  });

  // Fetch clients for the create modal (only REGULAR clients for billing)
  const clientsList = await db.query.clients.findMany({
    where: and(
      eq(clients.status, "ACTIVE"),
      eq(clients.clientType, "REGULAR")
    ),
    columns: { id: true, name: true },
    orderBy: [asc(clients.name)],
  });

  return <BillingContent initialServiceDescriptions={listItems} clients={clientsList} />;
}
