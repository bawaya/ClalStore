import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock("@/lib/i18n", () => ({
  useLang: vi.fn(() => ({
    lang: "ar",
    setLang: vi.fn(),
    t: (k: string) => k,
    dir: "rtl",
    fontClass: "font-arabic",
  })),
}));

const mockUseScreen = vi.fn(() => ({ mobile: false, tablet: false, desktop: true, width: 1024 }));
vi.mock("@/lib/hooks", () => ({
  useScreen: () => mockUseScreen(),
}));

import { CookieConsent } from "@/components/shared/CookieConsent";

describe("CookieConsent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing initially (before timeout)", () => {
    const { container } = render(<CookieConsent />);
    expect(container.firstChild).toBeNull();
  });

  it("renders banner after delay when no consent in localStorage", () => {
    render(<CookieConsent />);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.getByText("cookie.text")).toBeInTheDocument();
    expect(screen.getByText("cookie.accept")).toBeInTheDocument();
    expect(screen.getByText("cookie.link")).toBeInTheDocument();
  });

  it("does not render when consent is already stored", () => {
    localStorage.setItem("clal_cookie_consent", "accepted");
    render(<CookieConsent />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText("cookie.text")).not.toBeInTheDocument();
  });

  it("hides banner and stores consent when accept is clicked", () => {
    render(<CookieConsent />);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    const acceptBtn = screen.getByText("cookie.accept");
    fireEvent.click(acceptBtn);
    expect(screen.queryByText("cookie.text")).not.toBeInTheDocument();
    expect(localStorage.getItem("clal_cookie_consent")).toBe("accepted");
  });

  it("has a privacy link pointing to /privacy", () => {
    render(<CookieConsent />);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    const link = screen.getByText("cookie.link");
    expect(link).toHaveAttribute("href", "/privacy");
  });

  it("renders mobile view with smaller font", () => {
    mockUseScreen.mockReturnValue({ mobile: true, tablet: false, desktop: false, width: 375 });
    render(<CookieConsent />);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    const banner = screen.getByText("cookie.text").closest("div[dir='rtl']") as HTMLElement | null;
    expect(banner).toBeInTheDocument();
    expect(banner?.style.padding).toContain("12px");
  });

  it("renders desktop view with larger padding", () => {
    mockUseScreen.mockReturnValue({ mobile: false, tablet: false, desktop: true, width: 1024 });
    render(<CookieConsent />);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    const banner = screen.getByText("cookie.text").closest("div[dir='rtl']") as HTMLElement | null;
    expect(banner?.style.padding).toContain("16px");
  });
});
