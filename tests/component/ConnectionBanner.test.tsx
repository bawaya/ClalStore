/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ConnectionBanner — shows a yellow/amber sticky banner when navigator
 * reports offline. Subscribes to the Zustand `useOfflineStore` for the
 * `online` + `pendingDocs` + `setOnline` selectors.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ─── Mock the Zustand store ──────────────────────────────────────────────
type StoreShape = {
  online: boolean;
  pendingDocs: Array<{ id: string }>;
  setOnline: (v: boolean) => void;
};

const storeState: StoreShape = {
  online: true,
  pendingDocs: [],
  setOnline: vi.fn((v: boolean) => {
    storeState.online = v;
  }),
};

vi.mock("@/stores/offline-store", () => ({
  useOfflineStore: vi.fn((selector: (s: StoreShape) => unknown) =>
    selector(storeState),
  ),
}));

import { ConnectionBanner } from "@/components/pwa/ConnectionBanner";

describe("ConnectionBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.online = true;
    storeState.pendingDocs = [];
    storeState.setOnline = vi.fn((v: boolean) => {
      storeState.online = v;
    });
    // Make navigator.onLine match so the initial-sync effect doesn't flip us.
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  it("renders nothing when online", () => {
    storeState.online = true;
    const { container } = render(<ConnectionBanner />);
    // Component returns `null`, so the container has no children
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("renders the banner when offline", () => {
    storeState.online = false;
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    const { container } = render(<ConnectionBanner />);
    expect(container.firstChild).not.toBeNull();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("banner text includes the Arabic offline message", () => {
    storeState.online = false;
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    render(<ConnectionBanner />);
    expect(
      screen.getByText(/أنت أوفلاين/),
    ).toBeInTheDocument();
  });

  it("uses an amber/yellow theme class", () => {
    storeState.online = false;
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    render(<ConnectionBanner />);
    const banner = screen.getByRole("status");
    // Component uses `bg-amber-500/15` (Tailwind amber ~= yellow family)
    expect(banner.className).toMatch(/bg-amber-/);
    expect(banner.className).toMatch(/text-amber-/);
  });

  it("is positioned as a sticky overlay", () => {
    storeState.online = false;
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    render(<ConnectionBanner />);
    const banner = screen.getByRole("status");
    expect(banner.className).toMatch(/sticky/);
    expect(banner.className).toMatch(/top-0/);
  });

  it("is announced to assistive tech (role=status + aria-live=polite)", () => {
    storeState.online = false;
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    render(<ConnectionBanner />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("aria-live", "polite");
  });
});
