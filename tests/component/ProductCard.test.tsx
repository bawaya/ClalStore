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

const mockAddItem = vi.fn();
vi.mock("@/lib/store/cart", () => ({
  useCart: (selector: any) => {
    const state = { addItem: mockAddItem };
    return selector(state);
  },
}));

const mockAddToCompare = vi.fn(() => true);
const mockRemoveFromCompare = vi.fn();
let mockInCompare = false;
vi.mock("@/lib/store/compare", () => ({
  useCompare: (selector: any) => {
    const state = {
      addItem: mockAddToCompare,
      removeItem: mockRemoveFromCompare,
      items: mockInCompare ? [{ id: "prod-1" }] : [],
    };
    return selector(state);
  },
}));

const mockAddToWishlist = vi.fn();
const mockRemoveFromWishlist = vi.fn();
let mockInWishlist = false;
vi.mock("@/lib/store/wishlist", () => ({
  useWishlist: (selector: any) => {
    const state = {
      addItem: mockAddToWishlist,
      removeItem: mockRemoveFromWishlist,
      items: mockInWishlist ? [{ id: "prod-1" }] : [],
    };
    return selector(state);
  },
}));

vi.mock("@/lib/utils", () => ({
  calcDiscount: (price: number, old: number) => Math.round(((old - price) / old) * 100),
  getProductName: (p: any, lang: string) => lang === "he" ? (p.name_he || p.name_ar) : p.name_ar,
  getColorName: (c: any, lang: string) => lang === "he" ? (c.name_he || c.name_ar) : c.name_ar,
  getDescription: (p: any, lang: string) => lang === "he" ? (p.description_he || p.description_ar) : p.description_ar,
}));

vi.mock("@/lib/brand-logos", () => ({
  getBrandLogo: () => null,
}));

import { ProductCard } from "@/components/store/ProductCard";

const baseProduct = {
  id: "prod-1",
  name_ar: "ايفون 15",
  name_he: "iPhone 15",
  brand: "Apple",
  type: "device" as const,
  price: 3500,
  old_price: 4000,
  stock: 10,
  image_url: "https://example.com/phone.jpg",
  featured: false,
  colors: [],
  storage_options: [],
  variants: [],
  specs: null,
  gallery: [],
  description_ar: "جهاز ايفون 15 الجديد",
  description_he: null,
  category_id: null,
  sort_order: 0,
  active: true,
  created_at: "",
};

