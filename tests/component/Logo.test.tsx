import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/i18n", () => ({
  useLang: vi.fn(() => ({
    lang: "ar",
    setLang: vi.fn(),
    t: (k: string) => k,
    dir: "rtl",
    fontClass: "font-arabic",
  })),
}));

import { Logo } from "@/components/shared/Logo";

describe("Logo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Mock fetch to return no logo
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ settings: {} }),
    });
  });

  it("renders without crashing", () => {
    const { container } = render(<Logo />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("shows fallback 'C' when no logo URL is available", async () => {
    render(<Logo />);
    await waitFor(() => {
      expect(screen.getByText("C")).toBeInTheDocument();
    });
  });

  it("renders with custom size", () => {
    render(<Logo size={48} />);
    const fallback = screen.getByText("C") as HTMLElement;
    expect(fallback.style.width).toBe("48px");
    expect(fallback.style.height).toBe("48px");
  });

  it("does not show text by default", () => {
    render(<Logo />);
    expect(screen.queryByText("Clal")).not.toBeInTheDocument();
  });

  it("shows brand text when showText is true", async () => {
    render(<Logo showText />);
    await waitFor(() => {
      expect(screen.getByText("Clal")).toBeInTheDocument();
      expect(screen.getByText("Mobile")).toBeInTheDocument();
    });
  });

  it("shows custom label when provided", async () => {
    render(<Logo showText label="ClalCRM" />);
    await waitFor(() => {
      expect(screen.getByText("Clal")).toBeInTheDocument();
      expect(screen.getByText("CRM")).toBeInTheDocument();
    });
  });

  it("shows subtitle when provided", async () => {
    render(<Logo showText subtitle="Admin Panel" />);
    await waitFor(() => {
      expect(screen.getByText("Admin Panel")).toBeInTheDocument();
    });
  });

  it("renders logo image when API returns a URL", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ settings: { logo_url: "https://example.com/logo.png", logo_size: "40" } }),
    });

    render(<Logo />);
    await waitFor(() => {
      const img = screen.getByAltText("Logo");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://example.com/logo.png");
    });
  });

  it("falls back to 'C' when logo image fails to load", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ settings: { logo_url: "https://example.com/bad.png" } }),
    });

    render(<Logo />);
    await waitFor(() => {
      const img = screen.getByAltText("Logo");
      expect(img).toBeInTheDocument();
    });

    // Simulate image error
    const img = screen.getByAltText("Logo");
    img.dispatchEvent(new Event("error"));

    await waitFor(() => {
      expect(screen.getByText("C")).toBeInTheDocument();
    });
  });

  it("uses cached logo from localStorage", () => {
    const cached = { url: "https://example.com/cached.png", size: 44, ts: Date.now() };
    localStorage.setItem("clal_logo", JSON.stringify(cached));

    render(<Logo />);
    const img = screen.getByAltText("Logo");
    expect(img).toHaveAttribute("src", "https://example.com/cached.png");
  });

  it("accepts className prop", () => {
    const { container } = render(<Logo className="my-custom-class" />);
    expect(container.firstChild).toHaveClass("my-custom-class");
  });
});
