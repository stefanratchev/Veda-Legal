import { redirect } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/user";
import { db, serviceDescriptions, serviceDescriptionTopics, serviceDescriptionLineItems } from "@/lib/db";
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

  const sd = await db.query.serviceDescriptions.findFirst({
    where: eq(serviceDescriptions.id, id),
    with: {
      client: {
        columns: {
          id: true,
          name: true,
          invoicedName: true,
          invoiceAttn: true,
          hourlyRate: true,
        },
      },
      topics: {
        orderBy: [asc(serviceDescriptionTopics.displayOrder)],
        with: {
          lineItems: {
            orderBy: [asc(serviceDescriptionLineItems.displayOrder)],
            with: {
              timeEntry: {
                columns: { description: true, hours: true },
              },
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
  // In Drizzle: date() returns strings (YYYY-MM-DD), timestamp with mode:'string' returns ISO strings
  // numeric() returns strings, which serializeDecimal converts to number | null
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
    periodStart: sd.periodStart,
    periodEnd: sd.periodEnd,
    status: sd.status as "DRAFT" | "FINALIZED",
    finalizedAt: sd.finalizedAt || null,
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
        date: item.date || null,
        description: item.description,
        hours: serializeDecimal(item.hours),
        fixedAmount: serializeDecimal(item.fixedAmount),
        displayOrder: item.displayOrder,
        originalDescription: item.timeEntry?.description,
        originalHours: item.timeEntry ? serializeDecimal(item.timeEntry.hours) ?? undefined : undefined,
      })),
    })),
    createdAt: sd.createdAt,
    updatedAt: sd.updatedAt,
  };

  return <ServiceDescriptionDetail serviceDescription={serviceDescription} />;
}
