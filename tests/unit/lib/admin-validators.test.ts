import { describe, it, expect } from "vitest";
import {
  productSchema,
  productUpdateSchema,
  couponSchema,
  couponUpdateSchema,
  heroSchema,
  heroUpdateSchema,
  categorySchema,
  lineSchema,
  dealSchema,
  customerSchema,
  customerNoteSchema,
  orderSchema,
  reviewSchema,
  contactSchema,
  chatSchema,
  couponValidateSchema,
  abandonedCartSchema,
  manualOrderSchema,
  pipelineDealSchema,
  idParam,
  validateBody,
} from "@/lib/admin/validators";

// ─── productSchema ────────────────────────────────────────────────

describe("productSchema", () => {
  const validProduct = {
    name_ar: "آيفون 16",
    name_he: "אייפון 16",
    brand: "Apple",
    type: "device" as const,
    price: 3499,
  };

  it("accepts valid product", () => {
    const result = productSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
  });

  it("rejects missing name_ar", () => {
    const result = productSchema.safeParse({ ...validProduct, name_ar: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing brand", () => {
    const result = productSchema.safeParse({ ...validProduct, brand: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = productSchema.safeParse({ ...validProduct, type: "unknown" });
    expect(result.success).toBe(false);
  });

  it("rejects negative price", () => {
    const result = productSchema.safeParse({ ...validProduct, price: -10 });
    expect(result.success).toBe(false);
  });

  it("defaults optional fields", () => {
    const result = productSchema.safeParse(validProduct);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stock).toBe(0);
      expect(result.data.sold).toBe(0);
      expect(result.data.active).toBe(true);
      expect(result.data.featured).toBe(false);
      expect(result.data.gallery).toEqual([]);
      expect(result.data.specs).toEqual({});
    }
  });

  it("accepts full product with all fields", () => {
    const full = {
      ...validProduct,
      old_price: 3999,
      cost: 2500,
      stock: 50,
      sold: 10,
      image_url: "/img.jpg",
      gallery: ["/1.jpg", "/2.jpg"],
      colors: [{ hex: "#000" }],
      storage_options: ["128GB"],
      variants: [{ storage: "128GB", price: 3499 }],
      specs: { screen: "6.1" },
      active: true,
      featured: true,
      description_ar: "وصف",
      description_he: "תיאור",
    };
    const result = productSchema.safeParse(full);
    expect(result.success).toBe(true);
  });
});

describe("productUpdateSchema", () => {
  it("accepts partial product data", () => {
    const result = productUpdateSchema.safeParse({ price: 2999 });
    expect(result.success).toBe(true);
  });

  it("accepts empty object", () => {
    const result = productUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ─── couponSchema ─────────────────────────────────────────────────

describe("couponSchema", () => {
  it("accepts valid coupon", () => {
    const result = couponSchema.safeParse({
      code: "save10",
      type: "percent",
      value: 10,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("SAVE10"); // transformed to uppercase
    }
  });

  it("rejects empty code", () => {
    const result = couponSchema.safeParse({ code: "", type: "fixed", value: 50 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = couponSchema.safeParse({ code: "TEST", type: "unknown", value: 10 });
    expect(result.success).toBe(false);
  });

  it("rejects negative value", () => {
    const result = couponSchema.safeParse({ code: "TEST", type: "fixed", value: -10 });
    expect(result.success).toBe(false);
  });

  it("defaults optional fields", () => {
    const result = couponSchema.safeParse({ code: "TEST", type: "fixed", value: 50 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.min_order).toBe(0);
      expect(result.data.max_uses).toBe(0);
      expect(result.data.active).toBe(true);
    }
  });
});

// ─── heroSchema ───────────────────────────────────────────────────

describe("heroSchema", () => {
  it("accepts valid hero", () => {
    const result = heroSchema.safeParse({ title_ar: "عرض خاص" });
    expect(result.success).toBe(true);
  });

  it("rejects missing title_ar", () => {
    const result = heroSchema.safeParse({ title_he: "מבצע" });
    expect(result.success).toBe(false);
  });

  it("rejects empty title_ar", () => {
    const result = heroSchema.safeParse({ title_ar: "" });
    expect(result.success).toBe(false);
  });

  it("defaults optional fields", () => {
    const result = heroSchema.safeParse({ title_ar: "عرض" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.active).toBe(true);
      expect(result.data.sort_order).toBe(0);
    }
  });
});

// ─── categorySchema ──────────────────────────────────────────────

describe("categorySchema", () => {
  it("accepts valid category", () => {
    const result = categorySchema.safeParse({ name_ar: "هواتف" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("manual");
      expect(result.data.active).toBe(true);
    }
  });

  it("rejects empty name_ar", () => {
    const result = categorySchema.safeParse({ name_ar: "" });
    expect(result.success).toBe(false);
  });
});

// ─── lineSchema ──────────────────────────────────────────────────

describe("lineSchema", () => {
  it("accepts valid line plan", () => {
    const result = lineSchema.safeParse({
      name_ar: "باقة أساسية",
      data_amount: "10GB",
      price: 29,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing data_amount", () => {
    const result = lineSchema.safeParse({ name_ar: "باقة", price: 29 });
    expect(result.success).toBe(false);
  });

  it("rejects negative price", () => {
    const result = lineSchema.safeParse({ name_ar: "باقة", data_amount: "5GB", price: -1 });
    expect(result.success).toBe(false);
  });
});

// ─── dealSchema ──────────────────────────────────────────────────

describe("dealSchema", () => {
  it("accepts valid deal", () => {
    const result = dealSchema.safeParse({ title_ar: "عرض رمضان" });
    expect(result.success).toBe(true);
  });

  it("rejects empty title_ar", () => {
    const result = dealSchema.safeParse({ title_ar: "" });
    expect(result.success).toBe(false);
  });

  it("accepts deal with discount", () => {
    const result = dealSchema.safeParse({
      title_ar: "خصم 20%",
      discount_type: "percentage",
      discount_value: 20,
    });
    expect(result.success).toBe(true);
  });
});

// ─── customerSchema ──────────────────────────────────────────────

describe("customerSchema", () => {
  it("accepts valid customer", () => {
    const result = customerSchema.safeParse({
      name: "أحمد",
      phone: "0501234567",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.segment).toBe("new");
      expect(result.data.preferred_language).toBe("ar");
    }
  });

  it("rejects missing name", () => {
    const result = customerSchema.safeParse({ phone: "0501234567" });
    expect(result.success).toBe(false);
  });

  it("rejects missing phone", () => {
    const result = customerSchema.safeParse({ name: "test" });
    expect(result.success).toBe(false);
  });

  it("validates email format", () => {
    const result = customerSchema.safeParse({
      name: "test",
      phone: "0501234567",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});

// ─── customerNoteSchema ──────────────────────────────────────────

describe("customerNoteSchema", () => {
  it("accepts valid note", () => {
    const result = customerNoteSchema.safeParse({ text: "عميل مهم" });
    expect(result.success).toBe(true);
  });

  it("rejects empty text", () => {
    const result = customerNoteSchema.safeParse({ text: "" });
    expect(result.success).toBe(false);
  });

  it("rejects text over 5000 chars", () => {
    const result = customerNoteSchema.safeParse({ text: "a".repeat(5001) });
    expect(result.success).toBe(false);
  });
});

// ─── pipelineDealSchema ──────────────────────────────────────────

describe("pipelineDealSchema", () => {
  it("accepts valid pipeline deal", () => {
    const result = pipelineDealSchema.safeParse({
      stage_id: 1,
      customer_name: "Ahmad",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing stage_id", () => {
    const result = pipelineDealSchema.safeParse({
      customer_name: "Ahmad",
    });
    expect(result.success).toBe(false);
  });

  it("rejects stage_id of 0", () => {
    const result = pipelineDealSchema.safeParse({
      stage_id: 0,
      customer_name: "Ahmad",
    });
    expect(result.success).toBe(false);
  });
});

// ─── orderSchema ─────────────────────────────────────────────────

describe("orderSchema", () => {
  const validOrder = {
    customer: {
      name: "أحمد",
      phone: "0501234567",
      city: "חיפה",
      address: "רחוב 1",
    },
    items: [
      {
        productId: "prod-1",
        name: "iPhone 16",
        brand: "Apple",
        type: "device",
        price: 3499,
      },
    ],
  };

  it("accepts valid order", () => {
    const result = orderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it("rejects empty items array", () => {
    const result = orderSchema.safeParse({
      ...validOrder,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing customer name", () => {
    const result = orderSchema.safeParse({
      customer: { phone: "0501234567", city: "test", address: "test" },
      items: validOrder.items,
    });
    expect(result.success).toBe(false);
  });

  it("rejects short phone number", () => {
    const result = orderSchema.safeParse({
      customer: { ...validOrder.customer, phone: "123" },
      items: validOrder.items,
    });
    expect(result.success).toBe(false);
  });
});

// ─── reviewSchema ────────────────────────────────────────────────

describe("reviewSchema", () => {
  it("accepts valid review", () => {
    const result = reviewSchema.safeParse({
      product_id: "prod-1",
      customer_name: "Ahmad",
      rating: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects rating below 1", () => {
    const result = reviewSchema.safeParse({
      product_id: "prod-1",
      customer_name: "Ahmad",
      rating: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects rating above 5", () => {
    const result = reviewSchema.safeParse({
      product_id: "prod-1",
      customer_name: "Ahmad",
      rating: 6,
    });
    expect(result.success).toBe(false);
  });
});

// ─── contactSchema ───────────────────────────────────────────────

describe("contactSchema", () => {
  it("accepts valid contact form", () => {
    const result = contactSchema.safeParse({
      name: "Ahmad",
      phone: "0501234567",
      message: "أريد الاستفسار",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty message", () => {
    const result = contactSchema.safeParse({
      name: "Ahmad",
      phone: "0501234567",
      message: "",
    });
    expect(result.success).toBe(false);
  });
});

// ─── chatSchema ──────────────────────────────────────────────────

describe("chatSchema", () => {
  it("accepts valid chat message", () => {
    const result = chatSchema.safeParse({ message: "مرحبا" });
    expect(result.success).toBe(true);
  });

  it("rejects empty message", () => {
    const result = chatSchema.safeParse({ message: "" });
    expect(result.success).toBe(false);
  });

  it("rejects message over 2000 chars", () => {
    const result = chatSchema.safeParse({ message: "a".repeat(2001) });
    expect(result.success).toBe(false);
  });
});

// ─── couponValidateSchema ────────────────────────────────────────

describe("couponValidateSchema", () => {
  it("accepts valid coupon validation request", () => {
    const result = couponValidateSchema.safeParse({ code: "SAVE10", total: 500 });
    expect(result.success).toBe(true);
  });

  it("rejects empty code", () => {
    const result = couponValidateSchema.safeParse({ code: "", total: 500 });
    expect(result.success).toBe(false);
  });

  it("rejects negative total", () => {
    const result = couponValidateSchema.safeParse({ code: "TEST", total: -1 });
    expect(result.success).toBe(false);
  });
});

// ─── abandonedCartSchema ─────────────────────────────────────────

describe("abandonedCartSchema", () => {
  it("accepts valid abandoned cart", () => {
    const result = abandonedCartSchema.safeParse({
      visitor_id: "v-123",
      items: [{ name: "Phone", price: 100 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty items array", () => {
    const result = abandonedCartSchema.safeParse({
      visitor_id: "v-123",
      items: [],
    });
    expect(result.success).toBe(false);
  });
});

// ─── manualOrderSchema ───────────────────────────────────────────

describe("manualOrderSchema", () => {
  it("accepts valid manual order", () => {
    const result = manualOrderSchema.safeParse({
      customer_name: "Ahmad",
      customer_phone: "0501234567",
      items: [{ name: "iPhone 16", price: 3499, quantity: 1 }],
      subtotal: 3499,
      total: 3499,
    });
    expect(result.success).toBe(true);
  });

  it("defaults source to manual", () => {
    const result = manualOrderSchema.safeParse({
      customer_name: "Ahmad",
      customer_phone: "0501234567",
      items: [{ name: "iPhone 16", price: 3499 }],
      subtotal: 3499,
      total: 3499,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe("manual");
    }
  });

  it("rejects empty items", () => {
    const result = manualOrderSchema.safeParse({
      customer_name: "Ahmad",
      customer_phone: "0501234567",
      items: [],
      subtotal: 0,
      total: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ─── idParam ─────────────────────────────────────────────────────

describe("idParam", () => {
  it("accepts UUID format", () => {
    const result = idParam.safeParse("550e8400-e29b-41d4-a716-446655440000");
    expect(result.success).toBe(true);
  });

  it("accepts non-UUID string ID", () => {
    const result = idParam.safeParse("CLM-12345");
    expect(result.success).toBe(true);
  });

  it("rejects empty string", () => {
    const result = idParam.safeParse("");
    expect(result.success).toBe(false);
  });
});

// ─── validateBody ────────────────────────────────────────────────

describe("validateBody", () => {
  it("returns data on successful validation", () => {
    const result = validateBody({ message: "hello" }, chatSchema);
    expect(result.data).not.toBeNull();
    expect(result.error).toBeNull();
    expect(result.data!.message).toBe("hello");
  });

  it("returns error string on validation failure", () => {
    const result = validateBody({ message: "" }, chatSchema);
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
    expect(typeof result.error).toBe("string");
  });

  it("includes field path in error message", () => {
    const result = validateBody(
      { customer: { name: "" }, items: [] },
      orderSchema
    );
    expect(result.error).toContain("customer");
  });

  it("handles null body", () => {
    const result = validateBody(null, chatSchema);
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });

  it("handles undefined body", () => {
    const result = validateBody(undefined, chatSchema);
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });
});
