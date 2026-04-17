import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/store/product/1"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({ id: "1" })),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));
vi.mock("@/lib/i18n", () => ({
  useLang: vi.fn(() => ({ lang: "ar", setLang: vi.fn(), t: (k: string) => k, dir: "rtl", fontClass: "font-arabic" })),
  LangProvider: ({ children }: any) => children,
}));
vi.mock("next/image", () => ({ default: (props: any) => <img {...props} /> }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));

const mockProduct = {
  id: "1",
  name_ar: "Samsung Galaxy S24",
  name_he: "Samsung Galaxy S24",
  brand: "Samsung",
  price: 3499,
  stock: 5,
  type: "device",
  active: true,
  image_url: "/test.jpg",
  description_ar: "هاتف ذكي",
};

vi.mock("@/lib/store/queries", () => ({
  getProduct: vi.fn(() => Promise.resolve(mockProduct)),
  getProducts: vi.fn(() => Promise.resolve([])),
}));
vi.mock("@/lib/seo", () => ({
  getProductMetadata: vi.fn(() => ({ title: "Samsung Galaxy S24" })),
}));
vi.mock("@/components/store/ProductDetail", () => ({
  ProductDetailClient: ({ product, related }: any) => (
    <div data-testid="product-detail">
      <span data-testid="product-name">{product.name_ar}</span>
      <span data-testid="related-count">{related.length}</span>
    </div>
  ),
}));

describe("ProductPage (Server Component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", async () => {
    const { default: ProductPage } = await import("@/app/store/product/[id]/page");
    const jsx = await ProductPage({ params: Promise.resolve({ id: "1" }) });
    const { container } = render(<>{jsx}</>);
    expect(container).toBeTruthy();
  });

  it("passes product data to ProductDetailClient", async () => {
    const { default: ProductPage } = await import("@/app/store/product/[id]/page");
    const jsx = await ProductPage({ params: Promise.resolve({ id: "1" }) });
    render(<>{jsx}</>);
    expect(screen.getByTestId("product-detail")).toBeInTheDocument();
    expect(screen.getByTestId("product-name")).toHaveTextContent("Samsung Galaxy S24");
  });

  it("renders JSON-LD schema script", async () => {
    const { default: ProductPage } = await import("@/app/store/product/[id]/page");
    const jsx = await ProductPage({ params: Promise.resolve({ id: "1" }) });
    const { container } = render(<>{jsx}</>);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).toBeTruthy();
  });

  it("calls notFound when product does not exist", async () => {
    const queries = await import("@/lib/store/queries");
    vi.mocked(queries.getProduct).mockResolvedValueOnce(null as any);
    const nav = await import("next/navigation");

    const { default: ProductPage } = await import("@/app/store/product/[id]/page");
    try {
      await ProductPage({ params: Promise.resolve({ id: "nonexistent" }) });
    } catch {
      // notFound throws
    }
    expect(nav.notFound).toHaveBeenCalled();
  });
});
