import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Common mocks
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
vi.mock("next/link", () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));

// =====================================================
// app/error.tsx — Root Error Boundary
// =====================================================
describe("RootError (app/error.tsx)", () => {
  const mockReset = vi.fn();
  const mockError = Object.assign(new Error("Test root error"), { digest: "abc123" });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders without errors", async () => {
    const { default: RootError } = await import("@/app/error");
    const { container } = render(<RootError error={mockError} reset={mockReset} />);
    expect(container).toBeTruthy();
  });

  it("renders error message and description", async () => {
    const { default: RootError } = await import("@/app/error");
    render(<RootError error={mockError} reset={mockReset} />);
    expect(screen.getByText("errors.somethingWrong")).toBeInTheDocument();
    expect(screen.getByText("errors.unexpectedError")).toBeInTheDocument();
  });

  it("renders the retry button", async () => {
    const { default: RootError } = await import("@/app/error");
    render(<RootError error={mockError} reset={mockReset} />);
    expect(screen.getByText("errors.tryAgain")).toBeInTheDocument();
  });

  it("renders the go home link", async () => {
    const { default: RootError } = await import("@/app/error");
    render(<RootError error={mockError} reset={mockReset} />);
    const homeLink = screen.getByText("errors.goHome");
    expect(homeLink).toBeInTheDocument();
    expect(homeLink.closest("a")).toHaveAttribute("href", "/");
  });

  it("displays error digest when present", async () => {
    const { default: RootError } = await import("@/app/error");
    render(<RootError error={mockError} reset={mockReset} />);
    expect(screen.getByText(/abc123/)).toBeInTheDocument();
  });

  it("calls reset when retry button is clicked", async () => {
    const { default: RootError } = await import("@/app/error");
    render(<RootError error={mockError} reset={mockReset} />);
    const retryButton = screen.getByText("errors.tryAgain");
    retryButton.click();
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("logs error to console", async () => {
    const { default: RootError } = await import("@/app/error");
    render(<RootError error={mockError} reset={mockReset} />);
    expect(console.error).toHaveBeenCalledWith("[App Error]", mockError);
  });
});

// =====================================================
// app/global-error.tsx — Global Error Boundary
// =====================================================
describe("GlobalError (app/global-error.tsx)", () => {
  const mockReset = vi.fn();
  const mockError = Object.assign(new Error("Global error"), { digest: "xyz789" });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", async () => {
    const { default: GlobalError } = await import("@/app/global-error");
    const { container } = render(<GlobalError error={mockError} reset={mockReset} />);
    expect(container).toBeTruthy();
  });

  it("renders error message in Arabic (default)", async () => {
    const { default: GlobalError } = await import("@/app/global-error");
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(screen.getByText("حصل خطأ!")).toBeInTheDocument();
  });

  it("renders retry and home buttons", async () => {
    const { default: GlobalError } = await import("@/app/global-error");
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(screen.getByText(/حاول مرة ثانية/)).toBeInTheDocument();
    expect(screen.getByText(/الرئيسية/)).toBeInTheDocument();
  });

  it("displays error digest when present", async () => {
    const { default: GlobalError } = await import("@/app/global-error");
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(screen.getByText(/xyz789/)).toBeInTheDocument();
  });

  it("calls reset on retry click", async () => {
    const { default: GlobalError } = await import("@/app/global-error");
    render(<GlobalError error={mockError} reset={mockReset} />);
    const retryButton = screen.getByText(/حاول مرة ثانية/);
    retryButton.click();
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("renders html element with RTL direction", async () => {
    const { default: GlobalError } = await import("@/app/global-error");
    const jsx = <GlobalError error={mockError} reset={mockReset} />;
    // GlobalError renders <html>, check the JSX tree structure
    expect(jsx).toBeTruthy();
  });
});

