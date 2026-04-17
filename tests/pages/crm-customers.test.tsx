import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/crm/customers"),
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
  useDebounce: vi.fn((v: any) => v),
}));
vi.mock("@/lib/constants", () => ({
  CUSTOMER_SEGMENT: {},
}));
vi.mock("@/lib/utils", () => ({
  formatCurrency: vi.fn((v: number) => `₪${v}`),
  timeAgo: vi.fn(() => "just now"),
}));
vi.mock("@/components/admin/shared", () => ({
  Modal: ({ children }: any) => <div data-testid="modal">{children}</div>,
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import CustomersPage from "@/app/crm/customers/page";

describe("CustomersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ customers: [], total: 0 }),
    });
  });

  it("renders without errors", () => {
    const { container } = render(<CustomersPage />);
    expect(container).toBeTruthy();
  });

  it("renders the page structure", () => {
    const { container } = render(<CustomersPage />);
    expect(container.firstChild).toBeTruthy();
  });
});
