import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useClickOutside } from "./useClickOutside";
import { RefObject } from "react";

describe("useClickOutside", () => {
  let handler: ReturnType<typeof vi.fn>;
  let container: HTMLDivElement;
  let insideElement: HTMLDivElement;
  let outsideElement: HTMLDivElement;

  beforeEach(() => {
    handler = vi.fn();
    // Create DOM elements for testing
    container = document.createElement("div");
    insideElement = document.createElement("div");
    outsideElement = document.createElement("div");

    container.appendChild(insideElement);
    document.body.appendChild(container);
    document.body.appendChild(outsideElement);
  });

  afterEach(() => {
    document.body.removeChild(container);
    document.body.removeChild(outsideElement);
    vi.clearAllMocks();
  });

  it("calls handler when clicking outside the referenced element", () => {
    const ref = { current: insideElement } as RefObject<HTMLDivElement>;

    renderHook(() => useClickOutside(ref, handler));

    // Click outside the referenced element
    outsideElement.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true })
    );

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call handler when clicking inside the referenced element", () => {
    const ref = { current: container } as RefObject<HTMLDivElement>;

    renderHook(() => useClickOutside(ref, handler));

    // Click inside the referenced element (on a child)
    insideElement.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(handler).not.toHaveBeenCalled();

    // Click directly on the referenced element
    container.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not call handler when ref is null", () => {
    const ref = { current: null } as RefObject<HTMLDivElement | null>;

    renderHook(() => useClickOutside(ref, handler));

    // Click anywhere
    outsideElement.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true })
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it("removes event listener on unmount", () => {
    const ref = { current: insideElement } as RefObject<HTMLDivElement>;
    const addEventListenerSpy = vi.spyOn(document, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

    const { unmount } = renderHook(() => useClickOutside(ref, handler));

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "mousedown",
      expect.any(Function)
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "mousedown",
      expect.any(Function)
    );

    // Verify the listener is actually removed by clicking
    outsideElement.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true })
    );

    expect(handler).not.toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it("does not add listener when enabled is false", () => {
    const ref = { current: insideElement } as RefObject<HTMLDivElement>;
    const addEventListenerSpy = vi.spyOn(document, "addEventListener");

    renderHook(() => useClickOutside(ref, handler, false));

    // The mousedown listener should not have been added
    const mousedownCalls = addEventListenerSpy.mock.calls.filter(
      (call) => call[0] === "mousedown"
    );
    expect(mousedownCalls.length).toBe(0);

    // Click outside - handler should not be called
    outsideElement.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true })
    );

    expect(handler).not.toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
  });

  it("adds listener when enabled changes from false to true", () => {
    const ref = { current: insideElement } as RefObject<HTMLDivElement>;

    const { rerender } = renderHook(
      ({ enabled }) => useClickOutside(ref, handler, enabled),
      { initialProps: { enabled: false } }
    );

    // Click outside - handler should not be called (disabled)
    outsideElement.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true })
    );
    expect(handler).not.toHaveBeenCalled();

    // Enable the hook
    rerender({ enabled: true });

    // Now click outside - handler should be called
    outsideElement.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true })
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("removes listener when enabled changes from true to false", () => {
    const ref = { current: insideElement } as RefObject<HTMLDivElement>;

    const { rerender } = renderHook(
      ({ enabled }) => useClickOutside(ref, handler, enabled),
      { initialProps: { enabled: true } }
    );

    // Click outside - handler should be called (enabled)
    outsideElement.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true })
    );
    expect(handler).toHaveBeenCalledTimes(1);

    // Disable the hook
    rerender({ enabled: false });

    // Click outside again - handler should not be called again
    outsideElement.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true })
    );
    expect(handler).toHaveBeenCalledTimes(1); // Still 1, not 2
  });
});
