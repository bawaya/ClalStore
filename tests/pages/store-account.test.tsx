import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockPush = vi.fn();
const mockReplace = vi.fn();
// Return a stable router object — an unstable identity per render causes
// hooks with router deps to refire forever and OOM the worker.
const stableRouter = { push: mockPush, back: vi.fn(), replace: mockReplace, refresh: vi.fn(), prefetch: vi.fn(), forward: vi.fn() };
const stablePath = "/store/account";
const stableSearch = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => stableRouter,
  usePathname: () => stablePath,
  useSearchParams: () => stableSearch,
  useParams: () => ({}),
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
vi.mock("@/lib/store/wishlist", () => ({
  useWishlist: vi.fn(() => ({
    items: [],
    removeItem: vi.fn(),
    clearAll: vi.fn(),
  })),
}));
vi.mock("@/lib/store/cart", () => ({
  useCart: vi.fn(() => ({
    items: [],
    addItem: vi.fn(),
  })),
}));
vi.mock("@/components/store/StoreHeader", () => ({
  StoreHeader: () => <header data-testid="store-header">StoreHeader</header>,
}));

import AccountPage from "@/app/store/account/page";

describe("AccountPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn((key: string) => {
          if (key === "clal_customer_token") return "test-token";
          if (key === "clal_customer") return JSON.stringify({ name: "Test", phone: "0541234567" });
          return null;
        }),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });
    // Mock fetch to avoid network and infinite re-renders
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: [] }),
        } as Response),
      ),
    );
  });

  it("renders without errors when token exists", () => {
    const { container } = render(<AccountPage />);
    expect(container).toBeTruthy();
  });

  it("renders the store header", () => {
    render(<AccountPage />);
    expect(screen.getByTestId("store-header")).toBeInTheDocument();
  });

  it("redirects to auth when no token", () => {
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
    render(<AccountPage />);
    expect(mockReplace).toHaveBeenCalledWith("/store/auth?return=/store/account");
  });

  it("renders tab buttons when authenticated", () => {
    render(<AccountPage />);
    expect(screen.getByText(/طلباتي/)).toBeInTheDocument();
    expect(screen.getByText(/معلوماتي/)).toBeInTheDocument();
    // "المفضلة" appears multiple times (tab + summary card); verify at least one.
    expect(screen.getAllByText(/المفضلة/).length).toBeGreaterThan(0);
  });

  it("renders logout button", () => {
    render(<AccountPage />);
    expect(screen.getByText("تسجيل خروج")).toBeInTheDocument();
  });
});
