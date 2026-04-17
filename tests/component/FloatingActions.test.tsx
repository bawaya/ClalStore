import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/i18n", () => ({
  useLang: vi.fn(() => ({
    lang: "ar",
    setLang: vi.fn(),
    t: (k: string) => k,
    dir: "rtl",
    fontClass: "font-arabic",
  })),
}));

vi.mock("@/lib/constants", () => ({
  BUSINESS: {
    name: "ClalMobile",
    phone: "053-3337653",
    phoneRaw: "972533337653",
    whatsapp: "https://wa.me/972533337653",
    email: "info@clalmobile.com",
  },
}));

import { FloatingActions } from "@/components/store/FloatingActions";

describe("FloatingActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<FloatingActions />);
    expect(screen.getByLabelText("store2.callNow")).toBeInTheDocument();
    expect(screen.getByLabelText("store2.whatsapp")).toBeInTheDocument();
  });

  it("shows phone call button", () => {
    render(<FloatingActions />);
    const phoneLink = screen.getByLabelText("store2.callNow");
    expect(phoneLink).toBeInTheDocument();
    expect(phoneLink).toHaveAttribute("href", "tel:0533337653");
  });

  it("shows WhatsApp button", () => {
    render(<FloatingActions />);
    const whatsappLink = screen.getByLabelText("store2.whatsapp");
    expect(whatsappLink).toBeInTheDocument();
    expect(whatsappLink).toHaveAttribute("href", "https://wa.me/972533337653");
  });

  it("WhatsApp link opens in new tab", () => {
    render(<FloatingActions />);
    const whatsappLink = screen.getByLabelText("store2.whatsapp");
    expect(whatsappLink).toHaveAttribute("target", "_blank");
    expect(whatsappLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("has correct titles", () => {
    render(<FloatingActions />);
    const phoneLink = screen.getByLabelText("store2.callNow");
    const whatsappLink = screen.getByLabelText("store2.whatsapp");
    expect(phoneLink).toHaveAttribute("title", "store2.callNow");
    expect(whatsappLink).toHaveAttribute("title", "store2.whatsapp");
  });

  it("renders buttons with fixed positioning", () => {
    const { container } = render(<FloatingActions />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("fixed");
    expect(wrapper).toHaveClass("z-50");
  });

  it("renders both icons as links (a tags)", () => {
    const { container } = render(<FloatingActions />);
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(2);
  });
});
