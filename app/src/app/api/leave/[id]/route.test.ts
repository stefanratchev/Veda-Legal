import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import { createMockUser } from "@/test/mocks/factories";

const { mockRequireAuth, mockGetUserFromSession, mockDb } = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockGetUserFromSession: vi.fn(),
  mockDb: {
    query: {
      leavePeriods: {
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
    requireAuth: mockRequireAuth,
    getUserFromSession: mockGetUserFromSession,
  };
});

import { PATCH, DELETE } from "./route";

function setupAuthenticatedUser(user: ReturnType<typeof createMockUser>) {
  mockRequireAuth.mockResolvedValue({
    session: { user: { name: user.name, email: user.email } },
  });
  mockGetUserFromSession.mockResolvedValue({
    id: user.id,
    email: user.email,
    name: user.name,
    position: user.position,
  });
}

describe("PATCH /api/leave/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockResolvedValue({ error: "Unauthorized", status: 401 });

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/leave/leave-1",
      body: { status: "APPROVED" },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "leave-1" }) });

    expect(response.status).toBe(401);
  });

  it("returns 404 when leave period not found", async () => {
    const user = createMockUser({ position: "ADMIN" });
    setupAuthenticatedUser(user);
    mockDb.query.leavePeriods.findFirst.mockResolvedValue(null);

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/leave/nonexistent",
      body: { status: "APPROVED" },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "nonexistent" }) });

    expect(response.status).toBe(404);
  });

  it("allows admin to approve pending leave", async () => {
    const admin = createMockUser({ position: "ADMIN" });
    setupAuthenticatedUser(admin);

    const pendingLeave = {
      id: "leave-1",
      userId: "other-user",
      status: "PENDING",
      startDate: "2024-12-23",
      endDate: "2024-12-27",
    };
    mockDb.query.leavePeriods.findFirst.mockResolvedValue(pendingLeave);
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...pendingLeave, status: "APPROVED", reviewedById: admin.id }]),
        }),
      }),
    });

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/leave/leave-1",
      body: { status: "APPROVED" },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "leave-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe("APPROVED");
  });

  it("allows user to edit their own pending leave", async () => {
    const user = createMockUser({ position: "ASSOCIATE" });
    setupAuthenticatedUser(user);

    const pendingLeave = {
      id: "leave-1",
      userId: user.id,
      status: "PENDING",
      startDate: "2024-12-23",
      endDate: "2024-12-27",
      reason: "Old reason",
    };
    mockDb.query.leavePeriods.findFirst.mockResolvedValue(pendingLeave);
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ ...pendingLeave, reason: "New reason" }]),
        }),
      }),
    });

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/leave/leave-1",
      body: { reason: "New reason" },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "leave-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.reason).toBe("New reason");
  });

  it("prevents user from editing non-pending leave", async () => {
    const user = createMockUser({ position: "ASSOCIATE" });
    setupAuthenticatedUser(user);

    const approvedLeave = {
      id: "leave-1",
      userId: user.id,
      status: "APPROVED",
    };
    mockDb.query.leavePeriods.findFirst.mockResolvedValue(approvedLeave);

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/leave/leave-1",
      body: { reason: "New reason" },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "leave-1" }) });

    expect(response.status).toBe(403);
  });

  it("prevents user from changing status", async () => {
    const user = createMockUser({ position: "ASSOCIATE" });
    setupAuthenticatedUser(user);

    const pendingLeave = {
      id: "leave-1",
      userId: user.id,
      status: "PENDING",
    };
    mockDb.query.leavePeriods.findFirst.mockResolvedValue(pendingLeave);

    const request = createMockRequest({
      method: "PATCH",
      url: "/api/leave/leave-1",
      body: { status: "APPROVED" },
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "leave-1" }) });

    expect(response.status).toBe(403);
  });
});

describe("DELETE /api/leave/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows user to delete their own pending leave", async () => {
    const user = createMockUser({ position: "ASSOCIATE" });
    setupAuthenticatedUser(user);

    const pendingLeave = {
      id: "leave-1",
      userId: user.id,
      status: "PENDING",
    };
    mockDb.query.leavePeriods.findFirst.mockResolvedValue(pendingLeave);
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowCount: 1 }),
    });

    const request = createMockRequest({
      method: "DELETE",
      url: "/api/leave/leave-1",
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: "leave-1" }) });

    expect(response.status).toBe(204);
  });

  it("allows admin to delete any leave", async () => {
    const admin = createMockUser({ position: "ADMIN" });
    setupAuthenticatedUser(admin);

    const approvedLeave = {
      id: "leave-1",
      userId: "other-user",
      status: "APPROVED",
    };
    mockDb.query.leavePeriods.findFirst.mockResolvedValue(approvedLeave);
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue({ rowCount: 1 }),
    });

    const request = createMockRequest({
      method: "DELETE",
      url: "/api/leave/leave-1",
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: "leave-1" }) });

    expect(response.status).toBe(204);
  });

  it("prevents user from deleting non-pending leave", async () => {
    const user = createMockUser({ position: "ASSOCIATE" });
    setupAuthenticatedUser(user);

    const approvedLeave = {
      id: "leave-1",
      userId: user.id,
      status: "APPROVED",
    };
    mockDb.query.leavePeriods.findFirst.mockResolvedValue(approvedLeave);

    const request = createMockRequest({
      method: "DELETE",
      url: "/api/leave/leave-1",
    });
    const response = await DELETE(request, { params: Promise.resolve({ id: "leave-1" }) });

    expect(response.status).toBe(403);
  });
});
