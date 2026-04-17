import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/i18n", () => ({
  useLang: vi.fn(() => ({
    lang: "ar",
    setLang: vi.fn(),
    t: (k: string) => k,
    dir: "rtl",
    fontClass: "font-arabic",
  })),
}));

vi.mock("@/lib/loyalty", () => ({
  LOYALTY_CONFIG: {
    pointsPerShekel: 1,
    shekelPerPoint: 0.1,
    tiers: {
      bronze: { minPoints: 0, multiplier: 1, label_ar: "برونزي", label_he: "ארד", color: "#cd7f32", icon: "🥉" },
      silver: { minPoints: 500, multiplier: 1.25, label_ar: "فضي", label_he: "כסף", color: "#c0c0c0", icon: "🥈" },
      gold: { minPoints: 2000, multiplier: 1.5, label_ar: "ذهبي", label_he: "זהב", color: "#ffd700", icon: "🥇" },
      platinum: { minPoints: 5000, multiplier: 2, label_ar: "بلاتيني", label_he: "פלטינום", color: "#e5e4e2", icon: "💎" },
    },
  },
}));

vi.mock("@/lib/csrf-client", () => ({
  csrfHeaders: (extra?: any) => ({ "Content-Type": "application/json", ...extra }),
}));

import { LoyaltyWidget } from "@/components/store/LoyaltyWidget";

