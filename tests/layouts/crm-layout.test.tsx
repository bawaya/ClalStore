import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/crm"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  redirect: vi.fn(),
}));
vi.mock("@/lib/i18n", () => ({
  useLang: vi.fn(() => ({ lang: "ar", setLang: vi.fn(), t: (k: string) => k, dir: "rtl", fontClass: "font-arabic" })),
  LangProvider: ({ children }: any) => children,
}));
vi.mock("@/components/crm/CRMShell", () => ({
  CRMShell: ({ children }: any) => (
    <div data-testid="crm-shell">
      <nav data-testid="crm-nav">CRM Nav</nav>
      <main data-testid="crm-main">{children}</main>
    </div>
  ),
}));

describe("CRMLayout", () => {
  it("renders children inside CRMShell", async () => {
    const { default: CRMLayout } = await import("@/app/crm/layout");
    const jsx = CRMLayout({ children: <div data-testid="crm-child">CRM Content</div> });
    render(jsx);

    expect(screen.getByTestId("crm-shell")).toBeInTheDocument();
    expect(screen.getByTestId("crm-child")).toBeInTheDocument();
    expect(screen.getByText("CRM Content")).toBeInTheDocument();
  });

  it("has expected structure with navigation", async () => {
    const { default: CRMLayout } = await import("@/app/crm/layout");
    const jsx = CRMLayout({ children: <div>Content</div> });
    render(jsx);

    expect(screen.getByTestId("crm-nav")).toBeInTheDocument();
    expect(screen.getByTestId("crm-main")).toBeInTheDocument();
  });

  it("renders multiple children", async () => {
    const { default: CRMLayout } = await import("@/app/crm/layout");
    const jsx = CRMLayout({
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
