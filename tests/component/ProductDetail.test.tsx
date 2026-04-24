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
  useToast: () => ({ toasts: [], show: vi.fn() }),
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

vi.mock("@/lib/store/compare", () => ({
  useCompare: (selector: any) => {
    const state = { addItem: vi.fn(() => true), removeItem: vi.fn(), items: [] };
    return selector(state);
  },
}));

vi.mock("@/lib/store/wishlist", () => ({
  useWishlist: (selector: any) => {
    const state = { addItem: vi.fn(), removeItem: vi.fn(), items: [] };
    return selector(state);
  },
}));

vi.mock("@/lib/utils", () => ({
  calcDiscount: (price: number, old: number) => Math.round(((old - price) / old) * 100),
  getProductName: (p: any, lang: string) => lang === "he" ? (p.name_he || p.name_ar) : p.name_ar,
  getColorName: (c: any, lang: string) => lang === "he" ? (c.name_he || c.name_ar) : c.name_ar,
  getDescription: (p: any, lang: string) => p.description_ar,
}));

vi.mock("@/lib/brand-logos", () => ({
  getBrandLogo: () => null,
}));

vi.mock("@/components/shared/Analytics", () => ({
  trackAddToCart: vi.fn(),
  trackViewProduct: vi.fn(),
}));

vi.mock("@/components/store/StoreHeader", () => ({
  StoreHeader: () => <div data-testid="store-header">Header</div>,
}));

vi.mock("@/components/store/StickyCartBar", () => ({
  StickyCartBar: () => <div data-testid="sticky-cart-bar">Cart Bar</div>,
}));

vi.mock("@/components/store/ProductCard", () => ({
  ProductCard: ({ product }: any) => <div data-testid="product-card">{product.name_ar}</div>,
}));

vi.mock("@/components/store/ProductReviews", () => ({
  ProductReviews: () => <div data-testid="product-reviews">Reviews</div>,
}));

vi.mock("@/components/website/sections", () => ({
  Footer: () => <div data-testid="footer">Footer</div>,
}));

vi.mock("@/components/ui/Toast", () => ({
  ToastContainer: () => <div data-testid="toast-container" />,
}));

import { ProductDetailClient } from "@/components/store/ProductDetail";

const baseProduct = {
  id: "prod-1",
  name_ar: "ايفون 15 برو",
  name_he: "iPhone 15 Pro",
  brand: "Apple",
  type: "device",
  price: 4500,
  old_price: 5000,
  stock: 10,
  image_url: "https://example.com/iphone.jpg",
  featured: false,
  colors: [],
  storage_options: [],
  variants: [],
  specs: { screen: "6.1 inches", camera: "48 MP", battery: "3274 mAh" },
  gallery: [],
  description_ar: "ايفون 15 برو الجديد من آبل",
  description_he: null,
  category_id: null,
  sort_order: 0,
  active: true,
  created_at: "",
};

