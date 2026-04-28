import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/store/auth"),
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
vi.mock("@/components/store/StoreHeader", () => ({
  StoreHeader: () => <header data-testid="store-header">StoreHeader</header>,
}));

import AuthPage from "@/app/store/auth/page";

describe("AuthPage (Customer OTP Login)", () => {
  it("renders without errors", () => {
    const { container } = render(<AuthPage />);
    expect(container).toBeTruthy();
  });

  it("renders the phone input step initially", () => {
    render(<AuthPage />);
    expect(screen.getByText("auth.title")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("05X-XXXXXXX")).toBeInTheDocument();
  });

  it("renders the continue button", () => {
    render(<AuthPage />);
    // Default lang ar uses literal "متابعة" (copy.continue) for the phone-step button.
    expect(screen.getByRole("button", { name: "متابعة" })).toBeInTheDocument();
  });

  it("renders the progress indicator", () => {
    render(<AuthPage />);
    // Three step cards with Arabic captions: phone, channel, code.
    expect(screen.getByText("الهاتف")).toBeInTheDocument();
    expect(screen.getByText("القناة")).toBeInTheDocument();
    expect(screen.getByText("الرمز")).toBeInTheDocument();
  });

  it("renders store header", () => {
    render(<AuthPage />);
    expect(screen.getByTestId("store-header")).toBeInTheDocument();
  });

  it("has RTL direction", () => {
    const { container } = render(<AuthPage />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("dir")).toBe("rtl");
  });

  it("renders footer note", () => {
    render(<AuthPage />);
    expect(screen.getByText("auth.footerNote")).toBeInTheDocument();
  });
});
