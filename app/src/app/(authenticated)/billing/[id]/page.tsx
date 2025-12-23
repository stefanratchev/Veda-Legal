import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { db } from "@/lib/db";
import { ServiceDescriptionDetail } from "@/components/billing/ServiceDescriptionDetail";
import { serializeDecimal } from "@/lib/api-utils";
import type { ServiceDescription } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ServiceDescriptionPage({ params }: PageProps) {
  const user = await getCurrentUser();

  if (!["ADMIN", "PARTNER"].includes(user.position)) {
    redirect("/billing");
  }

  const { id } = await params;

  const sd = await db.serviceDescription.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          invoicedName: true,
          invoiceAttn: true,
          hourlyRate: true,
        },
      },
      topics: {
        orderBy: { displayOrder: "asc" },
        include: {
          lineItems: {
            orderBy: { displayOrder: "asc" },
            include: {
              timeEntry: { select: { description: true, hours: true } },
            },
          },
        },
      },
    },
  });

  if (!sd) {
    redirect("/billing");
  }

  // Serialize for client component
  const serviceDescription: ServiceDescription = {
    id: sd.id,
    clientId: sd.clientId,
    client: {
      id: sd.client.id,
      name: sd.client.name,
      invoicedName: sd.client.invoicedName,
      invoiceAttn: sd.client.invoiceAttn,
      hourlyRate: serializeDecimal(sd.client.hourlyRate),
    },
    periodStart: sd.periodStart.toISOString().split("T")[0],
    periodEnd: sd.periodEnd.toISOString().split("T")[0],
    status: sd.status as "DRAFT" | "FINALIZED",
    finalizedAt: sd.finalizedAt?.toISOString() || null,
    topics: sd.topics.map((topic) => ({
      id: topic.id,
      topicName: topic.topicName,
      displayOrder: topic.displayOrder,
      pricingMode: topic.pricingMode as "HOURLY" | "FIXED",
      hourlyRate: serializeDecimal(topic.hourlyRate),
      fixedFee: serializeDecimal(topic.fixedFee),
      lineItems: topic.lineItems.map((item) => ({
        id: item.id,
        timeEntryId: item.timeEntryId,
        date: item.date?.toISOString().split("T")[0] || null,
        description: item.description,
        hours: serializeDecimal(item.hours),
        fixedAmount: serializeDecimal(item.fixedAmount),
        displayOrder: item.displayOrder,
        originalDescription: item.timeEntry?.description,
        originalHours: item.timeEntry ? serializeDecimal(item.timeEntry.hours) ?? undefined : undefined,
      })),
    })),
    createdAt: sd.createdAt.toISOString(),
    updatedAt: sd.updatedAt.toISOString(),
  };

  return <ServiceDescriptionDetail serviceDescription={serviceDescription} />;
}
