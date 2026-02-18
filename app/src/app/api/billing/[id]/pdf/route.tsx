import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { serviceDescriptions } from "@/lib/schema";
import { requireAdmin, errorResponse } from "@/lib/api-utils";
import { serializeServiceDescription } from "@/lib/billing-utils";
import { ServiceDescriptionPDF } from "@/lib/billing-pdf";

type RouteParams = { params: Promise<{ id: string }> };

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
        retainerFee: true,
        retainerHours: true,
        retainerOverageRate: true,
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
            retainerFee: true,
            retainerHours: true,
            notes: true,
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
                displayOrder: true,
                waiveMode: true,
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

    const data = serializeServiceDescription(sd);
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
