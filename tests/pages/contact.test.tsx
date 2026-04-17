import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/contact"),
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
}));

import ContactPage from "@/app/contact/page";

describe("ContactPage", () => {
  it("renders without errors", () => {
    const { container } = render(<ContactPage />);
    expect(container).toBeTruthy();
  });

  it("renders the page title", () => {
    render(<ContactPage />);
    expect(screen.getByText("contact.title")).toBeInTheDocument();
  });

  it("renders contact info cards", () => {
    render(<ContactPage />);
    expect(screen.getByText("contact.phoneLabel")).toBeInTheDocument();
    expect(screen.getByText("contact.whatsapp")).toBeInTheDocument();
    expect(screen.getByText("contact.emailLabel")).toBeInTheDocument();
  });

  it("renders the contact form with required fields", () => {
    render(<ContactPage />);
    expect(screen.getByText("contact.sendMsg")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("contact.name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("05X-XXXXXXX")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("contact.message")).toBeInTheDocument();
  });

  it("renders the send button", () => {
    render(<ContactPage />);
    expect(screen.getByText("contact.send")).toBeInTheDocument();
  });

  it("renders working hours section", () => {
    render(<ContactPage />);
    expect(screen.getByText("contact.hours")).toBeInTheDocument();
  });

  it("renders navbar and footer", () => {
    render(<ContactPage />);
    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });
});
