import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "@/test/helpers/api";
import type { TrendResponse } from "@/types/reports";

const { mockRequireAdmin, mockGetTrendData } = vi.hoisted(() => {
  return {
    mockRequireAdmin: vi.fn(),
    mockGetTrendData: vi.fn(),
  };
});

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...original,
    requireAdmin: mockRequireAdmin,
  };
});

vi.mock("@/lib/trend-utils", () => ({
  getTrendData: mockGetTrendData,
}));

import { GET } from "./route";

const mockTrendResponse: TrendResponse = {
  months: [
    {
      month: "2026-02",
      label: "Feb '26",
      totalHours: 320,
      billableHours: 230,
      revenue: 48000,
      billedRevenue: 44000,
      standardRateValue: 48000,
      realization: 92,
      activeClients: 15,
      utilization: 72,
      byEmployee: [
        { id: "u1", name: "Alice", hours: 160, billableHours: 115, billedRevenue: 22000 },
        { id: "u2", name: "Bob", hours: 160, billableHours: 115, billedRevenue: 22000 },
      ],
    },
    {
      month: "2026-03",
      label: "Mar '26",
      totalHours: 350,
      billableHours: 262,
      revenue: 52500,
      billedRevenue: 48000,
      standardRateValue: 52500,
      realization: 91,
      activeClients: 17,
      utilization: 75,
      byEmployee: [
        { id: "u1", name: "Alice", hours: 180, billableHours: 131, billedRevenue: 24000 },
        { id: "u2", name: "Bob", hours: 170, billableHours: 131, billedRevenue: 24000 },
      ],
    },
    {
      month: "2026-04",
      label: "Apr '26",
      totalHours: 340,
      billableHours: 248,
      revenue: 51000,
      billedRevenue: 46000,
      standardRateValue: 51000,
      realization: 90,
      activeClients: 16,
      utilization: 73,
      byEmployee: [
        { id: "u1", name: "Alice", hours: 170, billableHours: 124, billedRevenue: 23000 },
        { id: "u2", name: "Bob", hours: 170, billableHours: 124, billedRevenue: 23000 },
      ],
    },
  ],
  latest: {
    totalHours: 340,
    revenue: 51000,
    activeClients: 16,
    utilization: 73,
  },
  previous: {
    totalHours: 350,
    revenue: 52500,
    activeClients: 17,
    utilization: 75,
  },
};

function setupAuthenticatedAdmin() {
  mockRequireAdmin.mockResolvedValue({
    session: { user: { name: "Admin", email: "admin@example.com" } },
  });
}

describe("GET /api/reports/trends", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAdmin.mockResolvedValue({
      error: "Unauthorized",
      status: 401,
    });

    const request = createMockRequest({
      method: "GET",
      url: "/api/reports/trends",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 403 for non-admin", async () => {
    mockRequireAdmin.mockResolvedValue({
      error: "Admin access required",
      status: 403,
    });

    const request = createMockRequest({
      method: "GET",
      url: "/api/reports/trends",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("Admin access required");
  });

  it("returns 200 with TrendResponse for ADMIN", async () => {
    setupAuthenticatedAdmin();
    mockGetTrendData.mockResolvedValue(mockTrendResponse);

    const request = createMockRequest({
      method: "GET",
      url: "/api/reports/trends",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.months).toHaveLength(3);
    expect(data.latest.totalHours).toBe(340);
    expect(data.previous.totalHours).toBe(350);
    expect(data.months[0].byEmployee).toHaveLength(2);
  });

  it("returns 200 for PARTNER (requireAdmin allows PARTNER)", async () => {
    mockRequireAdmin.mockResolvedValue({
      session: { user: { name: "Partner", email: "partner@example.com" } },
    });
    mockGetTrendData.mockResolvedValue(mockTrendResponse);

    const request = createMockRequest({
      method: "GET",
      url: "/api/reports/trends",
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  it("returns 500 on database error", async () => {
    setupAuthenticatedAdmin();
    mockGetTrendData.mockRejectedValue(new Error("DB down"));

    const request = createMockRequest({
      method: "GET",
      url: "/api/reports/trends",
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch trend data");
  });
});
