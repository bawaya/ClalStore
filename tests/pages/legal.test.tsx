import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/legal"),
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
vi.mock("@/components/website/sections", () => ({
  Navbar: () => <nav data-testid="navbar">Navbar</nav>,
  Footer: () => <footer data-testid="footer">Footer</footer>,
}));

import LegalPage from "@/app/legal/page";

describe("LegalPage", () => {
  it("renders without errors", () => {
    const { container } = render(<LegalPage />);
    expect(container).toBeTruthy();
  });

  it("renders the main title", () => {
    render(<LegalPage />);
    expect(screen.getByText("الشروط والأحكام")).toBeInTheDocument();
  });

  it("renders all legal sections", () => {
    render(<LegalPage />);
    expect(screen.getAllByText(/شروط الاستخدام/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/سياسة الشراء والدفع/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/سياسة التوصيل/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/سياسة الإرجاع/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/سياسة الخصوصية/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/الضمان/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/التواصل/).length).toBeGreaterThan(0);
  });

  it("renders navbar and footer", () => {
    render(<LegalPage />);
    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("has RTL direction", () => {
    const { container } = render(<LegalPage />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("dir")).toBe("rtl");
  });
});
