import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import { requireAuth, serializeDecimal, errorResponse } from "@/lib/api-utils";
import { ServiceDescriptionPDF } from "@/lib/billing-pdf";
import { ServiceDescription } from "@/types";

type RouteParams = { params: Promise<{ id: string }> };

// Helper to serialize the data for PDF
function serializeForPDF(sd: any): ServiceDescription {
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
    periodStart: sd.periodStart.toISOString().split("T")[0],
    periodEnd: sd.periodEnd.toISOString().split("T")[0],
    status: sd.status,
    finalizedAt: sd.finalizedAt?.toISOString() || null,
    topics: sd.topics.map((topic: any) => ({
      id: topic.id,
      topicName: topic.topicName,
      displayOrder: topic.displayOrder,
      pricingMode: topic.pricingMode,
      hourlyRate: serializeDecimal(topic.hourlyRate),
      fixedFee: serializeDecimal(topic.fixedFee),
      lineItems: topic.lineItems.map((item: any) => ({
        id: item.id,
        timeEntryId: item.timeEntryId,
        date: item.date?.toISOString().split("T")[0] || null,
        description: item.description,
        hours: serializeDecimal(item.hours),
        fixedAmount: serializeDecimal(item.fixedAmount),
        displayOrder: item.displayOrder,
      })),
    })),
    createdAt: sd.createdAt.toISOString(),
    updatedAt: sd.updatedAt.toISOString(),
  };
}

// GET /api/billing/[id]/pdf - Generate and download PDF
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  try {
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
              orderBy: [{ date: "asc" }, { displayOrder: "asc" }],
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
