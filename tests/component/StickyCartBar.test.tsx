import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

const mockUseScreen = vi.fn(() => ({ mobile: false, tablet: false, desktop: true, width: 1024 }));
vi.mock("@/lib/hooks", () => ({
  useScreen: () => mockUseScreen(),
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

let mockItemCount = 0;
let mockTotal = 0;

vi.mock("@/lib/store/cart", () => ({
  useCart: (selector: any) => {
    const state = {
      getItemCount: () => mockItemCount,
      getTotal: () => mockTotal,
    };
    return selector(state);
  },
}));

import { StickyCartBar } from "@/components/store/StickyCartBar";

describe("StickyCartBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItemCount = 0;
    mockTotal = 0;
    mockUseScreen.mockReturnValue({ mobile: false, tablet: false, desktop: true, width: 1024 });
  });

  it("renders nothing when cart is empty", () => {
    const { container } = render(<StickyCartBar />);
    expect(container.firstChild).toBeNull();
  });

  it("renders when cart has items", () => {
    mockItemCount = 2;
    mockTotal = 7000;
    render(<StickyCartBar />);
    expect(screen.getByText("store.cart")).toBeInTheDocument();
  });

  it("displays correct item count", () => {
    mockItemCount = 3;
    mockTotal = 10000;
    render(<StickyCartBar />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/3 cartBar.items/)).toBeInTheDocument();
  });

  it("shows singular item text for 1 item", () => {
    mockItemCount = 1;
    mockTotal = 3500;
    render(<StickyCartBar />);
    expect(screen.getByText(/1 cartBar.item\b/)).toBeInTheDocument();
  });

  it("displays total price", () => {
    mockItemCount = 2;
    mockTotal = 7500;
    render(<StickyCartBar />);
    expect(screen.getByText(/7,500/)).toBeInTheDocument();
  });

  it("has checkout link pointing to /store/cart", () => {
    mockItemCount = 1;
    mockTotal = 3500;
    render(<StickyCartBar />);
    const link = screen.getByText("store.checkout").closest("a");
    expect(link).toHaveAttribute("href", "/store/cart");
  });

  it("renders in mobile view", () => {
    mockUseScreen.mockReturnValue({ mobile: true, tablet: false, desktop: false, width: 375 });
    mockItemCount = 1;
    mockTotal = 3500;
    render(<StickyCartBar />);
    expect(screen.getByText("store.cart")).toBeInTheDocument();
    expect(screen.getByText("store.checkout")).toBeInTheDocument();
  });

  it("renders in desktop view", () => {
    mockUseScreen.mockReturnValue({ mobile: false, tablet: false, desktop: true, width: 1200 });
    mockItemCount = 2;
    mockTotal = 8000;
    render(<StickyCartBar />);
    expect(screen.getByText("store.cart")).toBeInTheDocument();
    expect(screen.getByText(/8,000/)).toBeInTheDocument();
  });
});
