import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/deals"),
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
vi.mock("@/components/store/StoreHeader", () => ({
  StoreHeader: () => <header data-testid="store-header">StoreHeader</header>,
}));
vi.mock("@/components/website/sections", () => ({
  Footer: () => <footer data-testid="footer">Footer</footer>,
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

import DealsPage from "@/app/deals/page";

describe("DealsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { deals: [] } }),
    });
  });

  it("renders without errors", () => {
    const { container } = render(<DealsPage />);
    expect(container).toBeTruthy();
  });

  it("renders the page header", () => {
    render(<DealsPage />);
    expect(screen.getByTestId("store-header")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    render(<DealsPage />);
    expect(screen.getByText(/جاري التحميل/)).toBeInTheDocument();
  });

  it("has RTL direction", () => {
    const { container } = render(<DealsPage />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("dir")).toBe("rtl");
  });
});
