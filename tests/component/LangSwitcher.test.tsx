import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const mockSetLang = vi.fn();
let mockLang = "ar";

vi.mock("@/lib/i18n", () => ({
  useLang: vi.fn(() => ({
    lang: mockLang,
    setLang: mockSetLang,
    t: (k: string) => k,
    dir: mockLang === "ar" ? "rtl" : "rtl",
    fontClass: "font-arabic",
  })),
}));

import { LangSwitcher } from "@/components/shared/LangSwitcher";

describe("LangSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLang = "ar";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders without crashing", () => {
    render(<LangSwitcher />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("shows both language labels", () => {
    render(<LangSwitcher />);
    expect(screen.getByText("ع")).toBeInTheDocument();
    expect(screen.getByText("עב")).toBeInTheDocument();
  });

  it("has correct title when lang is ar", () => {
    mockLang = "ar";
    render(<LangSwitcher />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("title", "עברית");
  });

  it("has correct title when lang is he", () => {
    mockLang = "he";
    render(<LangSwitcher />);
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("title", "العربية");
  });

  it("toggles language from ar to he on click", () => {
    mockLang = "ar";
    render(<LangSwitcher />);
    fireEvent.click(screen.getByRole("button"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(mockSetLang).toHaveBeenCalledWith("he");
  });

  it("toggles language from he to ar on click", () => {
    mockLang = "he";
    render(<LangSwitcher />);
    fireEvent.click(screen.getByRole("button"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(mockSetLang).toHaveBeenCalledWith("ar");
  });

  it("renders at smaller size when size=sm", () => {
    render(<LangSwitcher size="sm" />);
    const button = screen.getByRole("button");
    expect(button.style.width).toBe("56px");
    expect(button.style.height).toBe("28px");
  });

  it("renders at default size when size=md", () => {
    render(<LangSwitcher size="md" />);
    const button = screen.getByRole("button");
    expect(button.style.width).toBe("68px");
    expect(button.style.height).toBe("34px");
  });
});
