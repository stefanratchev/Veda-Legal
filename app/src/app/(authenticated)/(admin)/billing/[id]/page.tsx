import { redirect } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { db, serviceDescriptions, serviceDescriptionTopics, serviceDescriptionLineItems } from "@/lib/db";
import { ServiceDescriptionDetail } from "@/components/billing/ServiceDescriptionDetail";
import { serializeServiceDescription } from "@/lib/billing-utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ServiceDescriptionPage({ params }: PageProps) {
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
          retainerFee: true,
          retainerHours: true,
          notes: true,
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
                with: {
                  user: {
                    columns: { name: true },
                  },
                },
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

  const serviceDescription = serializeServiceDescription(sd);

  return <ServiceDescriptionDetail serviceDescription={serviceDescription} />;
}
