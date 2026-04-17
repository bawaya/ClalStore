import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToastContainer } from "@/components/ui/Toast";
import type { Toast } from "@/lib/hooks";

describe("ToastContainer", () => {
  it("renders nothing when toasts array is empty", () => {
    const { container } = render(<ToastContainer toasts={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders a single toast with correct message", () => {
    const toasts: Toast[] = [
      { id: "1", message: "Item added", type: "success" },
    ];
    render(<ToastContainer toasts={toasts} />);
    expect(screen.getByText("Item added")).toBeInTheDocument();
  });

  it("renders multiple toasts", () => {
    const toasts: Toast[] = [
      { id: "1", message: "Success toast", type: "success" },
      { id: "2", message: "Error toast", type: "error" },
      { id: "3", message: "Warning toast", type: "warning" },
    ];
    render(<ToastContainer toasts={toasts} />);
    expect(screen.getByText("Success toast")).toBeInTheDocument();
    expect(screen.getByText("Error toast")).toBeInTheDocument();
    expect(screen.getByText("Warning toast")).toBeInTheDocument();
  });

  it("has role=status and aria-live=polite for accessibility", () => {
    const toasts: Toast[] = [
      { id: "1", message: "Accessible toast", type: "info" },
    ];
    render(<ToastContainer toasts={toasts} />);
    const container = screen.getByRole("status");
    expect(container).toHaveAttribute("aria-live", "polite");
  });

  it("applies correct style classes for each toast type", () => {
    const toasts: Toast[] = [
      { id: "1", message: "success-msg", type: "success" },
      { id: "2", message: "error-msg", type: "error" },
      { id: "3", message: "warning-msg", type: "warning" },
      { id: "4", message: "info-msg", type: "info" },
    ];
    render(<ToastContainer toasts={toasts} />);

    expect(screen.getByText("success-msg").className).toContain("text-state-success");
    expect(screen.getByText("error-msg").className).toContain("text-state-error");
    expect(screen.getByText("warning-msg").className).toContain("text-state-warning");
    expect(screen.getByText("info-msg").className).toContain("text-state-info");
  });

  it("renders each toast with a unique key (no duplicate warnings)", () => {
    const toasts: Toast[] = [
      { id: "a", message: "First", type: "success" },
      { id: "b", message: "Second", type: "error" },
    ];
    const { container } = render(<ToastContainer toasts={toasts} />);
    const toastElements = container.querySelectorAll("[class*='animate-slide-up']");
    expect(toastElements.length).toBe(2);
  });
});
