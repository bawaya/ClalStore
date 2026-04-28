import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/store/track"),
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
vi.mock("@/components/website/sections", () => ({
  Footer: () => <footer data-testid="footer">Footer</footer>,
}));

import TrackPage from "@/app/store/track/page";

describe("TrackPage", () => {
  it("renders without errors", () => {
    const { container } = render(<TrackPage />);
    expect(container).toBeTruthy();
  });

  it("renders the page title", () => {
    render(<TrackPage />);
    // Heading uses an explanatory full sentence, badge uses "تتبع الطلبات".
    expect(
      screen.getByRole("heading", {
        name: "افحص حالة طلبك من شاشة واحدة واضحة",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("تتبع الطلبات")).toBeInTheDocument();
  });

  it("renders the order ID input", () => {
    render(<TrackPage />);
    expect(screen.getByPlaceholderText("CLM-12345")).toBeInTheDocument();
  });

  it("renders the track button", () => {
    render(<TrackPage />);
    expect(screen.getByText("تتبع")).toBeInTheDocument();
  });

  it("renders store header and footer", () => {
    render(<TrackPage />);
    expect(screen.getByTestId("store-header")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("has RTL direction", () => {
    const { container } = render(<TrackPage />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("dir")).toBe("rtl");
  });

  it("renders the help text", () => {
    render(<TrackPage />);
    expect(screen.getByText(/أدخل رقم الطلب/)).toBeInTheDocument();
  });
});
