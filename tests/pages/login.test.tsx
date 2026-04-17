import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/login"),
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
vi.mock("@/components/shared/Logo", () => ({
  Logo: ({ label, subtitle }: any) => (
    <div data-testid="logo">
      <span>{label}</span>
      <span>{subtitle}</span>
    </div>
  ),
}));
vi.mock("@/lib/auth", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  getSupabase: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null })),
        })),
      })),
    })),
  })),
}));

import LoginPage from "@/app/(auth)/login/page";

describe("LoginPage", () => {
  it("renders without errors", () => {
    const { container } = render(<LoginPage />);
    expect(container).toBeTruthy();
  });

  it("renders the logo", () => {
    render(<LoginPage />);
    expect(screen.getByTestId("logo")).toBeInTheDocument();
    expect(screen.getByText("ClalMobile")).toBeInTheDocument();
  });

  it("renders email and password input fields", () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText("admin@clalmobile.co.il")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });

  it("renders the login button", () => {
    render(<LoginPage />);
    expect(screen.getByText("تسجيل الدخول")).toBeInTheDocument();
  });

  it("renders the form as a form element", () => {
    const { container } = render(<LoginPage />);
    const form = container.querySelector("form");
    expect(form).toBeTruthy();
  });

  it("shows email field as required", () => {
    render(<LoginPage />);
    const emailInput = screen.getByPlaceholderText("admin@clalmobile.co.il");
    expect(emailInput).toHaveAttribute("required");
  });

  it("shows password field as required", () => {
    render(<LoginPage />);
    const passwordInput = screen.getByPlaceholderText("••••••••");
    expect(passwordInput).toHaveAttribute("required");
  });
});
