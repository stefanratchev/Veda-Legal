import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser } from "@/test/mocks/factories";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireWriteAccess, mockDb } = vi.hoisted(() => ({
  mockRequireWriteAccess: vi.fn(),
  mockDb: {
    query: {
      timeEntries: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...original,
    requireWriteAccess: mockRequireWriteAccess,
  };
});

// Import route after mocks are set up
import { PATCH, DELETE } from "./route";

// Helper to create route context
function createRouteContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/subtopics/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireWriteAccess.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/subtopics/sub-123",
        body: { name: "Updated Subtopic" },
      });

      const response = await PATCH(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 403 when user lacks write access", async () => {
      mockRequireWriteAccess.mockResolvedValue({ error: "Forbidden", status: 403 });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/subtopics/sub-123",
        body: { name: "Updated Subtopic" },
      });

      const response = await PATCH(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });
  });

  describe("Validation", () => {
    it("returns 400 for invalid JSON body", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = new NextRequest("http://localhost:3000/api/subtopics/sub-123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json }",
      });

      const response = await PATCH(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON");
    });

    it("returns 400 when name is empty string", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/subtopics/sub-123",
        body: { name: "   " },
      });

      const response = await PATCH(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name is required");
    });

    it("returns 400 when name is not a string", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/subtopics/sub-123",
        body: { name: 123 },
      });

      const response = await PATCH(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name is required");
    });

    it("returns 400 when name exceeds max length", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/subtopics/sub-123",
        body: { name: "A".repeat(201) },
      });

      const response = await PATCH(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name must be 200 characters or less");
    });

    it("returns 400 for negative display order", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/subtopics/sub-123",
        body: { displayOrder: -1 },
      });

      const response = await PATCH(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid display order");
    });

    it("returns 400 for non-numeric display order", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/subtopics/sub-123",
        body: { displayOrder: "not-a-number" },
      });

      const response = await PATCH(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid display order");
    });

    it("returns 400 for invalid status", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/subtopics/sub-123",
        body: { status: "INVALID" },
      });

      const response = await PATCH(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid status");
    });
  });

  describe("Happy Path", () => {
    it("updates subtopic name", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const updatedSubtopic = {
        id: "sub-123",
        name: "Updated Subtopic Name",
        isPrefix: false,
        displayOrder: 1,
        status: "ACTIVE",
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedSubtopic]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/subtopics/sub-123",
        body: { name: "Updated Subtopic Name" },
      });

      const response = await PATCH(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("sub-123");
      expect(data.name).toBe("Updated Subtopic Name");
      expect(data.isPrefix).toBe(false);
    });

    it("auto-detects isPrefix when name ends with colon", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const updatedSubtopic = {
        id: "sub-123",
        name: "Client correspondence:",
        isPrefix: true,
        displayOrder: 1,
        status: "ACTIVE",
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedSubtopic]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/subtopics/sub-123",
        body: { name: "Client correspondence:" },
      });

      const response = await PATCH(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe("Client correspondence:");
      expect(data.isPrefix).toBe(true);
    });

    it("updates subtopic display order", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const updatedSubtopic = {
        id: "sub-123",
        name: "Subtopic",
        isPrefix: false,
        displayOrder: 5,
        status: "ACTIVE",
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedSubtopic]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/subtopics/sub-123",
        body: { displayOrder: 5 },
      });

      const response = await PATCH(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.displayOrder).toBe(5);
    });

    it("updates subtopic status to INACTIVE", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const updatedSubtopic = {
        id: "sub-123",
        name: "Subtopic",
        isPrefix: false,
        displayOrder: 1,
        status: "INACTIVE",
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedSubtopic]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/subtopics/sub-123",
        body: { status: "INACTIVE" },
      });

      const response = await PATCH(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("INACTIVE");
    });

    it("updates multiple fields at once", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const updatedSubtopic = {
        id: "sub-123",
        name: "New Name:",
        isPrefix: true,
        displayOrder: 10,
        status: "ACTIVE",
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedSubtopic]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/subtopics/sub-123",
        body: { name: "New Name:", displayOrder: 10, status: "ACTIVE" },
      });

      const response = await PATCH(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe("New Name:");
      expect(data.isPrefix).toBe(true);
      expect(data.displayOrder).toBe(10);
      expect(data.status).toBe("ACTIVE");
    });

    it("trims whitespace from name", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const updatedSubtopic = {
        id: "sub-123",
        name: "Trimmed Name",
        isPrefix: false,
        displayOrder: 1,
        status: "ACTIVE",
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedSubtopic]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/subtopics/sub-123",
        body: { name: "  Trimmed Name  " },
      });

      const response = await PATCH(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe("Trimmed Name");
    });
  });

  describe("Not Found", () => {
    it("returns 404 when subtopic not found", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/subtopics/nonexistent-id",
        body: { name: "Updated Name" },
      });

      const response = await PATCH(request, createRouteContext("nonexistent-id"));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Subtopic not found");
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error during update", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue(new Error("Database connection failed")),
          }),
        }),
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/subtopics/sub-123",
        body: { name: "Updated Name" },
      });

      const response = await PATCH(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to update subtopic");
    });
  });
});

describe("DELETE /api/subtopics/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireWriteAccess.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/subtopics/sub-123",
      });

      const response = await DELETE(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 403 when user lacks write access", async () => {
      mockRequireWriteAccess.mockResolvedValue({ error: "Forbidden", status: 403 });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/subtopics/sub-123",
      });

      const response = await DELETE(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });
  });

  describe("Business Rules", () => {
    it("returns 400 when subtopic has time entries", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.timeEntries.findFirst.mockResolvedValue({
        id: "entry-1",
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/subtopics/sub-123",
      });

      const response = await DELETE(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot delete subtopic with time entries. Deactivate instead.");
    });
  });

  describe("Happy Path", () => {
    it("deletes subtopic when no time entries exist", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.timeEntries.findFirst.mockResolvedValue(null);

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/subtopics/sub-123",
      });

      const response = await DELETE(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error during time entries check", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.timeEntries.findFirst.mockRejectedValue(new Error("Database connection failed"));

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/subtopics/sub-123",
      });

      const response = await DELETE(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to delete subtopic");
    });

    it("returns 500 on database error during delete", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.timeEntries.findFirst.mockResolvedValue(null);

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error("Database connection failed")),
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/subtopics/sub-123",
      });

      const response = await DELETE(request, createRouteContext("sub-123"));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to delete subtopic");
    });
  });
});
