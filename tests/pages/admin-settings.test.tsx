import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => {
  // Stable router/path/search references — see useAdminSettings comment below.
  const router = { push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(), forward: vi.fn() };
  const pathname = "/admin/settings";
  const search = new URLSearchParams();
  const params = {};
  return {
    useRouter: () => router,
    usePathname: () => pathname,
    useSearchParams: () => search,
    useParams: () => params,
    redirect: vi.fn(),
  };
});
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
// vi.mock is hoisted; declare the stable hook return inside the factory so
// the same identity is returned on every render. A fresh object per render
// would trigger an infinite re-render loop because the page resets a draft
// state from `settings` in a useEffect dependency array.
vi.mock("@/lib/admin/hooks", () => {
  const stable = {
    settings: {} as Record<string, string>,
    integrations: [] as any[],
    loading: false,
    error: null,
    saving: false,
    update: vi.fn(),
    refresh: vi.fn(),
    updateSetting: vi.fn(),
    updateIntegration: vi.fn(),
    clearError: vi.fn(),
  };
  return {
    useAdminSettings: vi.fn(() => stable),
  };
});
vi.mock("@/components/admin/shared", () => ({
  ErrorBanner: ({ message }: any) => message ? <div data-testid="error-banner">{message}</div> : null,
  FormField: ({ label, children }: any) => <div><label>{label}</label>{children}</div>,
  PageHeader: ({ title, subtitle }: any) => (
    <header data-testid="page-header">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </header>
  ),
  ToastContainer: ({ toasts = [] }: any) => <div data-testid="toast-container" data-count={toasts.length} />,
  Toggle: () => <input type="checkbox" data-testid="toggle" />,
}));
vi.mock("@/lib/constants", () => ({
  INTEGRATION_TYPES: [],
}));
vi.mock("@/components/shared/Logo", () => ({
  invalidateLogoCache: vi.fn(),
}));
vi.mock("@/lib/csrf-client", () => ({
  csrfHeaders: vi.fn(() => ({ "Content-Type": "application/json" })),
}));

import SettingsPage from "@/app/admin/settings/page";

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without errors", () => {
    const { container } = render(<SettingsPage />);
    expect(container).toBeTruthy();
  });

  it("renders the page structure", () => {
    const { container } = render(<SettingsPage />);
    expect(container.firstChild).toBeTruthy();
  });
});
