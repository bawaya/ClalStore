import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/crm/pipeline"),
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
vi.mock("@/components/admin/shared", () => ({
  ConfirmDialog: () => null,
  EmptyState: ({ message }: any) => <div data-testid="empty-state">{message}</div>,
  FormField: ({ label, children }: any) => <div><label>{label}</label>{children}</div>,
  Modal: ({ children }: any) => <div data-testid="modal">{children}</div>,
  PageHeader: ({ title }: any) => <div data-testid="page-header">{title}</div>,
  ToastContainer: () => null,
}));
vi.mock("@/components/orders/ManualOrderModal", () => ({
  ManualOrderModal: () => null,
}));
vi.mock("@/lib/csrf-client", () => ({
  csrfHeaders: vi.fn(() => ({ "Content-Type": "application/json" })),
}));
vi.mock("@/lib/utils", () => ({
  formatCurrency: vi.fn((v: number) => `₪${v}`),
  formatDateTime: vi.fn(() => "2024-01-01"),
  timeAgo: vi.fn(() => "just now"),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import PipelinePage from "@/app/crm/pipeline/page";

describe("PipelinePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ stages: [], deals: [], stats: { total_deals: 0, total_value: 0, conversion_rate: 0, avg_deal_time: 0 } }),
    });
  });

  it("renders without errors", () => {
    const { container } = render(<PipelinePage />);
    expect(container).toBeTruthy();
  });

  it("renders the page structure", () => {
    const { container } = render(<PipelinePage />);
    expect(container.firstChild).toBeTruthy();
  });
});
