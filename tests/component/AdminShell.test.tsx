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

function getLinkByHref(container: HTMLElement, href: string) {
  const link = container.querySelector<HTMLAnchorElement>(`a[href="${href}"]`);
  expect(link).toBeInTheDocument();
  return link as HTMLAnchorElement;
}

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
    const { container } = render(<AdminShell><div>Content</div></AdminShell>);

    expect(getLinkByHref(container, "/admin/phones")).toBeInTheDocument();
    expect(getLinkByHref(container, "/admin/accessories")).toBeInTheDocument();
    expect(getLinkByHref(container, "/admin/coupons")).toBeInTheDocument();
    expect(getLinkByHref(container, "/admin/heroes")).toBeInTheDocument();
    expect(getLinkByHref(container, "/admin/settings")).toBeInTheDocument();
  });

  it("highlights the active navigation item", () => {
    mockPathname = "/admin/phones";
    const { container } = render(<AdminShell><div>Content</div></AdminShell>);
    const productsLink = getLinkByHref(container, "/admin/phones");
    const bg = productsLink.style.background || "";

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
    const { container } = render(<AdminShell><div>Content</div></AdminShell>);
    const menuButton = container.querySelector("button[aria-label]");

    expect(menuButton).toBeInTheDocument();
  });

  it("shows admin label on mobile top bar", () => {
    mockUseScreen.mockReturnValue({ mobile: true, tablet: false, desktop: false, width: 375 });
    render(<AdminShell><div>Content</div></AdminShell>);

    expect(screen.getAllByTestId("logo").length).toBeGreaterThan(0);
  });

  it("shows store and CRM links on desktop sidebar", () => {
    const { container } = render(<AdminShell><div>Content</div></AdminShell>);

    expect(getLinkByHref(container, "/store")).toBeInTheDocument();
    expect(getLinkByHref(container, "/crm")).toBeInTheDocument();
  });

  it("links to store from sidebar", () => {
    const { container } = render(<AdminShell><div>Content</div></AdminShell>);

    expect(getLinkByHref(container, "/store")).toBeInTheDocument();
  });

  it("links to CRM from sidebar", () => {
    const { container } = render(<AdminShell><div>Content</div></AdminShell>);

    expect(getLinkByHref(container, "/crm")).toBeInTheDocument();
  });

  it("uses correct active detection for nested paths", () => {
    mockPathname = "/admin/commissions/corrections";
    const { container } = render(<AdminShell><div>Content</div></AdminShell>);
    const correctionsLink = getLinkByHref(container, "/admin/commissions/corrections");
    const bg = correctionsLink.style.background || "";

    expect(bg).toMatch(/196,\s*16,\s*64/);
  });

  it("renders mobile shortcuts row", () => {
    mockUseScreen.mockReturnValue({ mobile: true, tablet: false, desktop: false, width: 375 });
    const { container } = render(<AdminShell><div>Content</div></AdminShell>);

    expect(getLinkByHref(container, "/admin")).toBeInTheDocument();
    expect(getLinkByHref(container, "/admin/orders")).toBeInTheDocument();
    expect(getLinkByHref(container, "/admin/phones")).toBeInTheDocument();
    expect(getLinkByHref(container, "/admin/homepage")).toBeInTheDocument();
  });
});
