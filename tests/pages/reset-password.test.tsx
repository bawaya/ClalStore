/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ResetPasswordPage — target of the Supabase recovery email link.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ─── Mocks ───────────────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/reset-password"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
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

const getSession = vi.fn();
const updateUser = vi.fn();
const onAuthStateChange = vi.fn((_cb: unknown) => ({
  subscription: { unsubscribe: vi.fn() },
}));

vi.mock("@/lib/supabase", () => ({
  getSupabase: vi.fn(() => ({
    auth: { getSession, updateUser, onAuthStateChange },
  })),
}));

import ResetPasswordPage from "@/app/(auth)/reset-password/page";

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockReset();
    updateUser.mockReset();
    onAuthStateChange.mockReset();
    onAuthStateChange.mockImplementation(() => ({
      subscription: { unsubscribe: vi.fn() },
    }));
  });

  it("shows 'invalid link' when no recovery session is present", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    render(<ResetPasswordPage />);
    // First render of this component does a dynamic import of
    // `@/lib/supabase` + a 300ms handshake, so cold-start can push past
    // the default 1s waitFor. 10s is generous for CI.
    await waitFor(
      () => {
        expect(
          screen.getByText("الرابط غير صالح أو انتهت صلاحيته"),
        ).toBeInTheDocument();
      },
      { timeout: 10_000 },
    );
  }, 15_000);

  it("'invalid link' screen links to /forgot-password", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    render(<ResetPasswordPage />);
    await waitFor(() => {
      const link = screen.getByText("طلب رابط جديد");
      expect(link.closest("a")).toHaveAttribute("href", "/forgot-password");
    });
  });

  it("shows the password form when recovery session exists", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "tok", user: { id: "u1" } } },
    });
    render(<ResetPasswordPage />);
    await waitFor(() => {
      expect(screen.getByText("تعيين كلمة المرور")).toBeInTheDocument();
    });
  });

  it("enforces password strength rules (min 8, uppercase, number, match)", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "tok" } },
    });
    render(<ResetPasswordPage />);
    await waitFor(() =>
      expect(screen.getByText("تعيين كلمة المرور")).toBeInTheDocument(),
    );

    const [newP, confirmP] = screen.getAllByPlaceholderText("••••••••");
    const btn = screen.getByText("تعيين كلمة المرور").closest("button")!;

    // Too short
    fireEvent.change(newP, { target: { value: "Abc1" } });
    fireEvent.change(confirmP, { target: { value: "Abc1" } });
    expect(btn).toBeDisabled();

    // No uppercase
    fireEvent.change(newP, { target: { value: "password1" } });
    fireEvent.change(confirmP, { target: { value: "password1" } });
    expect(btn).toBeDisabled();

    // No number
    fireEvent.change(newP, { target: { value: "Password" } });
    fireEvent.change(confirmP, { target: { value: "Password" } });
    expect(btn).toBeDisabled();

    // Mismatch
    fireEvent.change(newP, { target: { value: "Password1" } });
    fireEvent.change(confirmP, { target: { value: "Password2" } });
    expect(btn).toBeDisabled();

    // All good
    fireEvent.change(newP, { target: { value: "Password1" } });
    fireEvent.change(confirmP, { target: { value: "Password1" } });
    expect(btn).not.toBeDisabled();
  });

  it("calls supabase.auth.updateUser on submit and redirects on success", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "tok" } },
    });
    updateUser.mockResolvedValue({ error: null });

    // Intercept navigation
    delete (window as any).location;
    (window as any).location = { href: "" };

    render(<ResetPasswordPage />);
    await waitFor(() =>
      expect(screen.getByText("تعيين كلمة المرور")).toBeInTheDocument(),
    );

    const [newP, confirmP] = screen.getAllByPlaceholderText("••••••••");
    fireEvent.change(newP, { target: { value: "Password1" } });
    fireEvent.change(confirmP, { target: { value: "Password1" } });
    fireEvent.submit(newP.closest("form")!);

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ password: "Password1" });
    });
    await waitFor(() => {
      expect((window as any).location.href).toBe("/login?reset=success");
    });
  });

  it("shows 'link expired' error for expired recovery tokens", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "tok" } },
    });
    updateUser.mockResolvedValue({
      error: { message: "Token has expired" },
    });

    render(<ResetPasswordPage />);
    await waitFor(() =>
      expect(screen.getByText("تعيين كلمة المرور")).toBeInTheDocument(),
    );

    const [newP, confirmP] = screen.getAllByPlaceholderText("••••••••");
    fireEvent.change(newP, { target: { value: "Password1" } });
    fireEvent.change(confirmP, { target: { value: "Password1" } });
    fireEvent.submit(newP.closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/الرابط انتهت صلاحيته/)).toBeInTheDocument();
    });
  });

  it("subscribes to PASSWORD_RECOVERY auth event", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    render(<ResetPasswordPage />);
    await waitFor(() => {
      expect(onAuthStateChange).toHaveBeenCalled();
    });
  });

  // The "loader while checking" test is placed last because it leaves
  // getSession as a never-resolving promise; running it early was causing
  // module-level caching in @supabase/ssr to keep stale state into the
  // next render and return `{session: truthy}` unexpectedly.
  it("shows loader while checking session", () => {
    getSession.mockReturnValue(new Promise(() => {})); // never resolves
    render(<ResetPasswordPage />);
    expect(screen.getByText("جاري التحقق...")).toBeInTheDocument();
  });
});
