import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} />,
}));
vi.mock("next/link", () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
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

const mockRemoveItem = vi.fn();
const mockClearAll = vi.fn();
let mockItems: any[] = [];

vi.mock("@/lib/store/compare", () => ({
  useCompare: () => ({
    items: mockItems,
    removeItem: mockRemoveItem,
    clearAll: mockClearAll,
  }),
  hydrateCompareStore: vi.fn(),
}));

import { CompareBar } from "@/components/store/CompareBar";

describe("CompareBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItems = [];
    mockUseScreen.mockReturnValue({ mobile: false, tablet: false, desktop: true, width: 1024 });
  });

  it("renders nothing when no items in compare", () => {
    const { container } = render(<CompareBar />);
    expect(container.firstChild).toBeNull();
  });

  it("renders bar when items exist", () => {
    mockItems = [
      { id: "1", name_ar: "ايفون 15", name_he: "iPhone 15", image_url: "https://example.com/1.jpg" },
    ];
    render(<CompareBar />);
    expect(screen.getByText("1/4")).toBeInTheDocument();
  });

  it("shows item count and compare button", () => {
    mockItems = [
      { id: "1", name_ar: "ايفون 15", name_he: "iPhone 15", image_url: null },
      { id: "2", name_ar: "سامسونج S24", name_he: "Samsung S24", image_url: null },
    ];
    render(<CompareBar />);
    expect(screen.getByText("2/4")).toBeInTheDocument();
    expect(screen.getByText(/compare.compare/)).toBeInTheDocument();
    expect(screen.getAllByText(/2/).length).toBeGreaterThan(0);
  });

  it("shows product thumbnails with images", () => {
    mockItems = [
      { id: "1", name_ar: "ايفون 15", name_he: "iPhone 15", image_url: "https://example.com/1.jpg" },
    ];
    render(<CompareBar />);
    const img = screen.getByAltText("iPhone 15");
    expect(img).toHaveAttribute("src", "https://example.com/1.jpg");
  });

  it("shows fallback emoji when no image_url", () => {
    mockItems = [
      { id: "1", name_ar: "ايفون 15", name_he: null, image_url: null },
    ];
    render(<CompareBar />);
    // The fallback is emoji text
    expect(screen.getByText(/📱/)).toBeInTheDocument();
  });

  it("shows clear all button", () => {
    mockItems = [
      { id: "1", name_ar: "ايفون 15", name_he: "iPhone 15", image_url: null },
    ];
    render(<CompareBar />);
    expect(screen.getByText("compare.clearAll")).toBeInTheDocument();
  });

  it("calls clearAll when clear button is clicked", () => {
    mockItems = [
      { id: "1", name_ar: "ايفون 15", name_he: "iPhone 15", image_url: null },
    ];
    render(<CompareBar />);
    fireEvent.click(screen.getByText("compare.clearAll"));
    expect(mockClearAll).toHaveBeenCalledTimes(1);
  });

  it("calls removeItem when remove button on item is clicked", () => {
    mockItems = [
      { id: "item-1", name_ar: "ايفون 15", name_he: "iPhone 15", image_url: null },
    ];
    render(<CompareBar />);
    const removeBtn = screen.getByLabelText("إزالة من المقارنة");
    fireEvent.click(removeBtn);
    expect(mockRemoveItem).toHaveBeenCalledWith("item-1");
  });

  it("links to /store/compare page", () => {
    mockItems = [
      { id: "1", name_ar: "ايفون 15", name_he: "iPhone 15", image_url: null },
    ];
    render(<CompareBar />);
    const link = screen.getByText(/compare.compare/).closest("a");
    expect(link).toHaveAttribute("href", "/store/compare");
  });

  it("renders mobile view", () => {
    mockUseScreen.mockReturnValue({ mobile: true, tablet: false, desktop: false, width: 375 });
    mockItems = [
      { id: "1", name_ar: "ايفون", name_he: "iPhone", image_url: null },
    ];
    render(<CompareBar />);
    expect(screen.getByText("1/4")).toBeInTheDocument();
  });
});
