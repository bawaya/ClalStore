import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

vi.mock("@/lib/i18n", () => ({
  useLang: vi.fn(() => ({
    lang: "ar",
    setLang: vi.fn(),
    t: (k: string) => k,
    dir: "rtl",
    fontClass: "font-arabic",
  })),
}));

vi.mock("@/lib/csrf-client", () => ({
  csrfHeaders: () => ({ "Content-Type": "application/json" }),
}));

import { PWAInstallPrompt } from "@/components/shared/PWAInstallPrompt";

describe("PWAInstallPrompt", () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    // Mock service worker
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockResolvedValue({ pushManager: { getSubscription: vi.fn().mockResolvedValue(null) } }),
        ready: Promise.resolve({ pushManager: { getSubscription: vi.fn().mockResolvedValue(null) } }),
      },
      writable: true,
      configurable: true,
    });

    // Mock matchMedia
    Object.defineProperty(window, "matchMedia", {
      value: vi.fn().mockReturnValue({ matches: false }),
      writable: true,
      configurable: true,
    });

    // Mock Notification
    Object.defineProperty(window, "Notification", {
      value: { permission: "default", requestPermission: vi.fn().mockResolvedValue("denied") },
      writable: true,
      configurable: true,
    });

    addEventListenerSpy = vi.spyOn(window, "addEventListener");
    removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ publicKey: "test-key" }),
    });
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it("renders nothing initially (no banner shown)", () => {
    const { container } = render(<PWAInstallPrompt />);
    expect(screen.queryByText("pwa.installTitle")).not.toBeInTheDocument();
  });

  it("does not render when already installed (standalone mode)", () => {
    (window.matchMedia as any).mockReturnValue({ matches: true });
    const { container } = render(<PWAInstallPrompt />);
    expect(screen.queryByText("pwa.installTitle")).not.toBeInTheDocument();
  });

  it("does not render when pwa_installed is set in localStorage", () => {
    localStorage.setItem("pwa_installed", "1");
    render(<PWAInstallPrompt />);
    expect(screen.queryByText("pwa.installTitle")).not.toBeInTheDocument();
  });

  it("does not render when pwa_dismissed is set in sessionStorage", () => {
    sessionStorage.setItem("pwa_dismissed", "1");
    render(<PWAInstallPrompt />);
    expect(screen.queryByText("pwa.installTitle")).not.toBeInTheDocument();
  });

  it("shows banner when beforeinstallprompt fires", () => {
    render(<PWAInstallPrompt />);

    // Find and call the beforeinstallprompt handler
    const calls = addEventListenerSpy.mock.calls.filter(
      (call: any) => call[0] === "beforeinstallprompt"
    );
    expect(calls.length).toBeGreaterThan(0);

    const handler = calls[0][1] as EventListener;
    const mockEvent = new Event("beforeinstallprompt");
    Object.assign(mockEvent, { preventDefault: vi.fn() });

    act(() => {
      handler(mockEvent);
    });

    expect(screen.getByText("pwa.installTitle")).toBeInTheDocument();
    expect(screen.getByText("pwa.installDesc")).toBeInTheDocument();
    expect(screen.getByText("pwa.install")).toBeInTheDocument();
  });

  it("hides banner when dismiss is clicked", () => {
    render(<PWAInstallPrompt />);

    const calls = addEventListenerSpy.mock.calls.filter(
      (call: any) => call[0] === "beforeinstallprompt"
    );
    const handler = calls[0][1] as EventListener;
    const mockEvent = new Event("beforeinstallprompt");
    Object.assign(mockEvent, { preventDefault: vi.fn() });

    act(() => {
      handler(mockEvent);
    });

    expect(screen.getByText("pwa.installTitle")).toBeInTheDocument();

    const dismissBtn = screen.getByLabelText("close");
    fireEvent.click(dismissBtn);

    expect(screen.queryByText("pwa.installTitle")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("pwa_dismissed")).toBe("1");
  });

  it("registers service worker on mount", () => {
    render(<PWAInstallPrompt />);
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith("/sw.js");
  });

  it("listens for beforeinstallprompt and appinstalled events", () => {
    render(<PWAInstallPrompt />);
    const eventTypes = addEventListenerSpy.mock.calls.map((c: any) => c[0]);
    expect(eventTypes).toContain("beforeinstallprompt");
    expect(eventTypes).toContain("appinstalled");
  });

  it("shows install button in banner", () => {
    render(<PWAInstallPrompt />);

    const calls = addEventListenerSpy.mock.calls.filter(
      (call: any) => call[0] === "beforeinstallprompt"
    );
    const handler = calls[0][1] as EventListener;
    const mockEvent = new Event("beforeinstallprompt");
    Object.assign(mockEvent, { preventDefault: vi.fn() });

    act(() => {
      handler(mockEvent);
    });

    expect(screen.getByText("pwa.install")).toBeInTheDocument();
  });

  it("shows app icon in banner", () => {
    render(<PWAInstallPrompt />);

    const calls = addEventListenerSpy.mock.calls.filter(
      (call: any) => call[0] === "beforeinstallprompt"
    );
    const handler = calls[0][1] as EventListener;
    const mockEvent = new Event("beforeinstallprompt");
    Object.assign(mockEvent, { preventDefault: vi.fn() });

    act(() => {
      handler(mockEvent);
    });

    // App icon shows "C"
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("shows iOS guide when install clicked on iOS without deferred prompt", async () => {
    // Simulate iOS
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
      writable: true,
      configurable: true,
    });

    vi.useFakeTimers();
    render(<PWAInstallPrompt />);

    act(() => {
      vi.advanceTimersByTime(5100);
    });

    // Banner should show on iOS after timeout
    expect(screen.getByText("pwa.installTitle")).toBeInTheDocument();

    // Click install - should show iOS guide
    fireEvent.click(screen.getByText("pwa.install"));

    expect(screen.getByText("pwa.iosTitle")).toBeInTheDocument();
    expect(screen.getByText("pwa.iosStep1")).toBeInTheDocument();
    expect(screen.getByText("pwa.iosStep2")).toBeInTheDocument();
    expect(screen.getByText("pwa.iosStep3")).toBeInTheDocument();

    vi.useRealTimers();
  });
});
