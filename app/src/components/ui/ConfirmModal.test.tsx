import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmModal } from "./ConfirmModal";

describe("ConfirmModal", () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  const defaultProps = {
    title: "Delete Entry",
    message: "Are you sure you want to delete this entry?",
    onConfirm: mockOnConfirm,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders with title and message", () => {
      render(<ConfirmModal {...defaultProps} />);

      expect(screen.getByText("Delete Entry")).toBeInTheDocument();
      expect(
        screen.getByText("Are you sure you want to delete this entry?")
      ).toBeInTheDocument();
    });

    it("renders with default button labels", () => {
      render(<ConfirmModal {...defaultProps} />);

      expect(
        screen.getByRole("button", { name: "Confirm" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Cancel" })
      ).toBeInTheDocument();
    });

    it("renders with custom confirm label", () => {
      render(<ConfirmModal {...defaultProps} confirmLabel="Delete" />);

      expect(
        screen.getByRole("button", { name: "Delete" })
      ).toBeInTheDocument();
    });

    it("renders with custom cancel label", () => {
      render(<ConfirmModal {...defaultProps} cancelLabel="Go Back" />);

      expect(
        screen.getByRole("button", { name: "Go Back" })
      ).toBeInTheDocument();
    });

    it("displays custom confirm and cancel text together", () => {
      render(
        <ConfirmModal
          {...defaultProps}
          confirmLabel="Yes, Remove"
          cancelLabel="No, Keep"
        />
      );

      expect(
        screen.getByRole("button", { name: "Yes, Remove" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "No, Keep" })
      ).toBeInTheDocument();
    });
  });

  describe("Callbacks", () => {
    it("calls onConfirm when confirm button is clicked", () => {
      render(<ConfirmModal {...defaultProps} />);

      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnCancel).not.toHaveBeenCalled();
    });

    it("calls onCancel when cancel button is clicked", () => {
      render(<ConfirmModal {...defaultProps} />);

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it("calls onCancel when backdrop is clicked", () => {
      render(<ConfirmModal {...defaultProps} />);

      // The backdrop is the first div with the bg-black class
      const backdrop = document.querySelector(".bg-black\\/60");
      expect(backdrop).toBeTruthy();

      fireEvent.click(backdrop as HTMLElement);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it("calls onCancel when Escape key is pressed", () => {
      render(<ConfirmModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnConfirm).not.toHaveBeenCalled();
    });

    it("calls onConfirm when Enter key is pressed", () => {
      render(<ConfirmModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: "Enter" });

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
      expect(mockOnCancel).not.toHaveBeenCalled();
    });
  });

  describe("Destructive Mode", () => {
    it("applies destructive styling when isDestructive is true", () => {
      render(<ConfirmModal {...defaultProps} isDestructive confirmLabel="Delete" />);

      const confirmButton = screen.getByRole("button", { name: "Delete" });
      expect(confirmButton).toHaveClass("bg-[var(--danger)]");
    });

    it("applies default styling when isDestructive is false", () => {
      render(<ConfirmModal {...defaultProps} isDestructive={false} />);

      const confirmButton = screen.getByRole("button", { name: "Confirm" });
      expect(confirmButton).toHaveClass("bg-[var(--accent-pink)]");
    });
  });

  describe("Cleanup", () => {
    it("removes escape key listener on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");

      const { unmount } = render(<ConfirmModal {...defaultProps} />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });
  });
});
