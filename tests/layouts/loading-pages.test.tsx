import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  redirect: vi.fn(),
}));
vi.mock("@/lib/i18n", () => ({
  useLang: vi.fn(() => ({ lang: "ar", setLang: vi.fn(), t: (k: string) => k, dir: "rtl", fontClass: "font-arabic" })),
  LangProvider: ({ children }: any) => children,
}));

// =====================================================
// app/loading.tsx — Root Loading
// =====================================================
describe("Root Loading (app/loading.tsx)", () => {
  it("renders without errors", async () => {
    const { default: Loading } = await import("@/app/loading");
    const { container } = render(<Loading />);
    expect(container).toBeTruthy();
  });

  it("renders the loading text", async () => {
    const { default: Loading } = await import("@/app/loading");
    render(<Loading />);
    expect(screen.getByText("common.loading")).toBeInTheDocument();
  });

  it("renders a spinner element", async () => {
    const { default: Loading } = await import("@/app/loading");
    const { container } = render(<Loading />);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
  });

  it("has full height layout", async () => {
    const { default: Loading } = await import("@/app/loading");
    const { container } = render(<Loading />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("min-h-screen");
  });
});

// =====================================================
// app/admin/loading.tsx — Admin Loading
// =====================================================
describe("Admin Loading (app/admin/loading.tsx)", () => {
  it("renders without errors", async () => {
    const { default: AdminLoading } = await import("@/app/admin/loading");
    const { container } = render(<AdminLoading />);
    expect(container).toBeTruthy();
  });

  it("renders skeleton elements", async () => {
    const { default: AdminLoading } = await import("@/app/admin/loading");
    const { container } = render(<AdminLoading />);
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("has RTL direction", async () => {
    const { default: AdminLoading } = await import("@/app/admin/loading");
    const { container } = render(<AdminLoading />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("dir")).toBe("rtl");
  });

  it("renders stats row skeleton (4 cards)", async () => {
    const { default: AdminLoading } = await import("@/app/admin/loading");
    const { container } = render(<AdminLoading />);
    const statCards = container.querySelectorAll(".bg-surface-card");
    expect(statCards.length).toBeGreaterThanOrEqual(4);
  });

  it("renders table skeleton", async () => {
    const { default: AdminLoading } = await import("@/app/admin/loading");
    const { container } = render(<AdminLoading />);
    // Table skeleton has border-b elements
    const rows = container.querySelectorAll(".border-b");
    expect(rows.length).toBeGreaterThan(0);
  });
});

// =====================================================
// app/crm/loading.tsx — CRM Loading
// =====================================================
describe("CRM Loading (app/crm/loading.tsx)", () => {
  it("renders without errors", async () => {
    const { default: CRMLoading } = await import("@/app/crm/loading");
    const { container } = render(<CRMLoading />);
    expect(container).toBeTruthy();
  });

  it("renders skeleton elements", async () => {
    const { default: CRMLoading } = await import("@/app/crm/loading");
    const { container } = render(<CRMLoading />);
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("has RTL direction", async () => {
    const { default: CRMLoading } = await import("@/app/crm/loading");
    const { container } = render(<CRMLoading />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("dir")).toBe("rtl");
  });

  it("renders header skeleton", async () => {
    const { default: CRMLoading } = await import("@/app/crm/loading");
    const { container } = render(<CRMLoading />);
    const headerSkeleton = container.querySelector(".bg-surface-elevated.rounded");
    expect(headerSkeleton).toBeTruthy();
  });

  it("renders alert cards skeleton", async () => {
    const { default: CRMLoading } = await import("@/app/crm/loading");
    const { container } = render(<CRMLoading />);
    const cards = container.querySelectorAll(".bg-surface-card");
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });
});

// =====================================================
// app/store/loading.tsx — Store Loading
// =====================================================
describe("Store Loading (app/store/loading.tsx)", () => {
  it("renders without errors", async () => {
    const { default: StoreLoading } = await import("@/app/store/loading");
    const { container } = render(<StoreLoading />);
    expect(container).toBeTruthy();
  });

  it("renders skeleton elements", async () => {
    const { default: StoreLoading } = await import("@/app/store/loading");
    const { container } = render(<StoreLoading />);
    const pulseElements = container.querySelectorAll(".animate-pulse");
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it("has RTL direction", async () => {
    const { default: StoreLoading } = await import("@/app/store/loading");
    const { container } = render(<StoreLoading />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("dir")).toBe("rtl");
  });

  it("renders header skeleton", async () => {
    const { default: StoreLoading } = await import("@/app/store/loading");
    const { container } = render(<StoreLoading />);
    // Header skeleton bar (top bar uses h-24 in the redesigned shell).
    const header = container.querySelector(".h-24");
    expect(header).toBeTruthy();
  });

  it("renders hero skeleton", async () => {
    const { default: StoreLoading } = await import("@/app/store/loading");
    const { container } = render(<StoreLoading />);
    // Hero placeholder is the 10-row tall block in the rounded card section.
    const hero = container.querySelector(".h-10");
    expect(hero).toBeTruthy();
  });

  it("renders product grid skeleton (8 items)", async () => {
    const { default: StoreLoading } = await import("@/app/store/loading");
    const { container } = render(<StoreLoading />);
    // Each product card uses an aspect-[4/4.2] image placeholder.
    const productCards = container.querySelectorAll(".aspect-\\[4\\/4\\.2\\]");
    expect(productCards.length).toBe(8);
  });

  it("has min-h-screen class", async () => {
    const { default: StoreLoading } = await import("@/app/store/loading");
    const { container } = render(<StoreLoading />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("min-h-screen");
  });
});
