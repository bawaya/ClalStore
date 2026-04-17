import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/store/cart"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  redirect: vi.fn(),
}));
vi.mock("@/lib/i18n", () => ({
  useLang: vi.fn(() => ({ lang: "ar", setLang: vi.fn(), t: (k: string) => k, dir: "rtl", fontClass: "font-arabic" })),
  LangProvider: ({ children }: any) => children,
}));
vi.mock("next/image", () => ({ default: (props: any) => <img {...props} /> }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock("@/lib/hooks", () => ({
  useScreen: vi.fn(() => ({ mobile: false, tablet: false, desktop: true, width: 1024 })),
  useToast: vi.fn(() => ({ toasts: [], show: vi.fn(), dismiss: vi.fn() })),
}));
vi.mock("@/lib/store/cart", () => ({
  useCart: vi.fn(() => ({
    items: [],
    addItem: vi.fn(),
    removeItem: vi.fn(),
    clearCart: vi.fn(),
    getSubtotal: () => 0,
    getTotal: () => 0,
    hasDevices: () => false,
    hasOnlyAccessories: () => false,
    applyCoupon: vi.fn(),
    couponCode: null,
    discountAmount: 0,
  })),
}));
vi.mock("@/components/store/StoreHeader", () => ({
  StoreHeader: () => <header data-testid="store-header">StoreHeader</header>,
}));
vi.mock("@/components/website/sections", () => ({
  Footer: () => <footer data-testid="footer">Footer</footer>,
}));
vi.mock("@/lib/validators", () => ({
  validatePhone: vi.fn(() => true),
  validateIsraeliID: vi.fn(() => true),
  validateEmail: vi.fn(() => true),
  validateBranch: vi.fn(() => true),
  validateAccount: vi.fn(() => true),
}));
vi.mock("@/lib/constants", () => ({
  BANKS: [],
}));
vi.mock("@/lib/cities", () => ({
  CITY_SEARCH_MIN_LENGTH: 2,
  searchCities: vi.fn(() => []),
}));
vi.mock("@/lib/csrf-client", () => ({
  csrfHeaders: vi.fn(() => ({ "Content-Type": "application/json" })),
}));

import CartPage from "@/app/store/cart/page";

describe("CartPage", () => {
  it("renders without errors", () => {
    const { container } = render(<CartPage />);
    expect(container).toBeTruthy();
  });

  it("renders the store header and footer", () => {
    render(<CartPage />);
    expect(screen.getByTestId("store-header")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("shows empty cart message when no items", () => {
    render(<CartPage />);
    expect(screen.getByText("السلة فاضية")).toBeInTheDocument();
  });

  it("renders the step bar", () => {
    render(<CartPage />);
    // Multiple "السلة" may appear (step bar + heading); check at least one
    expect(screen.getAllByText(/السلة/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/المعلومات/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/الدفع/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/تأكيد/).length).toBeGreaterThan(0);
  });

  it("has RTL direction", () => {
    const { container } = render(<CartPage />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("dir")).toBe("rtl");
  });
});
