import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { serviceDescriptions } from "@/lib/schema";
import { requireAdmin, serializeDecimal, errorResponse } from "@/lib/api-utils";
import { ServiceDescriptionPDF } from "@/lib/billing-pdf";
import { ServiceDescription } from "@/types";

type RouteParams = { params: Promise<{ id: string }> };

// Helper to serialize the data for PDF
function serializeForPDF(sd: {
  id: string;
  clientId: string;
  client: {
    id: string;
    name: string;
    invoicedName: string | null;
    invoiceAttn: string | null;
    hourlyRate: string | null;
  };
  periodStart: string;
  periodEnd: string;
  status: "DRAFT" | "FINALIZED";
  finalizedAt: string | null;
  discountType: "PERCENTAGE" | "AMOUNT" | null;
  discountValue: string | null;
  topics: Array<{
    id: string;
    topicName: string;
    displayOrder: number;
    pricingMode: "HOURLY" | "FIXED";
    hourlyRate: string | null;
    fixedFee: string | null;
    capHours: string | null;
    discountType: "PERCENTAGE" | "AMOUNT" | null;
    discountValue: string | null;
    lineItems: Array<{
      id: string;
      timeEntryId: string | null;
      date: string | null;
      description: string;
      hours: string | null;
      fixedAmount: string | null;
      displayOrder: number;
    }>;
  }>;
  createdAt: string;
  updatedAt: string;
}): ServiceDescription {
  return {
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
    status: sd.status,
    finalizedAt: sd.finalizedAt || null,
    discountType: sd.discountType,
    discountValue: serializeDecimal(sd.discountValue),
    topics: sd.topics.map((topic) => ({
      id: topic.id,
      topicName: topic.topicName,
      displayOrder: topic.displayOrder,
      pricingMode: topic.pricingMode,
      hourlyRate: serializeDecimal(topic.hourlyRate),
      fixedFee: serializeDecimal(topic.fixedFee),
      capHours: serializeDecimal(topic.capHours),
      discountType: topic.discountType,
      discountValue: serializeDecimal(topic.discountValue),
      lineItems: topic.lineItems.map((item) => ({
        id: item.id,
        timeEntryId: item.timeEntryId,
        date: item.date || null,
        description: item.description,
        hours: serializeDecimal(item.hours),
        fixedAmount: serializeDecimal(item.fixedAmount),
        displayOrder: item.displayOrder,
      })),
    })),
    createdAt: sd.createdAt,
    updatedAt: sd.updatedAt,
  };
}

// GET /api/billing/[id]/pdf - Generate and download PDF
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  try {
    const sd = await db.query.serviceDescriptions.findFirst({
      where: eq(serviceDescriptions.id, id),
      columns: {
        id: true,
        clientId: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        finalizedAt: true,
        discountType: true,
        discountValue: true,
        createdAt: true,
        updatedAt: true,
      },
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
          columns: {
            id: true,
            topicName: true,
            displayOrder: true,
            pricingMode: true,
            hourlyRate: true,
            fixedFee: true,
            capHours: true,
            discountType: true,
            discountValue: true,
          },
          orderBy: (topics) => [asc(topics.displayOrder)],
          with: {
            lineItems: {
              columns: {
                id: true,
                timeEntryId: true,
                date: true,
                description: true,
                hours: true,
                fixedAmount: true,
                displayOrder: true,
              },
              orderBy: (items) => [asc(items.date), asc(items.displayOrder)],
            },
          },
        },
      },
    });

    if (!sd) {
      return errorResponse("Service description not found", 404);
    }

    const data = serializeForPDF(sd);
    const pdfBuffer = await renderToBuffer(<ServiceDescriptionPDF data={data} />);

    const clientName = (data.client.invoicedName || data.client.name).replace(/[^a-zA-Z0-9]/g, "_");
    const period = new Date(data.periodStart).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }).replace(" ", "-");
    const filename = `Service_Description_${clientName}_${period}.pdf`;

    // Convert Buffer to Uint8Array for NextResponse compatibility
    const uint8Array = new Uint8Array(pdfBuffer);

    return new NextResponse(uint8Array, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return errorResponse("Failed to generate PDF", 500);
  }
}
