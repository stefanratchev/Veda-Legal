import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser } from "@/test/mocks/factories";

// Use vi.hoisted() to create mocks that are available when vi.mock is hoisted
const { mockRequireAuth, mockRequireWriteAccess, mockDb } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRequireWriteAccess: vi.fn(),
  mockDb: {
    query: {
      topics: {
        findMany: vi.fn(),
      },
    },
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...original,
    requireAuth: mockRequireAuth,
    requireWriteAccess: mockRequireWriteAccess,
  };
});

// Import route after mocks are set up
import { GET, POST } from "./route";

describe("GET /api/topics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "GET",
        url: "/api/topics",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });
  });

  describe("TopicType Support", () => {
    it("returns topicType field in response", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const topics = [
        {
          id: "topic-1",
          name: "General Advisory",
          topicType: "REGULAR",
          displayOrder: 1,
          status: "ACTIVE",
          subtopics: [],
        },
        {
          id: "topic-2",
          name: "Holiday",
          topicType: "INTERNAL",
          displayOrder: 2,
          status: "ACTIVE",
          subtopics: [],
        },
        {
          id: "topic-3",
          name: "Strategy",
          topicType: "MANAGEMENT",
          displayOrder: 3,
          status: "ACTIVE",
          subtopics: [],
        },
      ];

      mockDb.query.topics.findMany.mockResolvedValue(topics);

      const request = createMockRequest({
        method: "GET",
        url: "/api/topics",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data[0]).toHaveProperty("topicType", "REGULAR");
      expect(data[1]).toHaveProperty("topicType", "INTERNAL");
      expect(data[2]).toHaveProperty("topicType", "MANAGEMENT");
    });

    it("filters by type query param correctly", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const topics = [
        {
          id: "topic-1",
          name: "Holiday",
          topicType: "INTERNAL",
          displayOrder: 1,
          status: "ACTIVE",
          subtopics: [],
        },
        {
          id: "topic-2",
          name: "Sick Leave",
          topicType: "INTERNAL",
          displayOrder: 2,
          status: "ACTIVE",
          subtopics: [],
        },
      ];

      mockDb.query.topics.findMany.mockResolvedValue(topics);

      const request = createMockRequest({
        method: "GET",
        url: "/api/topics?type=INTERNAL",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockDb.query.topics.findMany).toHaveBeenCalled();
      expect(data.every((t: { topicType: string }) => t.topicType === "INTERNAL")).toBe(true);
    });

    it("returns 400 for invalid type query param", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "GET",
        url: "/api/topics?type=INVALID_TYPE",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid type");
    });
  });

  describe("Happy Path", () => {
    it("returns all active topics with subtopics", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const topics = [
        {
          id: "topic-1",
          name: "General Advisory",
          topicType: "REGULAR",
          displayOrder: 1,
          status: "ACTIVE",
          subtopics: [
            { id: "sub-1", name: "Client correspondence:", isPrefix: true, displayOrder: 1, status: "ACTIVE" },
            { id: "sub-2", name: "Drafting documents:", isPrefix: true, displayOrder: 2, status: "ACTIVE" },
          ],
        },
        {
          id: "topic-2",
          name: "Litigation",
          topicType: "REGULAR",
          displayOrder: 2,
          status: "ACTIVE",
          subtopics: [
            { id: "sub-3", name: "Court appearances", isPrefix: false, displayOrder: 1, status: "ACTIVE" },
          ],
        },
      ];

      mockDb.query.topics.findMany.mockResolvedValue(topics);

      const request = createMockRequest({
        method: "GET",
        url: "/api/topics",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data).toHaveLength(2);
      expect(data[0].name).toBe("General Advisory");
      expect(data[0].subtopics).toHaveLength(2);
      expect(data[1].name).toBe("Litigation");
    });

    it("returns empty array when no topics exist", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.topics.findMany.mockResolvedValue([]);

      const request = createMockRequest({
        method: "GET",
        url: "/api/topics",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it("includes inactive topics when includeInactive=true", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const topics = [
        {
          id: "topic-1",
          name: "Active Topic",
          displayOrder: 1,
          status: "ACTIVE",
          subtopics: [],
        },
        {
          id: "topic-2",
          name: "Inactive Topic",
          displayOrder: 2,
          status: "INACTIVE",
          subtopics: [],
        },
      ];

      mockDb.query.topics.findMany.mockResolvedValue(topics);

      const request = createMockRequest({
        method: "GET",
        url: "/api/topics?includeInactive=true",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data.some((t: { status: string }) => t.status === "INACTIVE")).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error", async () => {
      const user = createMockUser();
      mockRequireAuth.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.query.topics.findMany.mockRejectedValue(new Error("Database connection failed"));

      const request = createMockRequest({
        method: "GET",
        url: "/api/topics",
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch topics");
    });
  });
});

describe("POST /api/topics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validBody = {
    name: "New Topic",
  };

  describe("Authentication", () => {
    it("returns 401 when not authenticated", async () => {
      mockRequireWriteAccess.mockResolvedValue({ error: "Unauthorized", status: 401 });

      const request = createMockRequest({
        method: "POST",
        url: "/api/topics",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 403 when user lacks write access", async () => {
      mockRequireWriteAccess.mockResolvedValue({ error: "Forbidden", status: 403 });

      const request = createMockRequest({
        method: "POST",
        url: "/api/topics",
        body: validBody,
      });

      const response = await POST(request);
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

      const request = new NextRequest("http://localhost:3000/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{ invalid json }",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON");
    });

    it("returns 400 when name is missing", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/topics",
        body: {},
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name is required");
    });

    it("returns 400 when name is empty string", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/topics",
        body: { name: "   " },
      });

      const response = await POST(request);
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
        method: "POST",
        url: "/api/topics",
        body: { name: 123 },
      });

      const response = await POST(request);
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
        method: "POST",
        url: "/api/topics",
        body: { name: "A".repeat(101) },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Name must be 100 characters or less");
    });

    it("returns 400 for invalid topicType value", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/topics",
        body: { name: "New Topic", topicType: "INVALID_TYPE" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid topicType");
    });
  });

  describe("Happy Path", () => {
    it("creates topic with valid data", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const createdTopic = {
        id: "topic-123",
        name: "New Topic",
        displayOrder: 1,
        status: "ACTIVE",
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockResolvedValue([{ maxOrder: 0 }]),
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdTopic]),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/topics",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe("topic-123");
      expect(data.name).toBe("New Topic");
      expect(data.status).toBe("ACTIVE");
      expect(data.subtopics).toEqual([]);
    });

    it("trims whitespace from name", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const createdTopic = {
        id: "topic-123",
        name: "Trimmed Topic",
        displayOrder: 1,
        status: "ACTIVE",
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockResolvedValue([{ maxOrder: 0 }]),
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdTopic]),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/topics",
        body: { name: "  Trimmed Topic  " },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe("Trimmed Topic");
    });

    it("assigns next display order automatically", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const createdTopic = {
        id: "topic-123",
        name: "New Topic",
        topicType: "REGULAR",
        displayOrder: 5,
        status: "ACTIVE",
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockResolvedValue([{ maxOrder: 4 }]),
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdTopic]),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/topics",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.displayOrder).toBe(5);
    });

    it("accepts valid topicType values (REGULAR, INTERNAL, MANAGEMENT)", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const createdTopic = {
        id: "topic-123",
        name: "Holiday",
        topicType: "INTERNAL",
        displayOrder: 1,
        status: "ACTIVE",
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockResolvedValue([{ maxOrder: 0 }]),
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdTopic]),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/topics",
        body: { name: "Holiday", topicType: "INTERNAL" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.topicType).toBe("INTERNAL");
    });

    it("defaults topicType to REGULAR when not provided", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const createdTopic = {
        id: "topic-123",
        name: "New Topic",
        topicType: "REGULAR",
        displayOrder: 1,
        status: "ACTIVE",
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockResolvedValue([{ maxOrder: 0 }]),
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdTopic]),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/topics",
        body: { name: "New Topic" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.topicType).toBe("REGULAR");
    });

    it("creates topic with MANAGEMENT type", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      const createdTopic = {
        id: "topic-123",
        name: "Strategy Planning",
        topicType: "MANAGEMENT",
        displayOrder: 1,
        status: "ACTIVE",
      };

      mockDb.select.mockReturnValue({
        from: vi.fn().mockResolvedValue([{ maxOrder: 0 }]),
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdTopic]),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/topics",
        body: { name: "Strategy Planning", topicType: "MANAGEMENT" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.topicType).toBe("MANAGEMENT");
    });
  });

  describe("Error Handling", () => {
    it("returns 500 on database error during max order fetch", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error("Database connection failed")),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/topics",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to create topic");
    });

    it("returns 500 on database error during insert", async () => {
      const user = createMockUser({ position: "ADMIN" });
      mockRequireWriteAccess.mockResolvedValue({
        session: { user: { name: user.name, email: user.email } },
      });

      mockDb.select.mockReturnValue({
        from: vi.fn().mockResolvedValue([{ maxOrder: 0 }]),
      });

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error("Database connection failed")),
        }),
      });

      const request = createMockRequest({
        method: "POST",
        url: "/api/topics",
        body: validBody,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to create topic");
    });
  });
});
