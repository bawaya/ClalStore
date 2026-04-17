import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/not-found"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  redirect: vi.fn(),
}));
vi.mock("@/lib/i18n", () => ({
  useLang: vi.fn(() => ({ lang: "ar", setLang: vi.fn(), t: (k: string) => k, dir: "rtl", fontClass: "font-arabic" })),
  LangProvider: ({ children }: any) => children,
}));
vi.mock("next/link", () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));

import NotFound from "@/app/not-found";

describe("NotFound (app/not-found.tsx)", () => {
  it("renders without errors", () => {
    const { container } = render(<NotFound />);
    expect(container).toBeTruthy();
  });

  it("renders the 404 heading", () => {
    render(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("renders the page not found message", () => {
    render(<NotFound />);
    expect(screen.getByText("errors.pageNotFound")).toBeInTheDocument();
    expect(screen.getByText("errors.pageNotFoundDesc")).toBeInTheDocument();
  });

  it("renders a link to the store", () => {
    render(<NotFound />);
    const storeLink = screen.getByText("errors.goStore");
    expect(storeLink).toBeInTheDocument();
    expect(storeLink.closest("a")).toHaveAttribute("href", "/store");
  });

  it("renders a link to the home page", () => {
    render(<NotFound />);
    const homeLink = screen.getByText("errors.goHome");
    expect(homeLink).toBeInTheDocument();
    expect(homeLink.closest("a")).toHaveAttribute("href", "/");
  });

  it("has RTL direction", () => {
    const { container } = render(<NotFound />);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("dir")).toBe("rtl");
  });

  it("has full height layout", () => {
    const { container } = render(<NotFound />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("min-h-screen");
  });

  it("is centered on the page", () => {
    const { container } = render(<NotFound />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("flex");
    expect(root.className).toContain("items-center");
    expect(root.className).toContain("justify-center");
  });
});
