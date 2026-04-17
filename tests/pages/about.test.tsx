import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/about"),
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
vi.mock("@/components/website/sections", () => ({
  Navbar: () => <nav data-testid="navbar">Navbar</nav>,
  Footer: () => <footer data-testid="footer">Footer</footer>,
  FAQSection: () => <div data-testid="faq-section">FAQ</div>,
}));

import AboutPage from "@/app/about/page";

describe("AboutPage", () => {
  it("renders without errors", () => {
    const { container } = render(<AboutPage />);
    expect(container).toBeTruthy();
  });

  it("renders the page title", () => {
    render(<AboutPage />);
    expect(screen.getByText("about.title")).toBeInTheDocument();
  });

  it("renders navbar and footer", () => {
    render(<AboutPage />);
    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("renders vision and values sections", () => {
    render(<AboutPage />);
    expect(screen.getByText("about.vision")).toBeInTheDocument();
    expect(screen.getByText("about.values")).toBeInTheDocument();
  });

  it("renders all four value cards", () => {
    render(<AboutPage />);
    expect(screen.getByText("about.quality")).toBeInTheDocument();
    expect(screen.getByText("about.trust")).toBeInTheDocument();
    expect(screen.getByText("about.speed")).toBeInTheDocument();
    expect(screen.getByText("about.value")).toBeInTheDocument();
  });

  it("has RTL direction", () => {
    const { container } = render(<AboutPage />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("dir")).toBe("rtl");
  });
});
