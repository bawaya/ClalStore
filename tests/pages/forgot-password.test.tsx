/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ForgotPasswordPage — kicks off the Supabase recovery flow.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// ─── Mocks ───────────────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/forgot-password"),
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

const resetPasswordForEmail = vi.fn();
// Page now does a dynamic `import("@/lib/supabase").requireBrowserSupabase()`,
// so expose both `requireBrowserSupabase` and the legacy `getSupabase` export.
vi.mock("@/lib/supabase", () => {
  const client = { auth: { resetPasswordForEmail } };
  return {
    requireBrowserSupabase: vi.fn(() => client),
    getSupabase: vi.fn(() => client),
  };
});

import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPasswordForEmail.mockReset();
  });

  it("renders the form with email input + submit button", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByTestId("logo")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("admin@clalmobile.co.il")).toBeInTheDocument();
    expect(screen.getByText("إرسال رابط إعادة التعيين")).toBeInTheDocument();
  });

  it("shows the subtitle 'استعادة كلمة المرور'", () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByText("استعادة كلمة المرور")).toBeInTheDocument();
  });

  it("includes a 'back to login' link", () => {
    render(<ForgotPasswordPage />);
    const link = screen.getByText("العودة لتسجيل الدخول");
    expect(link).toBeInTheDocument();
    expect(link.closest("a")).toHaveAttribute("href", "/login");
  });

  it("disables submit when email is empty", () => {
    render(<ForgotPasswordPage />);
    const btn = screen.getByText("إرسال رابط إعادة التعيين").closest("button");
    expect(btn).toBeDisabled();
  });

  it("enables submit when email is entered", () => {
    render(<ForgotPasswordPage />);
    const email = screen.getByPlaceholderText("admin@clalmobile.co.il");
    fireEvent.change(email, { target: { value: "test@example.com" } });
    const btn = screen.getByText("إرسال رابط إعادة التعيين").closest("button");
    expect(btn).not.toBeDisabled();
  });

  it("calls resetPasswordForEmail with redirectTo = origin/reset-password", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText("admin@clalmobile.co.il"), {
      target: { value: "user@example.com" },
    });
    fireEvent.submit(screen.getByRole("button").closest("form")!);

    await waitFor(() => {
      expect(resetPasswordForEmail).toHaveBeenCalledTimes(1);
    });

    const [emailArg, opts] = resetPasswordForEmail.mock.calls[0];
    expect(emailArg).toBe("user@example.com");
    expect(opts.redirectTo).toMatch(/\/reset-password$/);
  });

  it("shows the success confirmation panel after submit", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText("admin@clalmobile.co.il"), {
      target: { value: "user@example.com" },
    });
    fireEvent.submit(screen.getByRole("button").closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("تم الإرسال")).toBeInTheDocument();
    });
  });

  it("does NOT leak whether the email was registered (generic success on any error)", async () => {
    // Supabase returns an error when the email isn't registered — we treat
    // this the same as success in the UI to avoid enumeration attacks.
    resetPasswordForEmail.mockResolvedValue({
      error: { message: "User not found" },
    });
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText("admin@clalmobile.co.il"), {
      target: { value: "notarealuser@example.com" },
    });
    fireEvent.submit(screen.getByRole("button").closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("تم الإرسال")).toBeInTheDocument();
    });
  });

  it("surfaces rate-limit errors explicitly", async () => {
    resetPasswordForEmail.mockResolvedValue({
      error: { message: "Email rate limit exceeded" },
    });
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText("admin@clalmobile.co.il"), {
      target: { value: "user@example.com" },
    });
    fireEvent.submit(screen.getByRole("button").closest("form")!);

    await waitFor(() => {
      expect(
        screen.getByText(/لقد طلبت إعادة التعيين مؤخراً/),
      ).toBeInTheDocument();
    });
  });

  it("'إرسال لبريد آخر' resets the form", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText("admin@clalmobile.co.il"), {
      target: { value: "user@example.com" },
    });
    fireEvent.submit(screen.getByRole("button").closest("form")!);

    await waitFor(() => {
      expect(screen.getByText("تم الإرسال")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("إرسال لبريد آخر"));
    // Back to form view
    expect(screen.getByPlaceholderText("admin@clalmobile.co.il")).toBeInTheDocument();
  });
});
