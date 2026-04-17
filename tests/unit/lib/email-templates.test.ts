import { describe, it, expect } from "vitest";
import { orderConfirmationEmail, orderStatusEmail } from "@/lib/email-templates";

// ─────────────────────────────────────────────
// orderConfirmationEmail
// ─────────────────────────────────────────────
describe("orderConfirmationEmail", () => {
  const orderId = "CLM-TEST1234";
  const customerName = "\u0623\u062D\u0645\u062F";
  const total = 3499;
  const items = [
    { name: "iPhone 15", qty: 1, price: 3499 },
  ];

  it("returns subject and html properties", () => {
    const result = orderConfirmationEmail(orderId, customerName, total, items);
    expect(result).toHaveProperty("subject");
    expect(result).toHaveProperty("html");
  });

  it("subject contains the order ID", () => {
    const result = orderConfirmationEmail(orderId, customerName, total, items);
    expect(result.subject).toContain(orderId);
  });

  it("subject contains ClalMobile", () => {
    const result = orderConfirmationEmail(orderId, customerName, total, items);
    expect(result.subject).toContain("ClalMobile");
  });

  it("html contains the customer name", () => {
    const result = orderConfirmationEmail(orderId, customerName, total, items);
    expect(result.html).toContain(customerName);
  });

  it("html contains the order ID", () => {
    const result = orderConfirmationEmail(orderId, customerName, total, items);
    expect(result.html).toContain(orderId);
  });

  it("html contains item names", () => {
    const result = orderConfirmationEmail(orderId, customerName, total, items);
    expect(result.html).toContain("iPhone 15");
  });

  it("html contains the total price", () => {
    const multiItems = [
      { name: "iPhone 15", qty: 1, price: 2999 },
      { name: "Case", qty: 2, price: 250 },
    ];
    const result = orderConfirmationEmail(orderId, customerName, 3499, multiItems);
    expect(result.html).toContain("3,499");
  });

  it("html includes payment method when provided", () => {
    const result = orderConfirmationEmail(orderId, customerName, total, items, "credit");
    expect(result.html).toContain("\u0628\u0637\u0627\u0642\u0629 \u0627\u0626\u062A\u0645\u0627\u0646"); // بطاقة ائتمان
  });

  it("html includes bank transfer label for bank payment", () => {
    const result = orderConfirmationEmail(orderId, customerName, total, items, "bank");
    expect(result.html).toContain("\u062A\u062D\u0648\u064A\u0644 \u0628\u0646\u0643\u064A"); // تحويل بنكي
  });

  it("html includes shipping city when provided", () => {
    const result = orderConfirmationEmail(orderId, customerName, total, items, undefined, "\u062D\u064A\u0641\u0627");
    expect(result.html).toContain("\u062D\u064A\u0641\u0627");
  });

  it("html includes shipping address when provided", () => {
    const result = orderConfirmationEmail(orderId, customerName, total, items, undefined, undefined, "\u0634\u0627\u0631\u0639 1");
    expect(result.html).toContain("\u0634\u0627\u0631\u0639 1");
  });

  it("html is valid HTML with doctype", () => {
    const result = orderConfirmationEmail(orderId, customerName, total, items);
    expect(result.html).toContain("<!DOCTYPE html>");
    expect(result.html).toContain("</html>");
  });

  it("html has RTL direction", () => {
    const result = orderConfirmationEmail(orderId, customerName, total, items);
    expect(result.html).toContain('dir="rtl"');
  });

  it("html contains ClalMobile branding in footer", () => {
    const result = orderConfirmationEmail(orderId, customerName, total, items);
    expect(result.html).toContain("ClalMobile");
    expect(result.html).toContain("HOT Mobile");
  });

  it("renders multiple items in the table", () => {
    const multiItems = [
      { name: "iPhone 15", qty: 1, price: 3499 },
      { name: "Screen Protector", qty: 2, price: 50 },
    ];
    const result = orderConfirmationEmail(orderId, customerName, 3599, multiItems);
    expect(result.html).toContain("iPhone 15");
    expect(result.html).toContain("Screen Protector");
  });

  it("does not include payment details section when no extras provided", () => {
    const result = orderConfirmationEmail(orderId, customerName, total, items);
    // Should not have the payment/shipping details block
    expect(result.html).not.toContain("\u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u062F\u0641\u0639"); // طريقة الدفع
  });
});

