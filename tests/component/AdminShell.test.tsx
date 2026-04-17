import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

let mockPathname = "/admin";
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => mockPathname),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
}));

const mockUseScreen = vi.fn(() => ({ mobile: false, tablet: false, desktop: true, width: 1024 }));
vi.mock("@/lib/hooks", () => ({
  useScreen: () => mockUseScreen(),
}));

vi.mock("@/components/shared/Logo", () => ({
  Logo: (props: any) => <div data-testid="logo">{props.label || "ClalMobile"}</div>,
}));

import { AdminShell } from "@/components/admin/AdminShell";

describe("AdminShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/admin";
    mockUseScreen.mockReturnValue({ mobile: false, tablet: false, desktop: true, width: 1024 });
  });

  it("renders without crashing", () => {
    render(<AdminShell><div>Content</div></AdminShell>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("renders children content", () => {
    render(<AdminShell><div>Admin Page Content</div></AdminShell>);
    expect(screen.getByText("Admin Page Content")).toBeInTheDocument();
  });

  it("shows logo on desktop", () => {
    render(<AdminShell><div>Content</div></AdminShell>);
    expect(screen.getAllByTestId("logo").length).toBeGreaterThan(0);
  });

  it("shows navigation items on desktop sidebar", () => {
    render(<AdminShell><div>Content</div></AdminShell>);
    expect(screen.getByText("المنتجات")).toBeInTheDocument();
    expect(screen.getByText("كوبونات")).toBeInTheDocument();
    expect(screen.getByText("بنرات")).toBeInTheDocument();
    expect(screen.getByText("إعدادات")).toBeInTheDocument();
  });

  it("highlights the active navigation item", () => {
    mockPathname = "/admin/products";
    render(<AdminShell><div>Content</div></AdminShell>);
    const productsLink = screen.getByText("المنتجات").closest("a");
    expect(productsLink?.style.fontWeight).toBe("700");
  });

  it("renders sidebar layout on desktop", () => {
    const { container } = render(<AdminShell><div>Content</div></AdminShell>);
    const sidebar = container.querySelector("aside");
    expect(sidebar).toBeInTheDocument();
    expect(sidebar).toHaveClass("w-56");
  });

  it("renders bottom tabs on mobile", () => {
    mockUseScreen.mockReturnValue({ mobile: true, tablet: false, desktop: false, width: 375 });
    render(<AdminShell><div>Content</div></AdminShell>);
    const nav = screen.getByRole("navigation");
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass("fixed");
  });

  it("shows top bar on mobile", () => {
    mockUseScreen.mockReturnValue({ mobile: true, tablet: false, desktop: false, width: 375 });
    render(<AdminShell><div>Content</div></AdminShell>);
    expect(screen.getByText("لوحة الإدارة")).toBeInTheDocument();
  });

  it("shows store and CRM links on desktop sidebar", () => {
    render(<AdminShell><div>Content</div></AdminShell>);
    expect(screen.getByText(/المتجر/)).toBeInTheDocument();
    expect(screen.getByText(/CRM/)).toBeInTheDocument();
  });

  it("links to store from sidebar", () => {
    render(<AdminShell><div>Content</div></AdminShell>);
    const storeLink = screen.getByText(/المتجر/).closest("a");
    expect(storeLink).toHaveAttribute("href", "/store");
  });

  it("links to CRM from sidebar", () => {
    render(<AdminShell><div>Content</div></AdminShell>);
    const crmLink = screen.getByText(/CRM/).closest("a");
    expect(crmLink).toHaveAttribute("href", "/crm");
  });

  it("uses correct active detection for nested paths", () => {
    mockPathname = "/admin/commissions/analytics";
    render(<AdminShell><div>Content</div></AdminShell>);
    const commissionsLink = screen.getByText("עמלות").closest("a");
    expect(commissionsLink?.style.fontWeight).toBe("700");
  });

  it("renders all nav items on mobile", () => {
    mockUseScreen.mockReturnValue({ mobile: true, tablet: false, desktop: false, width: 375 });
    render(<AdminShell><div>Content</div></AdminShell>);
    expect(screen.getByText("المنتجات")).toBeInTheDocument();
    expect(screen.getByText("إعدادات")).toBeInTheDocument();
  });
});
