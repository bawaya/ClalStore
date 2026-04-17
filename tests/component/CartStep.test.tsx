import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => "/store/cart"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
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
let mockItems: any[] = [];
let mockSubtotal = 0;
let mockTotal = 0;
let mockDiscountAmount = 0;
let mockHasDevices = false;
let mockOnlyAccessories = false;

vi.mock("@/lib/store/cart", () => ({
  useCart: (selector: any) => {
    const state = {
      items: mockItems,
      getSubtotal: () => mockSubtotal,
      getTotal: () => mockTotal,
      discountAmount: mockDiscountAmount,
      hasDevices: () => mockHasDevices,
      hasOnlyAccessories: () => mockOnlyAccessories,
      removeItem: mockRemoveItem,
    };
    return selector(state);
  },
}));

import { CartStep } from "@/components/store/cart/CartStep";

const defaultProps = {
  couponInput: "",
  setCouponInput: vi.fn(),
  onApplyCoupon: vi.fn(),
  onNext: vi.fn(),
};

describe("CartStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockItems = [];
    mockSubtotal = 0;
    mockTotal = 0;
    mockDiscountAmount = 0;
    mockHasDevices = false;
    mockOnlyAccessories = false;
    mockUseScreen.mockReturnValue({ mobile: false, tablet: false, desktop: true, width: 1024 });
  });

  it("renders without crashing", () => {
    render(<CartStep {...defaultProps} />);
    expect(screen.getAllByText(/السلة/).length).toBeGreaterThan(0);
  });

  it("shows empty cart message when no items", () => {
    render(<CartStep {...defaultProps} />);
    expect(screen.getByText("السلة فاضية")).toBeInTheDocument();
    expect(screen.getByText("تصفّح المنتجات")).toBeInTheDocument();
  });

  it("displays cart items when they exist", () => {
    mockItems = [
      {
        cartId: "c1",
        productId: "p1",
        name: "ايفون 15",
        name_he: "iPhone 15",
        brand: "Apple",
        type: "device",
        price: 3500,
        color: "اسود",
        color_he: "שחור",
        storage: "128GB",
      },
    ];
    mockSubtotal = 3500;
    mockTotal = 3500;
    render(<CartStep {...defaultProps} />);
    expect(screen.getByText("ايفون 15")).toBeInTheDocument();
    expect(screen.getByText(/Apple/)).toBeInTheDocument();
    expect(screen.getAllByText(/3,500/).length).toBeGreaterThan(0);
  });

  it("shows item count in header", () => {
    mockItems = [
      { cartId: "c1", productId: "p1", name: "ايفون 15", brand: "Apple", type: "device", price: 3500 },
      { cartId: "c2", productId: "p2", name: "كفر", brand: "Samsung", type: "accessory", price: 50 },
    ];
    mockSubtotal = 3550;
    mockTotal = 3550;
    render(<CartStep {...defaultProps} />);
    expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
  });

  it("calls removeItem when delete button is clicked", () => {
    mockItems = [
      { cartId: "c1", productId: "p1", name: "ايفون 15", brand: "Apple", type: "device", price: 3500 },
    ];
    mockSubtotal = 3500;
    mockTotal = 3500;
    render(<CartStep {...defaultProps} />);
    const deleteBtn = screen.getByLabelText("حذف المنتج");
    fireEvent.click(deleteBtn);
    expect(mockRemoveItem).toHaveBeenCalledWith("c1");
  });

  it("shows coupon input", () => {
    mockItems = [
      { cartId: "c1", productId: "p1", name: "ايفون 15", brand: "Apple", type: "device", price: 3500 },
    ];
    mockSubtotal = 3500;
    mockTotal = 3500;
    render(<CartStep {...defaultProps} />);
    expect(screen.getByLabelText("كود الخصم")).toBeInTheDocument();
  });

  it("calls onApplyCoupon when apply button is clicked", () => {
    mockItems = [
      { cartId: "c1", productId: "p1", name: "ايفون 15", brand: "Apple", type: "device", price: 3500 },
    ];
    mockSubtotal = 3500;
    mockTotal = 3500;
    render(<CartStep {...defaultProps} />);
    fireEvent.click(screen.getByText("تطبيق"));
    expect(defaultProps.onApplyCoupon).toHaveBeenCalledTimes(1);
  });

  it("shows discount amount when applied", () => {
    mockItems = [
      { cartId: "c1", productId: "p1", name: "ايفون 15", brand: "Apple", type: "device", price: 3500 },
    ];
    mockSubtotal = 3500;
    mockTotal = 3300;
    mockDiscountAmount = 200;
    render(<CartStep {...defaultProps} />);
    expect(screen.getByText(/خصم: -₪200/)).toBeInTheDocument();
  });

  it("shows device warning when cart has devices", () => {
    mockItems = [
      { cartId: "c1", productId: "p1", name: "ايفون 15", brand: "Apple", type: "device", price: 3500 },
    ];
    mockSubtotal = 3500;
    mockTotal = 3500;
    mockHasDevices = true;
    render(<CartStep {...defaultProps} />);
    expect(screen.getByText(/سلتك تحتوي جهاز/)).toBeInTheDocument();
  });

  it("shows accessories-only message when applicable", () => {
    mockItems = [
      { cartId: "c1", productId: "p1", name: "كفر", brand: "Samsung", type: "accessory", price: 50 },
    ];
    mockSubtotal = 50;
    mockTotal = 50;
    mockOnlyAccessories = true;
    render(<CartStep {...defaultProps} />);
    expect(screen.getByText(/إكسسوارات فقط/)).toBeInTheDocument();
  });

  it("shows total and subtotal", () => {
    mockItems = [
      { cartId: "c1", productId: "p1", name: "ايفون 15", brand: "Apple", type: "device", price: 3500 },
    ];
    mockSubtotal = 3500;
    mockTotal = 3500;
    render(<CartStep {...defaultProps} />);
    expect(screen.getByText("المجموع")).toBeInTheDocument();
    expect(screen.getByText("المنتجات")).toBeInTheDocument();
  });

  it("calls onNext when continue button is clicked", () => {
    mockItems = [
      { cartId: "c1", productId: "p1", name: "ايفون 15", brand: "Apple", type: "device", price: 3500 },
    ];
    mockSubtotal = 3500;
    mockTotal = 3500;
    render(<CartStep {...defaultProps} />);
    fireEvent.click(screen.getByText("المتابعة للشراء →"));
    expect(defaultProps.onNext).toHaveBeenCalledTimes(1);
  });

  it("renders mobile view", () => {
    mockUseScreen.mockReturnValue({ mobile: true, tablet: false, desktop: false, width: 375 });
    mockItems = [
      { cartId: "c1", productId: "p1", name: "ايفون 15", brand: "Apple", type: "device", price: 3500 },
    ];
    mockSubtotal = 3500;
    mockTotal = 3500;
    render(<CartStep {...defaultProps} />);
    expect(screen.getByText("ايفون 15")).toBeInTheDocument();
  });
});
