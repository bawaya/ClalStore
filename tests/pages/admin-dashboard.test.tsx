import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/admin"),
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
vi.mock("@/components/admin/shared", () => ({
  StatCard: ({ icon, label, value, sub }: any) => (
    <div data-testid="stat-card">
      <span>{icon}</span>
      <span>{label}</span>
      <span>{value}</span>
      {sub && <span>{sub}</span>}
    </div>
  ),
}));
vi.mock("@/lib/constants", () => ({
  ORDER_STATUS: {},
  ORDER_SOURCE: {},
}));
vi.mock("@/lib/utils", () => ({
  formatCurrency: vi.fn((v: number) => `₪${v}`),
  timeAgo: vi.fn(() => "just now"),
}));
vi.mock("@/lib/pdf-export", () => ({
  exportStatsPDF: vi.fn(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import AdminDashboard from "@/app/admin/page";

describe("AdminDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        totalOrders: 0,
        revenue: 0,
        prevRevenue: null,
        newCount: 0,
        noReply: 0,
        totalCustomers: 0,
        vipCount: 0,
        byStatus: {},
        bySource: {},
        recentOrders: [],
      }),
    });
  });

  it("renders without errors", () => {
    const { container } = render(<AdminDashboard />);
    expect(container).toBeTruthy();
  });

  it("shows loading state initially", () => {
    render(<AdminDashboard />);
    expect(screen.getByText(/جاري التحميل/)).toBeInTheDocument();
  });

  it("renders with correct structure", () => {
    const { container } = render(<AdminDashboard />);
    expect(container.firstChild).toBeTruthy();
  });
});
