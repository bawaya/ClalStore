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

import { PRIVACY_VERSION } from "@/lib/consent";
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
    expect(screen.getByText("cookie.body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cookie\.acceptAll/ })).toBeInTheDocument();
    expect(screen.getByText("cookie.policyLink")).toBeInTheDocument();
  });

  it("does not render when consent is already stored", () => {
    localStorage.setItem(
      "clal_consent_v2",
      JSON.stringify({
        essential: true,
        functional: true,
        analytics: true,
        advertising: false,
        version: PRIVACY_VERSION,
        updated_at: new Date().toISOString(),
      }),
    );
    render(<CookieConsent />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText("cookie.body")).not.toBeInTheDocument();
  });

  it("hides banner and stores consent when accept is clicked", () => {
    render(<CookieConsent />);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    const acceptBtn = screen.getByRole("button", { name: /cookie\.acceptAll/ });
    fireEvent.click(acceptBtn);
    expect(screen.queryByText("cookie.body")).not.toBeInTheDocument();
    const raw = localStorage.getItem("clal_consent_v2");
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw!);
    expect(stored.version).toBe(PRIVACY_VERSION);
    expect(stored.analytics).toBe(true);
  });

  it("has a privacy link pointing to /privacy", () => {
    render(<CookieConsent />);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    const link = screen.getByText("cookie.policyLink");
    expect(link).toHaveAttribute("href", "/privacy");
  });

  it("renders mobile view with smaller font", () => {
    mockUseScreen.mockReturnValue({ mobile: true, tablet: false, desktop: false, width: 375 });
    render(<CookieConsent />);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog.style.padding).toMatch(/14px/);
  });

  it("renders desktop view with larger padding", () => {
    mockUseScreen.mockReturnValue({ mobile: false, tablet: false, desktop: true, width: 1024 });
    render(<CookieConsent />);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    const dialog = screen.getByRole("dialog");
    expect(dialog.style.padding).toMatch(/20px/);
  });
});
