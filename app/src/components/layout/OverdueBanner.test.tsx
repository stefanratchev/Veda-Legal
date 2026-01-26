import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { OverdueBanner } from "./OverdueBanner";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className} data-testid="overdue-link">
      {children}
    </a>
  ),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("OverdueBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("returns null while loading", () => {
      // Never resolves - stays in loading state
      mockFetch.mockImplementation(() => new Promise(() => {}));
      const { container } = render(<OverdueBanner isAdmin={false} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("Empty State", () => {
    it("returns null when no overdue dates", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ overdue: [] }),
      });
      const { container } = render(<OverdueBanner isAdmin={false} />);

      await act(async () => {
        await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());
      });

      expect(container.firstChild).toBeNull();
    });

    it("returns null when overdue is null", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ overdue: null }),
      });
      const { container } = render(<OverdueBanner isAdmin={false} />);

      await act(async () => {
        await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());
      });

      expect(container.firstChild).toBeNull();
    });
  });

  describe("User View", () => {
    it("displays overdue count", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ overdue: ["2026-01-20", "2026-01-21"] }),
      });
      render(<OverdueBanner isAdmin={false} />);

      await waitFor(() => {
        expect(screen.getByText(/2 overdue/)).toBeInTheDocument();
      });
    });

    it("displays date range summary", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ overdue: ["2026-01-20", "2026-01-22"] }),
      });
      render(<OverdueBanner isAdmin={false} />);

      await waitFor(() => {
        // Should show date range: "Tue 20 Jan — Thu 22 Jan"
        expect(screen.getByText(/Tue 20 Jan/)).toBeInTheDocument();
        expect(screen.getByText(/Thu 22 Jan/)).toBeInTheDocument();
      });
    });

    it("renders Fix now link to timesheets", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ overdue: ["2026-01-20"] }),
      });
      render(<OverdueBanner isAdmin={false} />);

      await waitFor(() => {
        const link = screen.getByTestId("overdue-link");
        expect(link).toHaveAttribute("href", "/timesheets");
        expect(link).toHaveTextContent("Fix now");
      });
    });

    it("shows individual dates when expanded", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ overdue: ["2026-01-20", "2026-01-21", "2026-01-22"] }),
      });
      render(<OverdueBanner isAdmin={false} />);

      await waitFor(() => {
        expect(screen.getByText(/3 overdue/)).toBeInTheDocument();
      });

      // Click expand button
      const expandButton = screen.getByTitle("Show all dates");
      fireEvent.click(expandButton);

      // Should show individual date pills
      await waitFor(() => {
        expect(screen.getByText("Tue 20")).toBeInTheDocument();
        expect(screen.getByText("Wed 21")).toBeInTheDocument();
        expect(screen.getByText("Thu 22")).toBeInTheDocument();
      });
    });

    it("uses singular 'timesheet' for single overdue", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ overdue: ["2026-01-20"] }),
      });
      render(<OverdueBanner isAdmin={false} />);

      await waitFor(() => {
        expect(screen.getByText(/1 overdue/)).toBeInTheDocument();
        expect(screen.getByText(/timesheet$/)).toBeInTheDocument();
      });
    });

    it("uses plural 'timesheets' for multiple overdue", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ overdue: ["2026-01-20", "2026-01-21"] }),
      });
      render(<OverdueBanner isAdmin={false} />);

      await waitFor(() => {
        expect(screen.getByText(/2 overdue/)).toBeInTheDocument();
        expect(screen.getByText(/timesheets$/)).toBeInTheDocument();
      });
    });
  });

  describe("Admin View", () => {
    it("displays team overdue summary with total count", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            overdue: [
              { userId: "1", name: "John Doe", dates: ["2026-01-20", "2026-01-21"] },
              { userId: "2", name: "Jane Smith", dates: ["2026-01-20"] },
            ],
          }),
      });
      render(<OverdueBanner isAdmin={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Team:/)).toBeInTheDocument();
        expect(screen.getByText(/3 overdue/)).toBeInTheDocument();
        expect(screen.getByText(/2 people/)).toBeInTheDocument();
      });
    });

    it("uses singular 'person' for single team member", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            overdue: [{ userId: "1", name: "John Doe", dates: ["2026-01-20"] }],
          }),
      });
      render(<OverdueBanner isAdmin={true} />);

      await waitFor(() => {
        expect(screen.getByText(/1 person/)).toBeInTheDocument();
      });
    });

    it("shows team member names when expanded", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            overdue: [
              { userId: "1", name: "John Doe", dates: ["2026-01-20", "2026-01-21"] },
              { userId: "2", name: "Jane Smith", dates: ["2026-01-20"] },
            ],
          }),
      });
      render(<OverdueBanner isAdmin={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Team:/)).toBeInTheDocument();
      });

      // Click expand button
      const expandButton = screen.getByTitle("Show details");
      fireEvent.click(expandButton);

      // Should show team member names with counts
      await waitFor(() => {
        expect(screen.getByText(/John/)).toBeInTheDocument();
        expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
        expect(screen.getByText(/Jane/)).toBeInTheDocument();
        expect(screen.getByText(/\(1\)/)).toBeInTheDocument();
      });
    });

    it("shows both personal and team banners when admin has personal overdue", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            overdue: [
              { userId: "1", name: "Admin User", dates: ["2026-01-20", "2026-01-21"] },
              { userId: "2", name: "Jane Smith", dates: ["2026-01-22"] },
            ],
          }),
      });
      render(<OverdueBanner isAdmin={true} userName="Admin User" />);

      await waitFor(() => {
        // Should show personal banner
        expect(screen.getByText(/You have/)).toBeInTheDocument();
        expect(screen.getByText(/2 overdue/)).toBeInTheDocument();
        // Should show team summary
        expect(screen.getByText(/Team:/)).toBeInTheDocument();
      });

      // Personal banner has Fix now link
      const link = screen.getByTestId("overdue-link");
      expect(link).toHaveAttribute("href", "/timesheets");
    });

    it("shows only team banner when admin has no personal overdue", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            overdue: [
              { userId: "1", name: "John Doe", dates: ["2026-01-20"] },
              { userId: "2", name: "Jane Smith", dates: ["2026-01-22"] },
            ],
          }),
      });
      render(<OverdueBanner isAdmin={true} userName="Admin User" />);

      await waitFor(() => {
        // Should only show team summary
        expect(screen.getByText(/Team:/)).toBeInTheDocument();
      });

      // Should NOT show personal banner
      expect(screen.queryByText(/You have/)).not.toBeInTheDocument();
      // No Fix now link
      expect(screen.queryByTestId("overdue-link")).not.toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("displays error state when fetch fails with network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));
      render(<OverdueBanner isAdmin={false} />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
      });
    });

    it("displays error state when response is not ok", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });
      render(<OverdueBanner isAdmin={false} />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load/)).toBeInTheDocument();
      });
    });

    it("uses danger styling for error state", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));
      render(<OverdueBanner isAdmin={false} />);

      await waitFor(() => {
        const errorElement = screen.getByText(/Failed to load/);
        expect(errorElement.className).toContain("text-[var(--danger)]");
      });
    });
  });

  describe("Polling", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("fetches overdue status on mount", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ overdue: [] }),
      });

      await act(async () => {
        render(<OverdueBanner isAdmin={false} />);
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/timesheets/overdue");
    });

    it("polls every 5 minutes", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ overdue: [] }),
      });

      await act(async () => {
        render(<OverdueBanner isAdmin={false} />);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance 5 minutes
      await act(async () => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Advance another 5 minutes
      await act(async () => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });

      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("Styling", () => {
    it("uses gradient background styling for user view", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ overdue: ["2026-01-20"] }),
      });
      const { container } = render(<OverdueBanner isAdmin={false} />);

      await waitFor(() => {
        expect(screen.getByText(/1 overdue/)).toBeInTheDocument();
      });

      const banner = container.firstChild as HTMLElement;
      expect(banner.className).toContain("bg-gradient-to-r");
      expect(banner.className).toContain("border-b");
    });

    it("uses warning color for team banner", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            overdue: [{ userId: "1", name: "John Doe", dates: ["2026-01-20"] }],
          }),
      });
      render(<OverdueBanner isAdmin={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Team:/)).toBeInTheDocument();
      });

      // Team banner uses warning color
      expect(screen.getByText(/1 overdue/).className).toContain("text-[var(--warning)]");
    });
  });
});
