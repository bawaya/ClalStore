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
    // Each nav label appears once in the sidebar nav (the active-summary header
    // shows a different label by default since pathname is /admin → "نظرة عامة").
    expect(screen.getByText("الهواتف والإكسسوارات")).toBeInTheDocument();
    expect(screen.getByText("الكوبونات")).toBeInTheDocument();
    expect(screen.getByText("صور الهيرو والبنرات")).toBeInTheDocument();
    expect(screen.getByText("الإعدادات")).toBeInTheDocument();
  });

  it("highlights the active navigation item", () => {
    mockPathname = "/admin/products";
    render(<AdminShell><div>Content</div></AdminShell>);
    // The label appears in two spots when active (summary header + nav link); the link is the <a>.
    const productsLinks = screen.getAllByText("الهواتف والإكسسوارات");
    const productsLink = productsLinks
      .map((node) => node.closest("a"))
      .find((node): node is HTMLAnchorElement => Boolean(node));
    expect(productsLink).toBeDefined();
    // Active item gets a brand-tinted gradient background. The browser normalizes
    // the rgba spacing so we just look for the brand RGB triplet.
    const bg = productsLink?.style.background || "";
    expect(bg).toMatch(/196,\s*16,\s*64/);
  });

  it("renders sidebar layout on desktop", () => {
    const { container } = render(<AdminShell><div>Content</div></AdminShell>);
    const sidebar = container.querySelector("aside");
    expect(sidebar).toBeInTheDocument();
    expect(sidebar).toHaveClass("w-[21rem]");
  });

  it("renders mobile top bar with menu button", () => {
    mockUseScreen.mockReturnValue({ mobile: true, tablet: false, desktop: false, width: 375 });
    render(<AdminShell><div>Content</div></AdminShell>);
    const menuButton = screen.getByRole("button", { name: "فتح القائمة" });
    expect(menuButton).toBeInTheDocument();
  });

  it("shows admin label on mobile top bar", () => {
    mockUseScreen.mockReturnValue({ mobile: true, tablet: false, desktop: false, width: 375 });
    render(<AdminShell><div>Content</div></AdminShell>);
    expect(screen.getAllByTestId("logo").length).toBeGreaterThan(0);
  });

  it("shows store and CRM links on desktop sidebar", () => {
    render(<AdminShell><div>Content</div></AdminShell>);
    // Sidebar footer has two links to /store and /crm.
    const storeLinks = screen.getAllByRole("link", { name: /المتجر/ });
    expect(storeLinks.length).toBeGreaterThan(0);
    const crmLinks = screen.getAllByRole("link", { name: /العلاقات/ });
    expect(crmLinks.length).toBeGreaterThan(0);
  });

  it("links to store from sidebar", () => {
    render(<AdminShell><div>Content</div></AdminShell>);
    const storeLinks = screen
      .getAllByRole("link", { name: /المتجر/ })
      .filter((link) => link.getAttribute("href") === "/store");
    expect(storeLinks.length).toBeGreaterThan(0);
  });

  it("links to CRM from sidebar", () => {
    render(<AdminShell><div>Content</div></AdminShell>);
    const crmLinks = screen
      .getAllByRole("link", { name: /العلاقات/ })
      .filter((link) => link.getAttribute("href") === "/crm");
    expect(crmLinks.length).toBeGreaterThan(0);
  });

  it("uses correct active detection for nested paths", () => {
    mockPathname = "/admin/commissions/corrections";
    render(<AdminShell><div>Content</div></AdminShell>);
    const correctionsLinks = screen.getAllByText("طلبات التصحيح");
    const correctionsLink = correctionsLinks
      .map((node) => node.closest("a"))
      .find((node): node is HTMLAnchorElement => Boolean(node));
    expect(correctionsLink).toBeDefined();
    const bg = correctionsLink?.style.background || "";
    expect(bg).toMatch(/196,\s*16,\s*64/);
  });

  it("renders mobile shortcuts row", () => {
    mockUseScreen.mockReturnValue({ mobile: true, tablet: false, desktop: false, width: 375 });
    render(<AdminShell><div>Content</div></AdminShell>);
    // Mobile shortcut chips include "الهواتف والإكسسوارات" (products) by default.
    expect(screen.getByText("الهواتف والإكسسوارات")).toBeInTheDocument();
  });
});