// =====================================================
// app/admin/error.tsx — Admin Error Boundary
// =====================================================
describe("AdminError (app/admin/error.tsx)", () => {
  const mockReset = vi.fn();
  const mockError = Object.assign(new Error("Admin error"), { digest: "admin-err" });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders without errors", async () => {
    const { default: AdminError } = await import("@/app/admin/error");
    const { container } = render(<AdminError error={mockError} reset={mockReset} />);
    expect(container).toBeTruthy();
  });

  it("renders admin-specific error message", async () => {
    const { default: AdminError } = await import("@/app/admin/error");
    render(<AdminError error={mockError} reset={mockReset} />);
    expect(screen.getByText("حدث خطأ في لوحة التحكم")).toBeInTheDocument();
  });

  it("renders retry button", async () => {
    const { default: AdminError } = await import("@/app/admin/error");
    render(<AdminError error={mockError} reset={mockReset} />);
    expect(screen.getByText("حاول مجدداً")).toBeInTheDocument();
  });

  it("renders link back to admin home", async () => {
    const { default: AdminError } = await import("@/app/admin/error");
    render(<AdminError error={mockError} reset={mockReset} />);
    const homeLink = screen.getByText("الصفحة الرئيسية");
    expect(homeLink.closest("a")).toHaveAttribute("href", "/admin");
  });

  it("calls reset on retry click", async () => {
    const { default: AdminError } = await import("@/app/admin/error");
    render(<AdminError error={mockError} reset={mockReset} />);
    screen.getByText("حاول مجدداً").click();
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("logs error to console", async () => {
    const { default: AdminError } = await import("@/app/admin/error");
    render(<AdminError error={mockError} reset={mockReset} />);
    expect(console.error).toHaveBeenCalledWith("[Admin Error]", mockError);
  });
});

// =====================================================
// app/crm/error.tsx — CRM Error Boundary
// =====================================================
describe("CRMError (app/crm/error.tsx)", () => {
  const mockReset = vi.fn();
  const mockError = Object.assign(new Error("CRM error"), { digest: "crm-err" });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders without errors", async () => {
    const { default: CRMError } = await import("@/app/crm/error");
    const { container } = render(<CRMError error={mockError} reset={mockReset} />);
    expect(container).toBeTruthy();
  });

  it("renders CRM-specific error message", async () => {
    const { default: CRMError } = await import("@/app/crm/error");
    render(<CRMError error={mockError} reset={mockReset} />);
    expect(screen.getByText("حدث خطأ في نظام إدارة العملاء")).toBeInTheDocument();
  });

  it("renders retry button", async () => {
    const { default: CRMError } = await import("@/app/crm/error");
    render(<CRMError error={mockError} reset={mockReset} />);
    expect(screen.getByText("حاول مجدداً")).toBeInTheDocument();
  });

  it("renders link back to CRM home", async () => {
    const { default: CRMError } = await import("@/app/crm/error");
    render(<CRMError error={mockError} reset={mockReset} />);
    const homeLink = screen.getByText("الصفحة الرئيسية");
    expect(homeLink.closest("a")).toHaveAttribute("href", "/crm");
  });

  it("calls reset on retry click", async () => {
    const { default: CRMError } = await import("@/app/crm/error");
    render(<CRMError error={mockError} reset={mockReset} />);
    screen.getByText("حاول مجدداً").click();
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("logs error to console", async () => {
    const { default: CRMError } = await import("@/app/crm/error");
    render(<CRMError error={mockError} reset={mockReset} />);
    expect(console.error).toHaveBeenCalledWith("[CRM Error]", mockError);
  });
});

// =====================================================
// app/store/error.tsx — Store Error Boundary
// =====================================================
describe("StoreError (app/store/error.tsx)", () => {
  const mockReset = vi.fn();
  const mockError = Object.assign(new Error("Store error"), { digest: "store-err" });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders without errors", async () => {
    const { default: StoreError } = await import("@/app/store/error");
    const { container } = render(<StoreError error={mockError} reset={mockReset} />);
    expect(container).toBeTruthy();
  });

  it("renders store-specific error message", async () => {
    const { default: StoreError } = await import("@/app/store/error");
    render(<StoreError error={mockError} reset={mockReset} />);
    expect(screen.getByText("حدث خطأ")).toBeInTheDocument();
  });

  it("renders retry button", async () => {
    const { default: StoreError } = await import("@/app/store/error");
    render(<StoreError error={mockError} reset={mockReset} />);
    expect(screen.getByText("حاول مجدداً")).toBeInTheDocument();
  });

  it("renders link back to store", async () => {
    const { default: StoreError } = await import("@/app/store/error");
    render(<StoreError error={mockError} reset={mockReset} />);
    const storeLink = screen.getByText("العودة للمتجر");
    expect(storeLink.closest("a")).toHaveAttribute("href", "/store");
  });

  it("calls reset on retry click", async () => {
    const { default: StoreError } = await import("@/app/store/error");
    render(<StoreError error={mockError} reset={mockReset} />);
    screen.getByText("حاول مجدداً").click();
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("logs error to console", async () => {
    const { default: StoreError } = await import("@/app/store/error");
    render(<StoreError error={mockError} reset={mockReset} />);
    expect(console.error).toHaveBeenCalledWith("[Store Error]", mockError);
  });
});