describe("ProductDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseScreen.mockReturnValue({ mobile: false, tablet: false, desktop: true, width: 1024 });
  });

  it("renders without crashing", () => {
    render(<ProductDetailClient product={baseProduct as any} related={[]} />);
    expect(screen.getByText("ايفون 15 برو")).toBeInTheDocument();
  });

  it("displays product name as heading", () => {
    render(<ProductDetailClient product={baseProduct as any} related={[]} />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("ايفون 15 برو");
  });

  it("displays brand name", () => {
    render(<ProductDetailClient product={baseProduct as any} related={[]} />);
    expect(screen.getByText("Apple")).toBeInTheDocument();
  });

  it("displays price", () => {
    render(<ProductDetailClient product={baseProduct as any} related={[]} />);
    expect(screen.getByText(/4,500/)).toBeInTheDocument();
  });

  it("shows old price and discount badge", () => {
    render(<ProductDetailClient product={baseProduct as any} related={[]} />);
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
    expect(screen.getByText(/-10%/)).toBeInTheDocument();
  });

  it("shows product image", () => {
    render(<ProductDetailClient product={baseProduct as any} related={[]} />);
    const img = screen.getByAltText("ايفون 15 برو");
    expect(img).toBeInTheDocument();
  });

  it("displays specifications", () => {
    render(<ProductDetailClient product={baseProduct as any} related={[]} />);
    expect(screen.getByText("detail.specs")).toBeInTheDocument();
    expect(screen.getByText("6.1 inches")).toBeInTheDocument();
    expect(screen.getByText("48 MP")).toBeInTheDocument();
  });

  it("shows add to cart button", () => {
    render(<ProductDetailClient product={baseProduct as any} related={[]} />);
    const addBtn = screen.getByRole("button", { name: /store.addToCart/i });
    expect(addBtn).toBeInTheDocument();
  });

  it("shows description section", () => {
    render(<ProductDetailClient product={baseProduct as any} related={[]} />);
    expect(screen.getByText("detail.description")).toBeInTheDocument();
    expect(screen.getByText("ايفون 15 برو الجديد من آبل")).toBeInTheDocument();
  });

  it("renders header, cart bar, and footer", () => {
    render(<ProductDetailClient product={baseProduct as any} related={[]} />);
    expect(screen.getByTestId("store-header")).toBeInTheDocument();
    expect(screen.getByTestId("sticky-cart-bar")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("shows related products when provided", () => {
    const related = [{ ...baseProduct, id: "prod-2", name_ar: "ايفون 14" }];
    render(<ProductDetailClient product={baseProduct as any} related={related as any} />);
    expect(screen.getByText("detail.similar")).toBeInTheDocument();
    expect(screen.getByTestId("product-card")).toBeInTheDocument();
  });

  it("does not show related section when no related products", () => {
    render(<ProductDetailClient product={baseProduct as any} related={[]} />);
    expect(screen.queryByText("detail.similar")).not.toBeInTheDocument();
  });

  it("shows color selection when colors are available", () => {
    const withColors = {
      ...baseProduct,
      colors: [
        { hex: "#000000", name_ar: "اسود", name_he: "שחור", image: null },
        { hex: "#ffffff", name_ar: "ابيض", name_he: "לבן", image: null },
      ],
    };
    render(<ProductDetailClient product={withColors as any} related={[]} />);
    expect(screen.getByText("detail.color", { exact: false })).toBeInTheDocument();
  });

  it("shows storage selection when storage options exist", () => {
    const withStorage = {
      ...baseProduct,
      storage_options: ["128GB", "256GB"],
      variants: [
        { storage: "128GB", price: 4500, old_price: 5000, stock: 5 },
        { storage: "256GB", price: 5200, old_price: 5800, stock: 3 },
      ],
    };
    render(<ProductDetailClient product={withStorage as any} related={[]} />);
    expect(screen.getByText("detail.storage")).toBeInTheDocument();
    expect(screen.getByText("128GB")).toBeInTheDocument();
    expect(screen.getByText("256GB")).toBeInTheDocument();
  });

  it("shows out of stock message when stock is 0", () => {
    const noStock = { ...baseProduct, stock: 0, variants: [] };
    render(<ProductDetailClient product={noStock as any} related={[]} />);
    expect(screen.getByText("store.outOfStock")).toBeInTheDocument();
  });

  it("disables add to cart when stock is 0", () => {
    const noStock = { ...baseProduct, stock: 0, variants: [] };
    render(<ProductDetailClient product={noStock as any} related={[]} />);
    const addBtn = screen.getByRole("button", { name: /detail.unavailable/i });
    expect(addBtn).toBeDisabled();
  });

  it("shows device note for device products", () => {
    render(<ProductDetailClient product={baseProduct as any} related={[]} />);
    expect(screen.getByText("detail.deviceNote")).toBeInTheDocument();
  });

  it("shows accessory note for accessory products", () => {
    const accessory = { ...baseProduct, type: "accessory" };
    render(<ProductDetailClient product={accessory as any} related={[]} />);
    expect(screen.getByText("detail.accessoryNote")).toBeInTheDocument();
  });

  it("renders mobile layout", () => {
    mockUseScreen.mockReturnValue({ mobile: true, tablet: false, desktop: false, width: 375 });
    render(<ProductDetailClient product={baseProduct as any} related={[]} />);
    expect(screen.getByText("ايفون 15 برو")).toBeInTheDocument();
  });

  it("shows monthly payment for device type when variant has monthly_price", () => {
    const withMonthly = {
      ...baseProduct,
      storage_options: ["256GB"],
      variants: [
        { storage: "256GB", price: 4500, old_price: 5000, monthly_price: 125, stock: 10 },
      ],
    };
    render(<ProductDetailClient product={withMonthly as any} related={[]} />);
    expect(screen.getByText(/× 36/)).toBeInTheDocument();
  });
});
