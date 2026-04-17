import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ===== Mocks =====
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/"),
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

// Mock data fetchers
vi.mock("@/lib/store/queries", () => ({
  getProducts: vi.fn(() => Promise.resolve([
    { id: "1", name_ar: "Samsung Galaxy", brand: "Samsung", price: 1999, stock: 10, type: "device", active: true },
  ])),
  getLinePlans: vi.fn(() => Promise.resolve([
    { id: "p1", name_ar: "باقة 50GB", price: 49 },
  ])),
  getWebsiteContent: vi.fn(() => Promise.resolve({})),
}));

// Mock the HomeClient component since it's complex
vi.mock("@/components/website/HomeClient", () => ({
  HomeClient: ({ products, plans, cms }: any) => (
    <div data-testid="home-client">
      <span data-testid="products-count">{products.length}</span>
      <span data-testid="plans-count">{plans.length}</span>
    </div>
  ),
}));

describe("HomePage (Server Component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", async () => {
    const { default: HomePage } = await import("@/app/page");
    const jsx = await HomePage();
    const { container } = render(jsx);
    expect(container).toBeTruthy();
  });

  it("passes products and plans to HomeClient", async () => {
    const { default: HomePage } = await import("@/app/page");
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByTestId("home-client")).toBeInTheDocument();
    expect(screen.getByTestId("products-count")).toHaveTextContent("1");
    expect(screen.getByTestId("plans-count")).toHaveTextContent("1");
  });

  it("handles fetch errors gracefully (empty arrays)", async () => {
    const queries = await import("@/lib/store/queries");
    vi.mocked(queries.getProducts).mockRejectedValueOnce(new Error("fail"));
    vi.mocked(queries.getLinePlans).mockRejectedValueOnce(new Error("fail"));
    vi.mocked(queries.getWebsiteContent).mockRejectedValueOnce(new Error("fail"));

    // Re-import to get fresh module
    vi.resetModules();
    vi.doMock("@/lib/store/queries", () => ({
      getProducts: vi.fn(() => Promise.reject(new Error("fail"))),
      getLinePlans: vi.fn(() => Promise.reject(new Error("fail"))),
      getWebsiteContent: vi.fn(() => Promise.reject(new Error("fail"))),
    }));
    vi.doMock("@/components/website/HomeClient", () => ({
      HomeClient: ({ products, plans }: any) => (
        <div data-testid="home-client">
          <span data-testid="products-count">{products.length}</span>
          <span data-testid="plans-count">{plans.length}</span>
        </div>
      ),
    }));

    const { default: HomePage } = await import("@/app/page");
    const jsx = await HomePage();
    render(jsx);
    expect(screen.getByTestId("products-count")).toHaveTextContent("0");
    expect(screen.getByTestId("plans-count")).toHaveTextContent("0");
  });
});
