import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/admin/order"),
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
  useDebounce: vi.fn((v: any) => v),
}));
vi.mock("@/components/admin/shared", () => ({
  PageHeader: ({ title }: any) => <div data-testid="page-header">{title}</div>,
  ToastContainer: () => null,
}));
vi.mock("@/lib/csrf-client", () => ({
  csrfHeaders: vi.fn(() => ({ "Content-Type": "application/json" })),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import ProductSortPage from "@/app/admin/order/page";

describe("ProductSortPage (Admin Orders)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
  });

  it("renders without errors", () => {
    const { container } = render(<ProductSortPage />);
    expect(container).toBeTruthy();
  });

  it("renders the page structure", () => {
    const { container } = render(<ProductSortPage />);
    expect(container.firstChild).toBeTruthy();
  });
});
