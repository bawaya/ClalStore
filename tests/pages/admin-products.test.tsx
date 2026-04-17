import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/admin/products"),
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
vi.mock("@/lib/admin/hooks", () => ({
  useAdminApi: vi.fn(() => ({
    data: [],
    loading: false,
    error: null,
    clearError: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    bulkRemove: vi.fn(),
    pagination: { page: 1, totalPages: 1, total: 0 },
    setPage: vi.fn(),
  })),
}));
vi.mock("@/components/admin/shared", () => ({
  PageHeader: ({ title }: any) => <div data-testid="page-header">{title}</div>,
  Modal: ({ children }: any) => <div data-testid="modal">{children}</div>,
  FormField: ({ label, children }: any) => <div><label>{label}</label>{children}</div>,
  Toggle: (props: any) => <input type="checkbox" data-testid="toggle" />,
  ConfirmDialog: () => null,
  EmptyState: ({ message }: any) => <div data-testid="empty-state">{message}</div>,
  ErrorBanner: () => null,
  ToastContainer: () => null,
}));
vi.mock("@/components/admin/ImageUpload", () => ({
  IMAGE_DIMS: { product: "400×400", logo: "200×200", hero: "1600×800" },
  default: () => <div data-testid="image-upload" />,
  ImageUpload: () => <div data-testid="image-upload" />,
}));
vi.mock("@/lib/constants", () => ({
  PRODUCT_TYPES: {
    device: { label: "أجهزة", icon: "📱" },
    accessory: { label: "إكسسوارات", icon: "🔌" },
  },
  ORDER_STATUS: { new: { label: "جديد", icon: "🆕", color: "#000" } },
  ORDER_SOURCE: { store: { label: "متجر", icon: "🏪", color: "#000" } },
  CUSTOMER_SEGMENT: { active: { label: "نشط", icon: "✅", color: "#000" } },
  USER_ROLE: { super_admin: { label: "مدير", icon: "👑", permissions: ["*"] } },
}));
vi.mock("@/lib/utils", () => ({
  calcMargin: vi.fn(() => 0),
}));
vi.mock("@/lib/admin/ai-tools", () => ({
  aiEnhanceProduct: vi.fn(),
  translateProductName: vi.fn(),
  detectProductType: vi.fn(),
  findDuplicates: vi.fn(),
}));
vi.mock("@/lib/csrf-client", () => ({
  csrfHeaders: vi.fn(() => ({ "Content-Type": "application/json" })),
}));

import ProductsPage from "@/app/admin/products/page";

describe("ProductsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { container } = render(<ProductsPage />);
    expect(container).toBeTruthy();
  });

  it("renders the page", () => {
    const { container } = render(<ProductsPage />);
    expect(container.firstChild).toBeTruthy();
  });
});
