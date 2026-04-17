import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/store"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  redirect: vi.fn(),
}));
vi.mock("@/lib/i18n", () => ({
  useLang: vi.fn(() => ({ lang: "ar", setLang: vi.fn(), t: (k: string) => k, dir: "rtl", fontClass: "font-arabic" })),
  LangProvider: ({ children }: any) => children,
}));
vi.mock("@/components/chat/WebChatWidget", () => ({
  WebChatWidget: () => <div data-testid="webchat-widget">Chat</div>,
}));
vi.mock("@/components/store/CompareBar", () => ({
  CompareBar: () => <div data-testid="compare-bar">Compare</div>,
}));

import StoreLayout from "@/app/store/layout";

describe("StoreLayout", () => {
  it("renders children", () => {
    render(
      <StoreLayout>
        <div data-testid="store-child">Store Content</div>
      </StoreLayout>
    );

    expect(screen.getByTestId("store-child")).toBeInTheDocument();
    expect(screen.getByText("Store Content")).toBeInTheDocument();
  });

  it("renders CompareBar component", () => {
    render(
      <StoreLayout>
        <div>Content</div>
      </StoreLayout>
    );

    expect(screen.getByTestId("compare-bar")).toBeInTheDocument();
  });

  it("renders WebChatWidget component", () => {
    render(
      <StoreLayout>
        <div>Content</div>
      </StoreLayout>
    );

    expect(screen.getByTestId("webchat-widget")).toBeInTheDocument();
  });

  it("renders children before CompareBar and WebChatWidget", () => {
    const { container } = render(
      <StoreLayout>
        <div data-testid="main-content">Main</div>
      </StoreLayout>
    );

    const allTestIds = container.querySelectorAll("[data-testid]");
    const testIdOrder = Array.from(allTestIds).map((el) => el.getAttribute("data-testid"));
    expect(testIdOrder.indexOf("main-content")).toBeLessThan(testIdOrder.indexOf("compare-bar"));
    expect(testIdOrder.indexOf("main-content")).toBeLessThan(testIdOrder.indexOf("webchat-widget"));
  });
});
