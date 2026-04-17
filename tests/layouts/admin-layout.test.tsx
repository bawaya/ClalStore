import { describe, it, expect, vi } from "vitest";
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
vi.mock("@/components/admin/AdminShell", () => ({
  AdminShell: ({ children }: any) => (
    <div data-testid="admin-shell">
      <nav data-testid="admin-nav">Admin Nav</nav>
      <main data-testid="admin-main">{children}</main>
    </div>
  ),
}));

describe("AdminLayout", () => {
  it("renders children inside AdminShell", async () => {
    const { default: AdminLayout } = await import("@/app/admin/layout");
    const jsx = AdminLayout({ children: <div data-testid="admin-child">Admin Content</div> });
    render(jsx);

    expect(screen.getByTestId("admin-shell")).toBeInTheDocument();
    expect(screen.getByTestId("admin-child")).toBeInTheDocument();
    expect(screen.getByText("Admin Content")).toBeInTheDocument();
  });

  it("has expected structure with navigation", async () => {
    const { default: AdminLayout } = await import("@/app/admin/layout");
    const jsx = AdminLayout({ children: <div>Content</div> });
    render(jsx);

    expect(screen.getByTestId("admin-nav")).toBeInTheDocument();
    expect(screen.getByTestId("admin-main")).toBeInTheDocument();
  });

  it("renders multiple children", async () => {
    const { default: AdminLayout } = await import("@/app/admin/layout");
    const jsx = AdminLayout({
      children: (
        <>
          <div data-testid="child-1">First</div>
          <div data-testid="child-2">Second</div>
        </>
      ),
    });
    render(jsx);

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
  });
});
