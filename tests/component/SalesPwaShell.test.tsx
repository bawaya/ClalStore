/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * SalesPwaShell — unified PWA shell (mobile bottom nav + desktop sidebar).
 * Renders header with employee name + unread announcements badge, and the
 * navigation surface (bottom tab on mobile, sidebar on desktop, drawer on
 * mobile menu click).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ─── Mocks ───────────────────────────────────────────────────────────────
let mockPathname: string = "/sales-pwa";
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => mockPathname),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock("@/components/shared/Logo", () => ({
  Logo: ({ label, subtitle }: any) => (
    <div data-testid="logo">
      <span>{label}</span>
      <span>{subtitle}</span>
    </div>
  ),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabase: vi.fn(() => ({ auth: {} })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────
type FetchResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

/**
 * Build a fetch mock that routes by URL. Pass a map of
 * `{ "/api/foo": { ok, body } }`. Unknown URLs resolve to `{ ok: false, {} }`.
 */
function buildFetchMock(
  routes: Record<string, { ok?: boolean; body: unknown }>,
): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [pattern, def] of Object.entries(routes)) {
      if (url.startsWith(pattern)) {
        const res: FetchResponse = {
          ok: def.ok !== false,
          json: async () => def.body,
        };
        return res as unknown as Response;
      }
    }
    return {
      ok: false,
      json: async () => ({}),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

import { SalesPwaShell } from "@/components/pwa/SalesPwaShell";

describe("SalesPwaShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = "/sales-pwa";
    global.fetch = buildFetchMock({
      "/api/employee/me": { body: { success: true, data: {} } },
      "/api/employee/announcements": { body: { unreadCount: 0 } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders without errors", () => {
    const { container } = render(
      <SalesPwaShell>
        <div>content</div>
      </SalesPwaShell>,
    );
    expect(container).toBeTruthy();
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders children via {children} prop", () => {
    render(
      <SalesPwaShell>
        <div data-testid="child">X</div>
      </SalesPwaShell>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toHaveTextContent("X");
  });

  it("shows employee name from /api/employee/me (apiSuccess wrapped)", async () => {
    global.fetch = buildFetchMock({
      "/api/employee/me": { body: { success: true, data: { name: "Ali" } } },
      "/api/employee/announcements": { body: { unreadCount: 0 } },
    });
    render(
      <SalesPwaShell>
        <div>x</div>
      </SalesPwaShell>,
    );
    await waitFor(() => {
      expect(screen.getByText("Ali")).toBeInTheDocument();
    });
  });

  it("falls back to email when name is missing", async () => {
    global.fetch = buildFetchMock({
      "/api/employee/me": {
        body: { success: true, data: { email: "e@x.com" } },
      },
      "/api/employee/announcements": { body: { unreadCount: 0 } },
    });
    render(
      <SalesPwaShell>
        <div>x</div>
      </SalesPwaShell>,
    );
    await waitFor(() => {
      expect(screen.getByText("e@x.com")).toBeInTheDocument();
    });
  });

  it("still renders header and no user chip when /api/employee/me fails", async () => {
    global.fetch = buildFetchMock({
      "/api/employee/me": { ok: false, body: { error: "unauthorized" } },
      "/api/employee/announcements": { body: { unreadCount: 0 } },
    });
    const { container } = render(
      <SalesPwaShell>
        <div>x</div>
      </SalesPwaShell>,
    );
    // Header is rendered
    expect(container.querySelector("header")).toBeInTheDocument();
    // Give the fetch promise a tick to settle
    await Promise.resolve();
    // Neither name nor email text appears — the brand header text does, but
    // no employee-name chip should be in the DOM.
    expect(screen.queryByText("Ali")).not.toBeInTheDocument();
    expect(screen.queryByText("e@x.com")).not.toBeInTheDocument();
  });

  it("shows unread announcements badge when unreadCount > 0", async () => {
    global.fetch = buildFetchMock({
      "/api/employee/me": { body: { success: true, data: {} } },
      "/api/employee/announcements": { body: { unreadCount: 3 } },
    });
    render(
      <SalesPwaShell>
        <div>x</div>
      </SalesPwaShell>,
    );
    await waitFor(() => {
      expect(
        screen.getByLabelText("3 إعلانات غير مقروءة"),
      ).toBeInTheDocument();
    });
    // Badge text is visible as "3"
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("does not render the unread badge when unreadCount = 0", async () => {
    global.fetch = buildFetchMock({
      "/api/employee/me": { body: { success: true, data: {} } },
      "/api/employee/announcements": { body: { unreadCount: 0 } },
    });
    const { container } = render(
      <SalesPwaShell>
        <div>x</div>
      </SalesPwaShell>,
    );
    // Let the two effects settle
    await Promise.resolve();
    await Promise.resolve();
    // No badge element (aria-label pattern "N إعلانات غير مقروءة")
    expect(
      container.querySelector('[aria-label$="إعلانات غير مقروءة"]'),
    ).toBeNull();
  });

  it("bottom nav on mobile has 5 tabs with correct hrefs", () => {
    render(
      <SalesPwaShell>
        <div>x</div>
      </SalesPwaShell>,
    );
    // The bottom nav is scoped to the one with "fixed inset-x-0" on md:hidden
    // — but the hrefs appear there plus the (desktop) sidebar plus the drawer,
    // so verify the full bottom-nav set exists by querying <a href="..."> for
    // each expected path.
    const expected = [
      "/sales-pwa",
      "/sales-pwa/new",
      "/sales-pwa/commissions",
      "/sales-pwa/calculator",
      "/sales-pwa/activity",
    ];
    for (const href of expected) {
      const anchors = document.querySelectorAll(`a[href="${href}"]`);
      expect(anchors.length).toBeGreaterThan(0);
    }
  });

  it("desktop sidebar exposes Corrections, Announcements, Docs in addition to bottom-nav items", () => {
    render(
      <SalesPwaShell>
        <div>x</div>
      </SalesPwaShell>,
    );
    // Sidebar-only items have these hrefs
    expect(
      document.querySelectorAll('a[href="/sales-pwa/corrections"]').length,
    ).toBeGreaterThan(0);
    expect(
      document.querySelectorAll('a[href="/sales-pwa/announcements"]').length,
    ).toBeGreaterThan(0);
    expect(
      document.querySelectorAll('a[href="/sales-pwa/docs"]').length,
    ).toBeGreaterThan(0);

    // Labels (from NAV) should be visible (at least once — sidebar renders them)
    expect(screen.getAllByText("طلبات التصحيح").length).toBeGreaterThan(0);
    expect(screen.getAllByText("الإعلانات").length).toBeGreaterThan(0);
    expect(screen.getAllByText("الوثائق").length).toBeGreaterThan(0);
  });

  it("highlights the active nav item on /sales-pwa/commissions with the emerald class", () => {
    mockPathname = "/sales-pwa/commissions";
    render(
      <SalesPwaShell>
        <div>x</div>
      </SalesPwaShell>,
    );
    // In the sidebar, the active Commissions link should carry the emerald bg class
    const commissionsLinks = Array.from(
      document.querySelectorAll('a[href="/sales-pwa/commissions"]'),
    ) as HTMLAnchorElement[];
    const hasActive = commissionsLinks.some((a) =>
      (a.className || "").includes("bg-emerald-500/15"),
    );
    expect(hasActive).toBe(true);

    // The bottom nav variant uses text-emerald-400 + aria-current=page
    const activeByAria = commissionsLinks.find(
      (a) => a.getAttribute("aria-current") === "page",
    );
    expect(activeByAria).toBeTruthy();
  });

  it("outermost div has dir=\"rtl\"", () => {
    const { container } = render(
      <SalesPwaShell>
        <div>x</div>
      </SalesPwaShell>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root).toHaveAttribute("dir", "rtl");
  });

  it("mobile-drawer toggle opens the drawer (close button becomes visible)", () => {
    render(
      <SalesPwaShell>
        <div>x</div>
      </SalesPwaShell>,
    );
    // Before click: "إغلاق القائمة" (drawer backdrop button) is not mounted
    expect(screen.queryByLabelText("إغلاق القائمة")).not.toBeInTheDocument();

    const toggle = screen.getByLabelText("فتح القائمة");
    fireEvent.click(toggle);

    // After click: drawer rendered — two new close-affordances appear
    expect(screen.getByLabelText("إغلاق القائمة")).toBeInTheDocument();
    expect(screen.getByLabelText("إغلاق")).toBeInTheDocument();
  });
});
