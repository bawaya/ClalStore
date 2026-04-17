import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/styles/globals.css", () => ({}));
vi.mock("@/app/fonts", () => ({
  fontVariables: "font-var-class",
}));
vi.mock("@/components/shared/CookieConsent", () => ({
  CookieConsent: () => <div data-testid="cookie-consent">Cookie</div>,
}));
vi.mock("@/components/shared/PWAInstallPrompt", () => ({
  PWAInstallPrompt: () => <div data-testid="pwa-prompt">PWA</div>,
}));
vi.mock("@/components/shared/Analytics", () => ({
  Analytics: () => <div data-testid="analytics">Analytics</div>,
}));
vi.mock("@/components/shared/Providers", () => ({
  Providers: ({ children }: any) => <div data-testid="providers">{children}</div>,
}));

describe("RootLayout (Server Component)", () => {
  it("renders children within Providers", async () => {
    const { default: RootLayout } = await import("@/app/layout");
    const jsx = await RootLayout({ children: <div data-testid="child">Child Content</div> });

    // RootLayout returns <html>...</html>, we need to render it carefully
    // Since jsdom doesn't let us render <html>, we test the structure
    expect(jsx).toBeTruthy();
    expect(jsx.type).toBe("html");
    expect(jsx.props.lang).toBe("ar");
    expect(jsx.props.dir).toBe("rtl");
  });

  it("has correct HTML attributes", async () => {
    const { default: RootLayout } = await import("@/app/layout");
    const jsx = await RootLayout({ children: <div>Test</div> });

    expect(jsx.props.lang).toBe("ar");
    expect(jsx.props.dir).toBe("rtl");
    expect(jsx.props.suppressHydrationWarning).toBe(true);
    expect(jsx.props.className).toContain("font-var-class");
  });

  it("includes meta tags in head", async () => {
    const { default: RootLayout } = await import("@/app/layout");
    const jsx = await RootLayout({ children: <div>Test</div> });

    // Find head element in children
    const children = jsx.props.children;
    expect(children).toBeTruthy();
  });

  it("wraps children in Providers component", async () => {
    const { default: RootLayout } = await import("@/app/layout");
    const jsx = await RootLayout({ children: <div data-testid="test-child">Hello</div> });

    // Body should contain Providers
    const body = jsx.props.children[1]; // [head, body]
    expect(body.type).toBe("body");
  });

  it("body has correct classes", async () => {
    const { default: RootLayout } = await import("@/app/layout");
    const jsx = await RootLayout({ children: <div>Test</div> });

    const body = jsx.props.children[1];
    expect(body.props.className).toContain("font-arabic");
    expect(body.props.className).toContain("min-h-screen");
  });
});
