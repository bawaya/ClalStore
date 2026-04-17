import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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

import { SearchFilters, INITIAL_FILTERS, type FilterState } from "@/components/store/SearchFilters";

describe("SearchFilters", () => {
  const mockOnChange = vi.fn();
  const availableBrands = ["Apple", "Samsung", "Xiaomi"];

  const renderFilters = (filters: FilterState = { ...INITIAL_FILTERS }) => {
    return render(
      <SearchFilters
        availableBrands={availableBrands}
        filters={filters}
        onChange={mockOnChange}
      />
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseScreen.mockReturnValue({ mobile: false, tablet: false, desktop: true, width: 1024 });
  });

  it("renders without crashing", () => {
    renderFilters();
    expect(screen.getByText("store2.filters")).toBeInTheDocument();
  });

  it("shows filter button on desktop", () => {
    renderFilters();
    const btn = screen.getByText("store2.filters");
    expect(btn).toBeInTheDocument();
  });

  it("opens filter panel on desktop when clicked", () => {
    renderFilters();
    fireEvent.click(screen.getByText("store2.filters"));
    expect(screen.getByText("store2.sortBy")).toBeInTheDocument();
    expect(screen.getByText("store2.priceRange")).toBeInTheDocument();
    expect(screen.getByText("store2.typeFilter")).toBeInTheDocument();
    expect(screen.getByText("store2.brandFilter")).toBeInTheDocument();
  });

  it("shows in-stock toggle", () => {
    renderFilters();
    fireEvent.click(screen.getByText("store2.filters"));
    expect(screen.getByText("store2.inStockOnly")).toBeInTheDocument();
  });

  it("toggles in-stock filter", () => {
    renderFilters();
    fireEvent.click(screen.getByText("store2.filters"));
    const toggle = screen.getByRole("switch");
    fireEvent.click(toggle);
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ inStockOnly: true })
    );
  });

  it("expands sort section and shows sort options", () => {
    renderFilters();
    fireEvent.click(screen.getByText("store2.filters"));
    fireEvent.click(screen.getByText("store2.sortBy"));
    expect(screen.getByText("store2.sortPriceLow")).toBeInTheDocument();
    expect(screen.getByText("store2.sortPriceHigh")).toBeInTheDocument();
    expect(screen.getByText("store2.sortNewest")).toBeInTheDocument();
  });

  it("selects a sort option", () => {
    renderFilters();
    fireEvent.click(screen.getByText("store2.filters"));
    fireEvent.click(screen.getByText("store2.sortBy"));
    fireEvent.click(screen.getByText("store2.sortPriceLow"));
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "price_asc" })
    );
  });

  it("expands brand section and shows brands", () => {
    renderFilters();
    fireEvent.click(screen.getByText("store2.filters"));
    fireEvent.click(screen.getByText("store2.brandFilter"));
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Samsung")).toBeInTheDocument();
    expect(screen.getByText("Xiaomi")).toBeInTheDocument();
  });

  it("selects a brand filter", () => {
    renderFilters();
    fireEvent.click(screen.getByText("store2.filters"));
    fireEvent.click(screen.getByText("store2.brandFilter"));
    fireEvent.click(screen.getByText("Apple"));
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ brands: ["Apple"] })
    );
  });

  it("expands type section and shows type options", () => {
    renderFilters();
    fireEvent.click(screen.getByText("store2.filters"));
    fireEvent.click(screen.getByText("store2.typeFilter"));
    expect(screen.getByText("store.all")).toBeInTheDocument();
    expect(screen.getByText("store.devices")).toBeInTheDocument();
    expect(screen.getByText("store.accessories")).toBeInTheDocument();
  });

  it("selects device type", () => {
    renderFilters();
    fireEvent.click(screen.getByText("store2.filters"));
    fireEvent.click(screen.getByText("store2.typeFilter"));
    fireEvent.click(screen.getByText("store.devices"));
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: "device" })
    );
  });

  it("shows active filter count badge when filters are set", () => {
    const filters = { ...INITIAL_FILTERS, inStockOnly: true, type: "device" as const };
    renderFilters(filters);
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows clear all button when filters are active", () => {
    const filters = { ...INITIAL_FILTERS, inStockOnly: true };
    renderFilters(filters);
    fireEvent.click(screen.getByText("store2.filters"));
    expect(screen.getByText("store2.clearFilters")).toBeInTheDocument();
  });

  it("clears all filters when clear button is clicked", () => {
    const filters = { ...INITIAL_FILTERS, inStockOnly: true };
    renderFilters(filters);
    fireEvent.click(screen.getByText("store2.filters"));
    fireEvent.click(screen.getByText("store2.clearFilters"));
    expect(mockOnChange).toHaveBeenCalledWith(INITIAL_FILTERS);
  });

  it("renders mobile slide-in panel", () => {
    mockUseScreen.mockReturnValue({ mobile: true, tablet: false, desktop: false, width: 375 });
    renderFilters();
    // Click first filters trigger (there may be multiple due to panel header/button duplication)
    const filtersButtons = screen.getAllByText("store2.filters");
    fireEvent.click(filtersButtons[0]);
    // Close button should appear
    expect(screen.getByLabelText("common.close")).toBeInTheDocument();
  });

  it("shows price range inputs when expanded", () => {
    renderFilters();
    fireEvent.click(screen.getByText("store2.filters"));
    fireEvent.click(screen.getByText("store2.priceRange"));
    expect(screen.getByPlaceholderText("store2.minPrice")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("store2.maxPrice")).toBeInTheDocument();
  });

  it("shows quick price presets", () => {
    renderFilters();
    fireEvent.click(screen.getByText("store2.filters"));
    fireEvent.click(screen.getByText("store2.priceRange"));
    expect(screen.getByText(/1,000/)).toBeInTheDocument();
    expect(screen.getByText(/5,000/)).toBeInTheDocument();
  });
});
