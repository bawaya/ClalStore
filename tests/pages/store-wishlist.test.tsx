import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/store/wishlist"),
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
}));
vi.mock("@/lib/store/wishlist", () => ({
  useWishlist: vi.fn(() => ({
    items: [],
    removeItem: vi.fn(),
    clearAll: vi.fn(),
  })),
}));
vi.mock("@/lib/store/cart", () => ({
  useCart: vi.fn((selector?: any) => {
    const store = { addItem: vi.fn() };
    return selector ? selector(store) : store;
  }),
}));
vi.mock("@/components/store/StoreHeader", () => ({
  StoreHeader: () => <header data-testid="store-header">StoreHeader</header>,
}));
vi.mock("@/components/store/ProductCard", () => ({
  ProductCard: ({ product }: any) => <div data-testid="product-card">{product.name_ar}</div>,
}));

import WishlistPage from "@/app/store/wishlist/page";

describe("WishlistPage", () => {
  it("renders without errors", () => {
    const { container } = render(<WishlistPage />);
    expect(container).toBeTruthy();
  });

  it("shows empty state when no items", () => {
    render(<WishlistPage />);
    expect(screen.getByText("wishlist.emptyTitle")).toBeInTheDocument();
    expect(screen.getByText("wishlist.emptyDesc")).toBeInTheDocument();
  });

  it("renders a link to the store when empty", () => {
    render(<WishlistPage />);
    expect(screen.getByText("store.goToStore")).toBeInTheDocument();
  });

  it("renders store header", () => {
    render(<WishlistPage />);
    expect(screen.getByTestId("store-header")).toBeInTheDocument();
  });

  it("has RTL direction", () => {
    const { container } = render(<WishlistPage />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("dir")).toBe("rtl");
  });
});
