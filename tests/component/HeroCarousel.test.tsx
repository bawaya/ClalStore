import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} />,
}));

const mockUseScreen = vi.fn(() => ({ mobile: false, tablet: false, desktop: true, width: 1024 }));
vi.mock("@/lib/hooks", () => ({
  useScreen: () => mockUseScreen(),
}));

vi.mock("@/lib/i18n", () => ({
  useLang: vi.fn(() => ({
    lang: "ar",
    setLang: vi.fn(),
    t: (k: string) => k,
    dir: "rtl",
    fontClass: "font-arabic",
  })),
}));

import { HeroCarousel } from "@/components/store/HeroCarousel";
import type { Hero } from "@/types/database";

const mockHeroes: Hero[] = [
  {
    id: "h1",
    title_ar: "عروض الصيف",
    title_he: "מבצעי קיץ",
    subtitle_ar: "خصومات حتى 40%",
    subtitle_he: "הנחות עד 40%",
    image_url: "https://example.com/hero1.jpg",
    link_url: "",
    cta_text_ar: "تسوّق الآن",
    cta_text_he: "קנה עכשיו",
    sort_order: 1,
    active: true,
    created_at: "",
  },
  {
    id: "h2",
    title_ar: "iPhone 17 وصل!",
    title_he: "iPhone 17 הגיע!",
    subtitle_ar: "اطلب الآن",
    subtitle_he: "הזמן עכשיו",
    image_url: "https://example.com/hero.jpg",
    link_url: "",
    cta_text_ar: "اطلب الآن",
    cta_text_he: "הזמן עכשיו",
    sort_order: 2,
    active: true,
    created_at: "",
  },
];

describe("HeroCarousel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUseScreen.mockReturnValue({ mobile: false, tablet: false, desktop: true, width: 1024 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders without crashing", () => {
    render(<HeroCarousel heroes={mockHeroes} />);
    expect(screen.getAllByText("عروض الصيف").length).toBeGreaterThan(0);
  });

  it("displays first hero title and subtitle", () => {
    render(<HeroCarousel heroes={mockHeroes} />);
    // Title appears twice (heading + image-overlay caption); subtitle once.
    expect(screen.getAllByText("عروض الصيف").length).toBeGreaterThan(0);
    expect(screen.getByText("خصومات حتى 40%")).toBeInTheDocument();
  });

  it("displays CTA button text", () => {
    render(<HeroCarousel heroes={mockHeroes} />);
    expect(screen.getByText("تسوّق الآن")).toBeInTheDocument();
  });

  it("shows fallback heroes when no heroes are passed", () => {
    render(<HeroCarousel />);
    // Should show fallback heroes from the component
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toBeInTheDocument();
  });

  it("shows fallback heroes when empty array is passed", () => {
    render(<HeroCarousel heroes={[]} />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toBeInTheDocument();
  });

  it("shows dot indicators for multiple heroes", () => {
    render(<HeroCarousel heroes={mockHeroes} />);
    // Dots use numeric aria-labels: "1", "2".
    expect(screen.getByLabelText("1")).toBeInTheDocument();
    expect(screen.getByLabelText("2")).toBeInTheDocument();
  });

  it("changes slide when dot is clicked", () => {
    render(<HeroCarousel heroes={mockHeroes} />);
    const dot2 = screen.getByLabelText("2");
    fireEvent.click(dot2);
    expect(screen.getAllByText("iPhone 17 وصل!").length).toBeGreaterThan(0);
    expect(screen.getAllByText("اطلب الآن").length).toBeGreaterThan(0);
  });

  it("auto-advances after 5 seconds", () => {
    render(<HeroCarousel heroes={mockHeroes} />);
    expect(screen.getAllByText("عروض الصيف").length).toBeGreaterThan(0);
    act(() => {
      vi.advanceTimersByTime(5100);
    });
    expect(screen.getAllByText("iPhone 17 وصل!").length).toBeGreaterThan(0);
  });

  it("wraps around after last slide", () => {
    render(<HeroCarousel heroes={mockHeroes} />);
    act(() => {
      vi.advanceTimersByTime(5100);
    });
    expect(screen.getAllByText("iPhone 17 وصل!").length).toBeGreaterThan(0);
    act(() => {
      vi.advanceTimersByTime(5100);
    });
    expect(screen.getAllByText("عروض الصيف").length).toBeGreaterThan(0);
  });

  it("does not show dots for single hero", () => {
    render(<HeroCarousel heroes={[mockHeroes[0]]} />);
    expect(screen.queryByLabelText("1")).not.toBeInTheDocument();
  });

  it("shows hero image when image_url exists", () => {
    render(<HeroCarousel heroes={mockHeroes} />);
    fireEvent.click(screen.getByLabelText("2"));
    const img = screen.getByAltText("iPhone 17 وصل!");
    expect(img).toBeInTheDocument();
  });

  it("renders mobile view", () => {
    mockUseScreen.mockReturnValue({ mobile: true, tablet: false, desktop: false, width: 375 });
    render(<HeroCarousel heroes={mockHeroes} />);
    expect(screen.getAllByText("عروض الصيف").length).toBeGreaterThan(0);
  });
});
