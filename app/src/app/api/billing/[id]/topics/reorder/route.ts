import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { serviceDescriptions, serviceDescriptionTopics } from "@/lib/schema";
import { requireAdmin, errorResponse } from "@/lib/api-utils";

interface ReorderItem {
  id: string;
  displayOrder: number;
}

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin(request);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { items } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse("Items array is required", 400);
  }

  for (const item of items) {
    if (typeof item.id !== "string" || item.id.length === 0) {
      return errorResponse("Each item must have a valid id", 400);
    }
    if (typeof item.displayOrder !== "number" || item.displayOrder < 0) {
      return errorResponse("Each item must have a valid displayOrder", 400);
    }
  }

  try {
    const sd = await db.query.serviceDescriptions.findFirst({
      where: eq(serviceDescriptions.id, id),
      columns: { status: true },
    });

    if (!sd) {
      return errorResponse("Service description not found", 404);
    }

    if (sd.status === "FINALIZED") {
      return errorResponse("Cannot modify finalized service description", 400);
    }

    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      await Promise.all((items as ReorderItem[]).map((item) =>
        tx.update(serviceDescriptionTopics)
          .set({ displayOrder: item.displayOrder, updatedAt: now })
          .where(and(eq(serviceDescriptionTopics.id, item.id), eq(serviceDescriptionTopics.serviceDescriptionId, id)))
      ));
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Database error reordering topics:", error);
    return errorResponse("Failed to reorder topics", 500);
  }
}
