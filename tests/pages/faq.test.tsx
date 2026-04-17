import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/faq"),
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
  FAQSection: () => <div data-testid="faq-section">FAQ Content</div>,
}));

import FAQPage from "@/app/faq/page";

describe("FAQPage", () => {
  it("renders without errors", () => {
    const { container } = render(<FAQPage />);
    expect(container).toBeTruthy();
  });

  it("renders navbar, FAQ section, and footer", () => {
    render(<FAQPage />);
    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByTestId("faq-section")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("has RTL direction", () => {
    const { container } = render(<FAQPage />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("dir")).toBe("rtl");
  });

  it("has min-h-screen class for full height", () => {
    const { container } = render(<FAQPage />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("min-h-screen");
  });
});
