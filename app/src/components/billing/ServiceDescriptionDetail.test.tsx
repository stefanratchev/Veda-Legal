import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ServiceDescriptionDetail } from "./ServiceDescriptionDetail";
import type { ServiceDescription } from "@/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

function createServiceDescription(notes: string | null): ServiceDescription {
  return {
    id: "sd-1",
    clientId: "client-1",
    client: {
      id: "client-1",
      name: "Acme Corp",
      invoicedName: null,
      invoiceAttn: null,
      hourlyRate: 200,
      notes,
      retainerFee: null,
      retainerHours: null,
    },
    periodStart: "2026-01-01",
    periodEnd: "2026-01-31",
    status: "DRAFT",
    finalizedAt: null,
    discountType: null,
    discountValue: null,
    retainerFee: null,
    retainerHours: null,
    retainerOverageRate: null,
    topics: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("ServiceDescriptionDetail client notes", () => {
  it("starts collapsed and shows notes after clicking header", () => {
    render(
      <ServiceDescriptionDetail
        serviceDescription={createServiceDescription("First line\nSecond line")}
      />
    );

    expect(screen.getByText("Client Notes")).toBeInTheDocument();
    expect(screen.queryByText(/First line/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Client Notes"));
    expect(screen.getByText(/First line\s+Second line/)).toBeInTheDocument();
  });

  it("shows fallback when notes are null after expanding", () => {
    render(
      <ServiceDescriptionDetail
        serviceDescription={createServiceDescription(null)}
      />
    );

    fireEvent.click(screen.getByText("Client Notes"));
    expect(screen.getByText("No client notes")).toBeInTheDocument();
  });

  it("shows fallback when notes are whitespace after expanding", () => {
    render(
      <ServiceDescriptionDetail
        serviceDescription={createServiceDescription("   ")}
      />
    );

    fireEvent.click(screen.getByText("Client Notes"));
    expect(screen.getByText("No client notes")).toBeInTheDocument();
  });

  it("keeps wrapping classes for long notes", () => {
    const longNote = "This is a very long client note that should wrap across multiple lines when rendered in the notes panel.";
    render(
      <ServiceDescriptionDetail
        serviceDescription={createServiceDescription(longNote)}
      />
    );

    fireEvent.click(screen.getByText("Client Notes"));
    const noteText = screen.getByText(longNote);
    expect(noteText.className).toContain("whitespace-pre-wrap");
    expect(noteText.className).toContain("break-words");
  });
});
