import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mockUseScreen = vi.fn(() => ({ mobile: false, tablet: false, desktop: true, width: 1024 }));
vi.mock("@/lib/hooks", () => ({
  useScreen: () => mockUseScreen(),
}));

vi.mock("@/lib/csrf-client", () => ({
  csrfHeaders: () => ({ "Content-Type": "application/json" }),
}));

import { ImageUpload } from "@/components/admin/ImageUpload";

describe("ImageUpload", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders without crashing", () => {
    render(<ImageUpload value="" onChange={mockOnChange} />);
    expect(screen.getByText("اضغط أو اسحب صورة هنا")).toBeInTheDocument();
  });

  it("shows upload zone when no value", () => {
    render(<ImageUpload value="" onChange={mockOnChange} />);
    expect(screen.getByText("اضغط أو اسحب صورة هنا")).toBeInTheDocument();
    expect(screen.getByText(/JPG, PNG, WebP/)).toBeInTheDocument();
  });

  it("shows default max size (5MB)", () => {
    render(<ImageUpload value="" onChange={mockOnChange} />);
    expect(screen.getByText(/5MB/)).toBeInTheDocument();
  });

  it("shows custom max size", () => {
    render(<ImageUpload value="" onChange={mockOnChange} maxSizeMB={10} />);
    expect(screen.getByText(/10MB/)).toBeInTheDocument();
  });

  it("shows label when provided", () => {
    render(<ImageUpload value="" onChange={mockOnChange} label="بنر الكاروسيل" />);
    expect(screen.getByText("بنر الكاروسيل")).toBeInTheDocument();
  });

  it("shows dimensions hint when provided", () => {
    render(<ImageUpload value="" onChange={mockOnChange} dimensions="1200x400 بكسل" />);
    expect(screen.getAllByText(/1200x400 بكسل/).length).toBeGreaterThan(0);
  });

  it("shows image preview when value is set", () => {
    render(<ImageUpload value="https://example.com/img.jpg" onChange={mockOnChange} />);
    const img = document.querySelector("img") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/img.jpg");
  });

  it("shows change and delete buttons on hover overlay when value is set", () => {
    render(<ImageUpload value="https://example.com/img.jpg" onChange={mockOnChange} />);
    expect(screen.getByText(/تغيير/)).toBeInTheDocument();
    expect(screen.getByText(/حذف/)).toBeInTheDocument();
  });

  it("calls onChange with empty string when delete is clicked", () => {
    render(<ImageUpload value="https://example.com/img.jpg" onChange={mockOnChange} />);
    fireEvent.click(screen.getByText(/حذف/));
    expect(mockOnChange).toHaveBeenCalledWith("");
  });

  it("uploads file on change and calls onChange with URL", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: true, url: "https://example.com/uploaded.jpg" }),
    });

    render(<ImageUpload value="" onChange={mockOnChange} />);

    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith("https://example.com/uploaded.jpg");
    });
  });

  it("shows error when file is too large", async () => {
    render(<ImageUpload value="" onChange={mockOnChange} maxSizeMB={1} />);

    const bigFile = new File(["x".repeat(2 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(bigFile, "size", { value: 2 * 1024 * 1024 });

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [bigFile] } });

    await waitFor(() => {
      expect(screen.getByText(/الملف أكبر من/)).toBeInTheDocument();
    });
  });

  it("shows error when upload fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: () => Promise.resolve({ success: false, error: "Upload failed" }),
    });

    render(<ImageUpload value="" onChange={mockOnChange} />);

    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/)).toBeInTheDocument();
    });
  });

  it("shows error on network failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("network"));

    render(<ImageUpload value="" onChange={mockOnChange} />);

    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/فشل الاتصال بالسيرفر/)).toBeInTheDocument();
    });
  });

  it("shows enhance button when enableEnhance is true", () => {
    render(
      <ImageUpload
        value="https://example.com/img.jpg"
        onChange={mockOnChange}
        enableEnhance
      />
    );
    expect(screen.getByText(/إزالة الخلفية/)).toBeInTheDocument();
  });

  it("does not show enhance button when enableEnhance is false", () => {
    render(
      <ImageUpload
        value="https://example.com/img.jpg"
        onChange={mockOnChange}
        enableEnhance={false}
      />
    );
    expect(screen.queryByText(/إزالة الخلفية/)).not.toBeInTheDocument();
  });

  it("has hidden file input", () => {
    render(<ImageUpload value="" onChange={mockOnChange} />);
    const input = document.querySelector("input[type='file']");
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass("hidden");
  });

  it("shows ideal dimensions text in upload zone", () => {
    render(<ImageUpload value="" onChange={mockOnChange} dimensions="800x800 بكسل" />);
    expect(screen.getByText(/المقاس المثالي: 800x800 بكسل/)).toBeInTheDocument();
  });
});
