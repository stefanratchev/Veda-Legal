import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
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
    it("displays user overdue dates with formatted text", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ overdue: ["2026-01-20", "2026-01-21"] }),
      });
      render(<OverdueBanner isAdmin={false} />);

      await waitFor(() => {
        expect(
          screen.getByText(/You have overdue timesheets for:/)
        ).toBeInTheDocument();
      });
    });

    it("formats dates as 'Weekday Day Month' format", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ overdue: ["2026-01-20"] }),
      });
      render(<OverdueBanner isAdmin={false} />);

      await waitFor(() => {
        // Should format as "Tue, 20 Jan" (Jan 20, 2026 is a Tuesday)
        expect(screen.getByText(/Tue/)).toBeInTheDocument();
        expect(screen.getByText(/20/)).toBeInTheDocument();
        expect(screen.getByText(/Jan/)).toBeInTheDocument();
      });
    });

    it("renders as a clickable link to timesheets", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ overdue: ["2026-01-20"] }),
      });
      render(<OverdueBanner isAdmin={false} />);

      await waitFor(() => {
        const link = screen.getByTestId("overdue-link");
        expect(link).toHaveAttribute("href", "/timesheets");
      });
    });

    it("displays multiple dates separated by commas", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ overdue: ["2026-01-20", "2026-01-21", "2026-01-22"] }),
      });
      render(<OverdueBanner isAdmin={false} />);

      await waitFor(() => {
        // Should contain commas separating dates
        const text = screen.getByText(/You have overdue timesheets for:/);
        expect(text.textContent).toContain(",");
      });
    });
  });

  describe("Admin View", () => {
    it("displays team summary with user names and day counts", async () => {
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
        expect(screen.getByText(/Overdue timesheets:/)).toBeInTheDocument();
        expect(screen.getByText(/John Doe \(2 days\)/)).toBeInTheDocument();
        expect(screen.getByText(/Jane Smith \(1 day\)/)).toBeInTheDocument();
      });
    });

    it("uses singular 'day' for single overdue day", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            overdue: [{ userId: "1", name: "John Doe", dates: ["2026-01-20"] }],
          }),
      });
      render(<OverdueBanner isAdmin={true} />);

      await waitFor(() => {
        expect(screen.getByText(/John Doe \(1 day\)/)).toBeInTheDocument();
      });
    });

    it("uses plural 'days' for multiple overdue days", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            overdue: [
              {
                userId: "1",
                name: "John Doe",
                dates: ["2026-01-20", "2026-01-21", "2026-01-22"],
              },
            ],
          }),
      });
      render(<OverdueBanner isAdmin={true} />);

      await waitFor(() => {
        expect(screen.getByText(/John Doe \(3 days\)/)).toBeInTheDocument();
      });
    });

    it("team summary banner does not render as a link", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            overdue: [{ userId: "1", name: "John Doe", dates: ["2026-01-20"] }],
          }),
      });
      render(<OverdueBanner isAdmin={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Overdue timesheets:/)).toBeInTheDocument();
      });

      // Team summary is not a link (no userName matching, so no personal link either)
      expect(screen.queryByTestId("overdue-link")).not.toBeInTheDocument();
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
        // Should show personal banner with link
        expect(screen.getByText(/You have overdue timesheets for:/)).toBeInTheDocument();
        // Should show team summary
        expect(screen.getByText(/Overdue timesheets:/)).toBeInTheDocument();
      });

      // Personal banner is a link
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
        expect(screen.getByText(/Overdue timesheets:/)).toBeInTheDocument();
      });

      // Should NOT show personal banner
      expect(screen.queryByText(/You have overdue timesheets for:/)).not.toBeInTheDocument();
      // No link (team banner is not a link)
      expect(screen.queryByTestId("overdue-link")).not.toBeInTheDocument();
    });

    it("formats admin personal overdue dates correctly", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            overdue: [
              { userId: "1", name: "Admin User", dates: ["2026-01-20"] },
            ],
          }),
      });
      render(<OverdueBanner isAdmin={true} userName="Admin User" />);

      await waitFor(() => {
        const personalBanner = screen.getByText(/You have overdue timesheets for:/);
        // Should format as "Tue 20 Jan" (Jan 20, 2026 is a Tuesday)
        expect(personalBanner.textContent).toContain("Tue");
        expect(personalBanner.textContent).toContain("20");
        expect(personalBanner.textContent).toContain("Jan");
      });
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
    it("uses danger background and border styling for user view", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ overdue: ["2026-01-20"] }),
      });
      render(<OverdueBanner isAdmin={false} />);

      await waitFor(() => {
        const link = screen.getByTestId("overdue-link");
        expect(link.className).toContain("bg-[var(--danger-bg)]");
        expect(link.className).toContain("border-[var(--danger)]");
      });
    });

    it("uses danger background and border styling for admin view", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            overdue: [{ userId: "1", name: "John Doe", dates: ["2026-01-20"] }],
          }),
      });
      const { container } = render(<OverdueBanner isAdmin={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Overdue timesheets:/)).toBeInTheDocument();
      });

      const banner = container.firstChild as HTMLElement;
      expect(banner.className).toContain("bg-[var(--danger-bg)]");
      expect(banner.className).toContain("border-[var(--danger)]");
    });
  });
});
