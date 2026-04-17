import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/store"),
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
vi.mock("@/lib/store/queries", () => ({
  getProducts: vi.fn(() => Promise.resolve([
    { id: "1", name_ar: "Test Phone", brand: "Samsung", price: 1999, stock: 10, type: "device", active: true },
  ])),
  getHeroes: vi.fn(() => Promise.resolve([])),
  getLinePlans: vi.fn(() => Promise.resolve([])),
}));
vi.mock("@/lib/seo", () => ({
  getStoreMetadata: vi.fn(() => Promise.resolve({ title: "Store" })),
  getProductMetadata: vi.fn(),
}));
vi.mock("@/components/store/StoreClient", () => ({
  StoreClient: ({ products, heroes, linePlans }: any) => (
    <div data-testid="store-client">
      <span data-testid="product-count">{products.length}</span>
      <span data-testid="hero-count">{heroes.length}</span>
    </div>
  ),
}));

describe("StorePage (Server Component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", async () => {
    const { default: StorePage } = await import("@/app/store/page");
    const jsx = await StorePage();
    const { container } = render(jsx);
    expect(container).toBeTruthy();
  });

  it("passes data to StoreClient", async () => {
    const { default: StorePage } = await import("@/app/store/page");
    const jsx = await StorePage();
    render(jsx);
    expect(screen.getByTestId("store-client")).toBeInTheDocument();
    expect(screen.getByTestId("product-count")).toHaveTextContent("1");
  });
});
