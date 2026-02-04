import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser } from "@/test/mocks/factories";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireAdmin, mockDb } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockDb: {
    query: {
      subtopics: {
        findMany: vi.fn(),
      },
    },
    select: vi.fn(),
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
    requireAdmin: mockRequireAdmin,
  };
});

// Import route after mocks are set up
import { PATCH, DELETE } from "./route";

// Helper to create route context
function createRouteContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/topics/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAdmin.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/topics/topic-123",
        body: { name: "Updated Topic" },
      });

      const response = await PATCH(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 403 when user lacks write access", async () => {
      mockRequireAdmin.mockResolvedValue({ error: "Forbidden", status: 403 });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/topics/topic-123",
        body: { name: "Updated Topic" },
      });

      const response = await PATCH(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });
  });

  describe("Validation", () => {
    it("returns 400 for invalid JSON body", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = new NextRequest("http://localhost:3000/api/topics/topic-123", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json }",
      });

      const response = await PATCH(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON");
    });

    it("returns 400 when name is empty string", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/topics/topic-123",
        body: { name: "   " },
      });

      const response = await PATCH(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name is required");
    });

    it("returns 400 when name is not a string", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/topics/topic-123",
        body: { name: 123 },
      });

      const response = await PATCH(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name is required");
    });

    it("returns 400 when name exceeds max length", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/topics/topic-123",
        body: { name: "A".repeat(101) },
      });

      const response = await PATCH(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name must be 100 characters or less");
    });

    it("returns 400 for negative display order", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/topics/topic-123",
        body: { displayOrder: -1 },
      });

      const response = await PATCH(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid display order");
    });

    it("returns 400 for non-numeric display order", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/topics/topic-123",
        body: { displayOrder: "not-a-number" },
      });

      const response = await PATCH(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid display order");
    });

    it("returns 400 for invalid status", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/topics/topic-123",
        body: { status: "INVALID" },
      });

      const response = await PATCH(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid status");
    });

    it("returns 400 for invalid topicType value", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/topics/topic-123",
        body: { topicType: "INVALID_TYPE" },
      });

      const response = await PATCH(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid topicType");
    });
  });

  describe("Happy Path", () => {
    it("updates topic name", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const updatedTopic = {
        id: "topic-123",
        name: "Updated Topic Name",
        displayOrder: 1,
        status: "ACTIVE",
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedTopic]),
          }),
        }),
      });

      mockDb.query.subtopics.findMany.mockResolvedValue([
        { id: "sub-1", name: "Subtopic 1", isPrefix: true, displayOrder: 1, status: "ACTIVE" },
      ]);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/topics/topic-123",
        body: { name: "Updated Topic Name" },
      });

      const response = await PATCH(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("topic-123");
      expect(data.name).toBe("Updated Topic Name");
      expect(data.subtopics).toHaveLength(1);
    });

    it("updates topic display order", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const updatedTopic = {
        id: "topic-123",
        name: "Topic",
        displayOrder: 5,
        status: "ACTIVE",
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedTopic]),
          }),
        }),
      });

      mockDb.query.subtopics.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/topics/topic-123",
        body: { displayOrder: 5 },
      });

      const response = await PATCH(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.displayOrder).toBe(5);
    });

    it("updates topic status to INACTIVE", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const updatedTopic = {
        id: "topic-123",
        name: "Topic",
        displayOrder: 1,
        status: "INACTIVE",
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedTopic]),
          }),
        }),
      });

      mockDb.query.subtopics.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/topics/topic-123",
        body: { status: "INACTIVE" },
      });

      const response = await PATCH(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe("INACTIVE");
    });

    it("updates multiple fields at once", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const updatedTopic = {
        id: "topic-123",
        name: "New Name",
        topicType: "REGULAR",
        displayOrder: 10,
        status: "ACTIVE",
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedTopic]),
          }),
        }),
      });

      mockDb.query.subtopics.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/topics/topic-123",
        body: { name: "New Name", displayOrder: 10, status: "ACTIVE" },
      });

      const response = await PATCH(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe("New Name");
      expect(data.displayOrder).toBe(10);
      expect(data.status).toBe("ACTIVE");
    });

    it("updates topicType with valid value", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const updatedTopic = {
        id: "topic-123",
        name: "Holiday",
        topicType: "INTERNAL",
        displayOrder: 1,
        status: "ACTIVE",
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedTopic]),
          }),
        }),
      });

      mockDb.query.subtopics.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/topics/topic-123",
        body: { topicType: "INTERNAL" },
      });

      const response = await PATCH(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.topicType).toBe("INTERNAL");
    });

    it("updates topicType to MANAGEMENT", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const updatedTopic = {
        id: "topic-123",
        name: "Strategy",
        topicType: "MANAGEMENT",
        displayOrder: 1,
        status: "ACTIVE",
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedTopic]),
          }),
        }),
      });

      mockDb.query.subtopics.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/topics/topic-123",
        body: { topicType: "MANAGEMENT" },
      });

      const response = await PATCH(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.topicType).toBe("MANAGEMENT");
    });

    it("trims whitespace from name", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const updatedTopic = {
        id: "topic-123",
        name: "Trimmed Name",
        displayOrder: 1,
        status: "ACTIVE",
      };

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedTopic]),
          }),
        }),
      });

      mockDb.query.subtopics.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "PATCH",
        url: "/api/topics/topic-123",
        body: { name: "  Trimmed Name  " },
      });

      const response = await PATCH(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe("Trimmed Name");
    });
  });

  describe("Not Found", () => {
    it("returns 404 when topic not found", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
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
        url: "/api/topics/nonexistent-id",
        body: { name: "Updated Name" },
      });

      const response = await PATCH(request, createRouteContext("nonexistent-id"));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Topic not found");
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error during update", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
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
        url: "/api/topics/topic-123",
        body: { name: "Updated Name" },
      });

      const response = await PATCH(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to update topic");
    });
  });
});

describe("DELETE /api/topics/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAdmin.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/topics/topic-123",
      });

      const response = await DELETE(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 403 when user lacks write access", async () => {
      mockRequireAdmin.mockResolvedValue({ error: "Forbidden", status: 403 });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/topics/topic-123",
      });

      const response = await DELETE(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
    });
  });

  describe("Business Rules", () => {
    it("returns 400 when topic has subtopics", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 3 }]),
        }),
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/topics/topic-123",
      });

      const response = await DELETE(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cannot delete topic with subtopics. Delete subtopics first.");
    });
  });

  describe("Happy Path", () => {
    it("deletes topic when no subtopics exist", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/topics/topic-123",
      });

      const response = await DELETE(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error during subtopic count check", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockRejectedValue(new Error("Database connection failed")),
        }),
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/topics/topic-123",
      });

      const response = await DELETE(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to delete topic");
    });

    it("returns 500 on database error during delete", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAdmin.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 0 }]),
        }),
      });

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error("Database connection failed")),
      });

      const request = createMockRequest({
        method: "DELETE",
        url: "/api/topics/topic-123",
      });

      const response = await DELETE(request, createRouteContext("topic-123"));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to delete topic");
    });
  });
});
