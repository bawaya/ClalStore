import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/store/compare"),
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
vi.mock("@/lib/store/compare", () => ({
  useCompare: vi.fn(() => ({
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
vi.mock("@/lib/utils", () => ({
  getProductName: vi.fn((item: any, lang: string) => item.name_ar),
  getColorName: vi.fn((c: any, lang: string) => c?.name_ar || ""),
}));

import ComparePage from "@/app/store/compare/page";

describe("ComparePage", () => {
  it("renders without errors", () => {
    const { container } = render(<ComparePage />);
    expect(container).toBeTruthy();
  });

  it("shows empty state when no items to compare", () => {
    render(<ComparePage />);
    expect(screen.getByText("compare.emptyTitle")).toBeInTheDocument();
    expect(screen.getByText("compare.emptyDesc")).toBeInTheDocument();
  });

  it("renders a link to store when empty", () => {
    render(<ComparePage />);
    expect(screen.getByText("store.goToStore")).toBeInTheDocument();
  });

  it("renders store header", () => {
    render(<ComparePage />);
    expect(screen.getByTestId("store-header")).toBeInTheDocument();
  });
});