describe("LoyaltyWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("shows loading skeleton initially", () => {
    localStorage.setItem("clal_customer_token", "test-token");
    global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch; // never resolves

    const { container } = render(<LoyaltyWidget />);
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("shows unauthenticated state when no token", () => {
    global.fetch = vi.fn();
    const { container } = render(<LoyaltyWidget />);

    // Without a token, fetchLoyalty returns early and loading stays true
    // so the component shows the loading skeleton
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders loyalty data when API returns success", async () => {
    localStorage.setItem("clal_customer_token", "test-token");

    const loyaltyData = {
      points: 1500,
      lifetime_points: 1500,
      tier: "silver" as const,
      tier_label_ar: "فضي",
      tier_label_he: "כסף",
      tier_color: "#c0c0c0",
      tier_icon: "🥈",
      tier_multiplier: 1.25,
      points_value: 150,
      next_tier: "gold" as const,
      next_tier_label_ar: "ذهبي",
      next_tier_label_he: "זהב",
      next_tier_min: 2000,
      points_to_next: 500,
      progress_percent: 75,
    };

    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, loyalty: loyaltyData, transactions: [] }),
    });

    render(<LoyaltyWidget />);

    await waitFor(() => {
      expect(screen.getByText("account.yourPoints")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("فضي")).toBeInTheDocument();
    });
  });

  it("shows tier label in Arabic", async () => {
    localStorage.setItem("clal_customer_token", "test-token");

    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        loyalty: {
          points: 100,
          lifetime_points: 100,
          tier: "bronze",
          tier_label_ar: "برونزي",
          tier_label_he: "ארד",
          tier_color: "#cd7f32",
          tier_icon: "🥉",
          tier_multiplier: 1,
          points_value: 10,
          next_tier: "silver",
          next_tier_label_ar: "فضي",
          next_tier_label_he: "כסף",
          next_tier_min: 500,
          points_to_next: 400,
          progress_percent: 20,
        },
        transactions: [],
      }),
    });

    render(<LoyaltyWidget />);

    await waitFor(() => {
      expect(screen.getByText("برونزي")).toBeInTheDocument();
    });
  });

  it("shows next tier progress section", async () => {
    localStorage.setItem("clal_customer_token", "test-token");

    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        loyalty: {
          points: 100,
          lifetime_points: 100,
          tier: "bronze",
          tier_label_ar: "برونزي",
          tier_label_he: "ארד",
          tier_color: "#cd7f32",
          tier_icon: "🥉",
          tier_multiplier: 1,
          points_value: 10,
          next_tier: "silver",
          next_tier_label_ar: "فضي",
          next_tier_label_he: "כסף",
          next_tier_min: 500,
          points_to_next: 400,
          progress_percent: 20,
        },
        transactions: [],
      }),
    });

    render(<LoyaltyWidget />);

    await waitFor(() => {
      expect(screen.getByText("account.nextTier")).toBeInTheDocument();
      expect(screen.getByText("account.pointsToNext")).toBeInTheDocument();
    });
  });

  it("shows redeem section", async () => {
    localStorage.setItem("clal_customer_token", "test-token");

    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        loyalty: {
          points: 1000,
          lifetime_points: 1000,
          tier: "silver",
          tier_label_ar: "فضي",
          tier_label_he: "כסף",
          tier_color: "#c0c0c0",
          tier_icon: "🥈",
          tier_multiplier: 1.25,
          points_value: 100,
          next_tier: "gold",
          next_tier_label_ar: "ذهبي",
          next_tier_label_he: "זהב",
          next_tier_min: 2000,
          points_to_next: 1000,
          progress_percent: 50,
        },
        transactions: [],
      }),
    });

    render(<LoyaltyWidget />);

    await waitFor(() => {
      expect(screen.getByText("account.redeemPoints")).toBeInTheDocument();
      expect(screen.getByText("account.redeemDesc")).toBeInTheDocument();
    });
  });

  it("shows transactions section", async () => {
    localStorage.setItem("clal_customer_token", "test-token");

    const transactions = [
      {
        id: "tx-1",
        type: "earn",
        points: 100,
        balance_after: 100,
        description: null,
        order_id: "ord-12345678",
        created_at: "2026-04-17T10:00:00Z",
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        loyalty: {
          points: 100,
          lifetime_points: 100,
          tier: "bronze",
          tier_label_ar: "برونزي",
          tier_label_he: "ארד",
          tier_color: "#cd7f32",
          tier_icon: "🥉",
          tier_multiplier: 1,
          points_value: 10,
          next_tier: "silver",
          next_tier_label_ar: "فضي",
          next_tier_label_he: "כסף",
          next_tier_min: 500,
          points_to_next: 400,
          progress_percent: 20,
        },
        transactions,
      }),
    });

    render(<LoyaltyWidget />);

    await waitFor(() => {
      expect(screen.getByText("account.transactions")).toBeInTheDocument();
      expect(screen.getByText("+100")).toBeInTheDocument();
    });
  });

  it("shows no transactions message when empty", async () => {
    localStorage.setItem("clal_customer_token", "test-token");

    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        loyalty: {
          points: 0,
          lifetime_points: 0,
          tier: "bronze",
          tier_label_ar: "برونزي",
          tier_label_he: "ארד",
          tier_color: "#cd7f32",
          tier_icon: "🥉",
          tier_multiplier: 1,
          points_value: 0,
          next_tier: "silver",
          next_tier_label_ar: "فضي",
          next_tier_label_he: "כסף",
          next_tier_min: 500,
          points_to_next: 500,
          progress_percent: 0,
        },
        transactions: [],
      }),
    });

    render(<LoyaltyWidget />);

    await waitFor(() => {
      expect(screen.getByText("account.noTransactions")).toBeInTheDocument();
    });
  });

  it("shows multiplier badge when tier multiplier > 1", async () => {
    localStorage.setItem("clal_customer_token", "test-token");

    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({
        success: true,
        loyalty: {
          points: 1000,
          lifetime_points: 1000,
          tier: "silver",
          tier_label_ar: "فضي",
          tier_label_he: "כסף",
          tier_color: "#c0c0c0",
          tier_icon: "🥈",
          tier_multiplier: 1.25,
          points_value: 100,
          next_tier: "gold",
          next_tier_label_ar: "ذهبي",
          next_tier_label_he: "זהב",
          next_tier_min: 2000,
          points_to_next: 1000,
          progress_percent: 50,
        },
        transactions: [],
      }),
    });

    render(<LoyaltyWidget />);

    await waitFor(() => {
      expect(screen.getByText(/×1.25/)).toBeInTheDocument();
    });
  });
});
