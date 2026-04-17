/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";
import { render, RenderOptions } from "@testing-library/react";
import React, { ReactElement } from "react";

// ───── Screen size ─────

export function mockUseScreen(size: "mobile" | "tablet" | "desktop") {
  const base = { width: 1024, height: 768 };
  if (size === "mobile") return { ...base, width: 375, height: 667, mobile: true, tablet: false, desktop: false, isMobile: true, isTablet: false, isDesktop: false };
  if (size === "tablet") return { ...base, width: 768, height: 1024, mobile: false, tablet: true, desktop: false, isMobile: false, isTablet: true, isDesktop: false };
  return { ...base, width: 1440, height: 900, mobile: false, tablet: false, desktop: true, isMobile: false, isTablet: false, isDesktop: true };
}

// ───── Router ─────

export function mockRouter(overrides: Partial<{
  push: any; replace: any; back: any; refresh: any; forward: any; prefetch: any;
  pathname: string; query: Record<string, string>; locale: string;
}> = {}) {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
    pathname: "/",
    query: {},
    locale: "ar",
    ...overrides,
  };
}

// ───── Params & searchParams ─────

export function mockParams(params: Record<string, string> = {}) {
  return params;
}

export function mockSearchParams(params: Record<string, string> = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) sp.set(k, v);
  return sp;
}

// ───── i18n ─────

export function mockI18n(lang: "ar" | "he" = "ar") {
  return {
    lang,
    setLang: vi.fn(),
    t: (k: string) => k,
    dir: "rtl" as const,
    fontClass: lang === "ar" ? "font-arabic" : "font-hebrew",
  };
}

// ───── Supabase provider ─────

export function mockSupabaseProvider({ user, data }: { user?: any; data?: Record<string, any> } = {}) {
  const effectiveUser = user ?? { id: "user-1", email: "admin@test.com" };
  const effectiveData = data ?? {};
  return {
    supabase: {
      from: vi.fn(() => effectiveData),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: effectiveUser }, error: null }) },
    },
    user: effectiveUser,
  };
}

// ───── renderWithProviders ─────

interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  lang?: "ar" | "he";
  initialRoute?: string;
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
) {
  const { lang = "ar", ...renderOpts } = options;

  // Minimal wrapper — most providers are mocked via vi.mock in the test file.
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(
      "div",
      { dir: "rtl", lang, className: lang === "ar" ? "font-arabic" : "font-hebrew" },
      children,
    );

  return render(ui, { wrapper: Wrapper, ...renderOpts });
}

// re-export testing-library helpers
export * from "@testing-library/react";