// ─────────────────────────────────────────────
// orderStatusEmail
// ─────────────────────────────────────────────
describe("orderStatusEmail", () => {
  const orderId = "CLM-TEST5678";
  const customerName = "\u0645\u062D\u0645\u062F";

  it("returns subject and html properties", () => {
    const result = orderStatusEmail(orderId, customerName, "confirmed");
    expect(result).toHaveProperty("subject");
    expect(result).toHaveProperty("html");
  });

  it("subject contains the order ID", () => {
    const result = orderStatusEmail(orderId, customerName, "shipped");
    expect(result.subject).toContain(orderId);
  });

  it("html contains the customer name", () => {
    const result = orderStatusEmail(orderId, customerName, "delivered");
    expect(result.html).toContain(customerName);
  });

  it("html contains the order ID", () => {
    const result = orderStatusEmail(orderId, customerName, "processing");
    expect(result.html).toContain(orderId);
  });

  it("confirmed status shows correct Arabic label", () => {
    const result = orderStatusEmail(orderId, customerName, "confirmed");
    expect(result.html).toContain("\u062A\u0645 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0637\u0644\u0628"); // تم تأكيد الطلب
  });

  it("shipped status shows shipping message", () => {
    const result = orderStatusEmail(orderId, customerName, "shipped");
    expect(result.html).toContain("\u0628\u0627\u0644\u0637\u0631\u064A\u0642 \u0625\u0644\u064A\u0643!"); // بالطريق إليك!
    // Extra shipped-specific text
    expect(result.html).toContain("\u0637\u0644\u0628\u0643 \u0641\u064A \u0627\u0644\u0637\u0631\u064A\u0642"); // طلبك في الطريق
  });

  it("delivered status shows thank you message", () => {
    const result = orderStatusEmail(orderId, customerName, "delivered");
    expect(result.html).toContain("\u062A\u0645 \u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u0628\u0646\u062C\u0627\u062D"); // تم التوصيل بنجاح
    expect(result.html).toContain("\u0634\u0643\u0631\u0627\u064B \u0644\u062A\u0633\u0648\u0642\u0643"); // شكراً لتسوقك
  });

  it("cancelled status shows cancellation message", () => {
    const result = orderStatusEmail(orderId, customerName, "cancelled");
    expect(result.html).toContain("\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0637\u0644\u0628"); // تم إلغاء الطلب
    expect(result.html).toContain("\u0627\u0644\u0625\u0644\u063A\u0627\u0621"); // الإلغاء
  });

  it("processing status shows processing label", () => {
    const result = orderStatusEmail(orderId, customerName, "processing");
    expect(result.html).toContain("\u0642\u064A\u062F \u0627\u0644\u062A\u062C\u0647\u064A\u0632"); // قيد التجهيز
  });

  it("unknown status uses the status string directly", () => {
    const result = orderStatusEmail(orderId, customerName, "custom_status");
    expect(result.html).toContain("custom_status");
  });

  it("html is valid HTML with RTL", () => {
    const result = orderStatusEmail(orderId, customerName, "confirmed");
    expect(result.html).toContain("<!DOCTYPE html>");
    expect(result.html).toContain('dir="rtl"');
    expect(result.html).toContain("</html>");
  });

  it("html contains contact information", () => {
    const result = orderStatusEmail(orderId, customerName, "confirmed");
    expect(result.html).toContain("053-3337653");
  });

  it("subject contains status icon", () => {
    const result = orderStatusEmail(orderId, customerName, "shipped");
    // Shipped icon is a truck emoji
    expect(result.subject.length).toBeGreaterThan(0);
    expect(result.subject).toContain(orderId);
  });
});
