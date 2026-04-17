import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/crm/inbox"),
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
vi.mock("@/components/crm/inbox", () => ({
  InboxLayout: () => <div data-testid="inbox-layout">Inbox Layout</div>,
}));

import InboxPage from "@/app/crm/inbox/page";

describe("InboxPage", () => {
  it("renders without errors", () => {
    const { container } = render(<InboxPage />);
    expect(container).toBeTruthy();
  });

  it("renders the InboxLayout component", () => {
    render(<InboxPage />);
    expect(screen.getByTestId("inbox-layout")).toBeInTheDocument();
  });

  it("has full height container", () => {
    const { container } = render(<InboxPage />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("h-[calc(100vh-64px)]");
  });
});
