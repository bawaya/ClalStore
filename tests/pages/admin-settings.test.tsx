import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/admin/settings"),
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
  useAdminSettings: vi.fn(() => ({
    settings: {},
    loading: false,
    saving: false,
    update: vi.fn(),
    refresh: vi.fn(),
  })),
}));
vi.mock("@/components/admin/shared", () => ({
  FormField: ({ label, children }: any) => <div><label>{label}</label>{children}</div>,
  Toggle: (props: any) => <input type="checkbox" data-testid="toggle" />,
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
