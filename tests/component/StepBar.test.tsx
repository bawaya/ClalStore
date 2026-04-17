import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockUseScreen = vi.fn(() => ({ mobile: false, tablet: false, desktop: true, width: 1024 }));
vi.mock("@/lib/hooks", () => ({
  useScreen: () => mockUseScreen(),
}));

import { StepBar } from "@/components/store/cart/StepBar";

describe("StepBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseScreen.mockReturnValue({ mobile: false, tablet: false, desktop: true, width: 1024 });
  });

  it("renders without crashing", () => {
    render(<StepBar current={0} />);
    expect(screen.getByText(/السلة/)).toBeInTheDocument();
  });

  it("displays all 4 steps", () => {
    render(<StepBar current={0} />);
    expect(screen.getByText(/السلة/)).toBeInTheDocument();
    expect(screen.getByText(/المعلومات/)).toBeInTheDocument();
    expect(screen.getByText(/الدفع/)).toBeInTheDocument();
    expect(screen.getByText(/تأكيد/)).toBeInTheDocument();
  });

  it("highlights steps up to current step", () => {
    const { container } = render(<StepBar current={1} />);
    const bars = container.querySelectorAll<HTMLElement>(".h-1");
    // First two bars (indices 0 and 1) should have brand gradient
    expect(bars[0].style.background).toContain("linear-gradient");
    expect(bars[1].style.background).toContain("linear-gradient");
    // Third and fourth should be dimmed (browser may normalize rgba with spaces)
    expect(bars[2].style.background.replace(/\s/g, "")).toBe("rgba(255,255,255,0.06)");
    expect(bars[3].style.background.replace(/\s/g, "")).toBe("rgba(255,255,255,0.06)");
  });

  it("highlights only the first step when current is 0", () => {
    const { container } = render(<StepBar current={0} />);
    const bars = container.querySelectorAll<HTMLElement>(".h-1");
    expect(bars[0].style.background).toContain("linear-gradient");
    expect(bars[1].style.background.replace(/\s/g, "")).toBe("rgba(255,255,255,0.06)");
  });

  it("highlights all steps when current is 3 (last step)", () => {
    const { container } = render(<StepBar current={3} />);
    const bars = container.querySelectorAll(".h-1");
    for (const bar of bars) {
      expect((bar as HTMLElement).style.background).toContain("linear-gradient");
    }
  });

  it("renders in mobile view with smaller font", () => {
    mockUseScreen.mockReturnValue({ mobile: true, tablet: false, desktop: false, width: 375 });
    render(<StepBar current={0} />);
    expect(screen.getByText(/السلة/)).toBeInTheDocument();
  });

  it("bolds the current step label", () => {
    render(<StepBar current={2} />);
    const paymentStep = screen.getByText(/الدفع/);
    expect(paymentStep.style.fontWeight).toBe("700");
  });

  it("does not bold non-current steps", () => {
    render(<StepBar current={0} />);
    const paymentStep = screen.getByText(/الدفع/);
    expect(paymentStep.style.fontWeight).toBe("400");
  });
});