describe("ProductCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInCompare = false;
    mockInWishlist = false;
    mockUseScreen.mockReturnValue({ mobile: false, tablet: false, desktop: true, width: 1024 });
  });

  it("renders without crashing", () => {
    render(<ProductCard product={baseProduct as any} />);
    expect(screen.getByText("ايفون 15")).toBeInTheDocument();
  });

  it("displays product name", () => {
    render(<ProductCard product={baseProduct as any} />);
    expect(screen.getByText("ايفون 15")).toBeInTheDocument();
  });

  it("displays brand name", () => {
    render(<ProductCard product={baseProduct as any} />);
    expect(screen.getByText("Apple")).toBeInTheDocument();
  });

  it("displays price", () => {
    render(<ProductCard product={baseProduct as any} />);
    expect(screen.getByText(/3,500/)).toBeInTheDocument();
  });

  it("displays old price with strikethrough", () => {
    render(<ProductCard product={baseProduct as any} />);
    expect(screen.getByText(/4,000/)).toBeInTheDocument();
  });

  it("shows discount badge when old_price exists", () => {
    render(<ProductCard product={baseProduct as any} />);
    expect(screen.getByText(/-13%/)).toBeInTheDocument();
  });

  it("shows product image", () => {
    render(<ProductCard product={baseProduct as any} />);
    const img = screen.getByAltText("ايفون 15");
    expect(img).toHaveAttribute("src", "https://example.com/phone.jpg");
  });

  it("links to product detail page", () => {
    render(<ProductCard product={baseProduct as any} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/store/product/prod-1");
  });

  it("shows in-stock indicator when stock > 5", () => {
    render(<ProductCard product={baseProduct as any} />);
    expect(screen.getByText("store.inStock", { exact: false })).toBeInTheDocument();
  });

  it("shows out-of-stock indicator when stock is 0", () => {
    const outOfStock = { ...baseProduct, stock: 0, variants: [] };
    render(<ProductCard product={outOfStock as any} />);
    expect(screen.getByText("store.outOfStock", { exact: false })).toBeInTheDocument();
  });

  it("shows low stock warning when stock <= 5", () => {
    const lowStock = { ...baseProduct, stock: 3, variants: [] };
    render(<ProductCard product={lowStock as any} />);
    expect(screen.getByText(/باقي 3 قطع/)).toBeInTheDocument();
  });

  it("shows add to cart button", () => {
    render(<ProductCard product={baseProduct as any} />);
    expect(screen.getByText("store.addToCart")).toBeInTheDocument();
  });

  it("calls addItem when add to cart is clicked (no selection needed)", () => {
    render(<ProductCard product={baseProduct as any} />);
    const addBtn = screen.getByText("store.addToCart");
    fireEvent.click(addBtn);
    expect(mockAddItem).toHaveBeenCalledTimes(1);
  });

  it("shows wishlist button", () => {
    render(<ProductCard product={baseProduct as any} />);
    const wishBtn = screen.getByLabelText("wishlist.add");
    expect(wishBtn).toBeInTheDocument();
  });

  it("toggles wishlist on click", () => {
    render(<ProductCard product={baseProduct as any} />);
    const wishBtn = screen.getByLabelText("wishlist.add");
    fireEvent.click(wishBtn);
    expect(mockAddToWishlist).toHaveBeenCalledTimes(1);
  });

  it("shows compare button", () => {
    render(<ProductCard product={baseProduct as any} />);
    const compareBtn = screen.getByLabelText("compare.add");
    expect(compareBtn).toBeInTheDocument();
  });

  it("adds to compare on click", () => {
    render(<ProductCard product={baseProduct as any} />);
    const compareBtn = screen.getByLabelText("compare.add");
    fireEvent.click(compareBtn);
    expect(mockAddToCompare).toHaveBeenCalledTimes(1);
  });

  it("shows storage options when available", () => {
    const withStorage = {
      ...baseProduct,
      storage_options: ["128GB", "256GB"],
      variants: [
        { storage: "128GB", price: 3500, old_price: 4000, stock: 5 },
        { storage: "256GB", price: 4000, old_price: 4500, stock: 3 },
      ],
    };
    render(<ProductCard product={withStorage as any} />);
    expect(screen.getByText("128GB")).toBeInTheDocument();
    expect(screen.getByText("256GB")).toBeInTheDocument();
  });

  it("shows color swatches when colors are available", () => {
    const withColors = {
      ...baseProduct,
      colors: [
        { hex: "#000000", name_ar: "اسود", name_he: "שחור", image: null },
        { hex: "#ffffff", name_ar: "ابيض", name_he: "לבן", image: null },
      ],
    };
    render(<ProductCard product={withColors as any} />);
    const blackSwatch = screen.getByLabelText("اسود");
    const whiteSwatch = screen.getByLabelText("ابيض");
    expect(blackSwatch).toBeInTheDocument();
    expect(whiteSwatch).toBeInTheDocument();
  });

  it("disables add to cart when color selection is incomplete", () => {
    const withColors = {
      ...baseProduct,
      colors: [
        { hex: "#000000", name_ar: "اسود", name_he: "שחור", image: null },
        { hex: "#ffffff", name_ar: "ابيض", name_he: "לבן", image: null },
      ],
    };
    render(<ProductCard product={withColors as any} />);
    const addBtn = screen.getByText("store.addToCart");
    expect(addBtn).toBeDisabled();
    expect(screen.getByText("store.selectColor")).toBeInTheDocument();
  });

  it("shows free shipping badge when product is featured", () => {
    const featured = { ...baseProduct, featured: true };
    render(<ProductCard product={featured as any} />);
    expect(screen.getByText("store.freeShipping", { exact: false })).toBeInTheDocument();
  });

  it("renders mobile view", () => {
    mockUseScreen.mockReturnValue({ mobile: true, tablet: false, desktop: false, width: 375 });
    render(<ProductCard product={baseProduct as any} />);
    expect(screen.getByText("ايفون 15")).toBeInTheDocument();
  });

  it("shows monthly payment for device type", () => {
    render(<ProductCard product={baseProduct as any} />);
    expect(screen.getByText(/× 36/)).toBeInTheDocument();
  });
});
