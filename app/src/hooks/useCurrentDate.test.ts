import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCurrentDate } from "./useCurrentDate";

describe("useCurrentDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current date on initial render", () => {
    const now = new Date("2025-01-15T10:00:00");
    vi.setSystemTime(now);

    const { result } = renderHook(() => useCurrentDate());

    expect(result.current.getFullYear()).toBe(2025);
    expect(result.current.getMonth()).toBe(0); // January
    expect(result.current.getDate()).toBe(15);
  });

  it("updates when date changes at midnight", () => {
    // Start at 11:59 PM on Jan 15
    const beforeMidnight = new Date("2025-01-15T23:59:00");
    vi.setSystemTime(beforeMidnight);

    const { result } = renderHook(() => useCurrentDate());

    // Initial date is Jan 15
    expect(result.current.getDate()).toBe(15);

    // Advance to 12:01 AM on Jan 16
    const afterMidnight = new Date("2025-01-16T00:01:00");
    vi.setSystemTime(afterMidnight);

    // Advance timers by 60 seconds to trigger the interval
    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    // Date should now be Jan 16
    expect(result.current.getDate()).toBe(16);
  });

  it("does not update if date has not changed", () => {
    const morning = new Date("2025-01-15T09:00:00");
    vi.setSystemTime(morning);

    const { result } = renderHook(() => useCurrentDate());
    const initialDate = result.current;

    // Advance to afternoon (same day)
    const afternoon = new Date("2025-01-15T15:00:00");
    vi.setSystemTime(afternoon);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    // Should be the same Date object (referential equality)
    expect(result.current).toBe(initialDate);
  });

  it("cleans up interval on unmount", () => {
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");

    const { unmount } = renderHook(() => useCurrentDate());
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
