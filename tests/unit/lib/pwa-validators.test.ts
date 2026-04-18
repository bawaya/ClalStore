import { describe, it, expect } from "vitest";
import {
  salesDocItemSchema,
  createSalesDocSchema,
  updateSalesDocSchema,
  submitSalesDocSchema,
} from "@/lib/pwa/validators";

// ─── salesDocItemSchema ───────────────────────────────────────────

describe("salesDocItemSchema", () => {
  it("accepts valid line item", () => {
    const result = salesDocItemSchema.safeParse({
      item_type: "line",
      qty: 1,
      unit_price: 59,
      line_total: 59,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid device item", () => {
    const result = salesDocItemSchema.safeParse({
      item_type: "device",
      product_id: "prod-1",
      product_name: "iPhone 16",
      qty: 1,
      unit_price: 3499,
      line_total: 3499,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid accessory item", () => {
    const result = salesDocItemSchema.safeParse({
      item_type: "accessory",
      product_name: "Case",
      qty: 2,
      unit_price: 50,
      line_total: 100,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid item_type", () => {
    const result = salesDocItemSchema.safeParse({
      item_type: "unknown",
      qty: 1,
      unit_price: 100,
      line_total: 100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects qty of 0", () => {
    const result = salesDocItemSchema.safeParse({
      item_type: "device",
      qty: 0,
      unit_price: 100,
      line_total: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative unit_price", () => {
    const result = salesDocItemSchema.safeParse({
      item_type: "device",
      qty: 1,
      unit_price: -100,
      line_total: -100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects qty above 100", () => {
    const result = salesDocItemSchema.safeParse({
      item_type: "device",
      qty: 101,
      unit_price: 100,
      line_total: 10100,
    });
    expect(result.success).toBe(false);
  });

  it("defaults qty to 1", () => {
    const result = salesDocItemSchema.safeParse({
      item_type: "line",
      unit_price: 50,
      line_total: 50,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.qty).toBe(1);
    }
  });

  it("defaults metadata to empty object", () => {
    const result = salesDocItemSchema.safeParse({
      item_type: "device",
      qty: 1,
      unit_price: 100,
      line_total: 100,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata).toEqual({});
    }
  });

  it("accepts null product_id and product_name", () => {
    const result = salesDocItemSchema.safeParse({
      item_type: "line",
      product_id: null,
      product_name: null,
      qty: 1,
      unit_price: 29,
      line_total: 29,
    });
    expect(result.success).toBe(true);
  });
});

// ─── createSalesDocSchema ─────────────────────────────────────────

describe("createSalesDocSchema", () => {
  // Updated 2026-04-18: commission refactor — total_amount is now required
  // and positive (audit 4.12 sanity cap). A 0 or absent amount rejects.
  it("accepts valid sales doc with minimal fields", () => {
    const result = createSalesDocSchema.safeParse({
      sale_type: "device",
      total_amount: 3499,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe("ILS");
      expect(result.data.total_amount).toBe(3499);
      expect(result.data.items).toEqual([]);
    }
  });

  it("accepts full sales doc", () => {
    const result = createSalesDocSchema.safeParse({
      doc_uuid: "550e8400-e29b-41d4-a716-446655440000",
      sale_type: "mixed",
      sale_date: "2026-04-17",
      customer_id: "cust-1",
      customer_phone: "0501234567",
      order_id: "CLM-123",
      total_amount: 5000,
      currency: "ILS",
      notes: "Some notes",
      items: [
        { item_type: "device", qty: 1, unit_price: 3499, line_total: 3499 },
        { item_type: "line", qty: 1, unit_price: 59, line_total: 59 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid sale_type", () => {
    const result = createSalesDocSchema.safeParse({
      sale_type: "unknown",
    });
    expect(result.success).toBe(false);
  });

  // Updated 2026-04-18: commission refactor — total_amount is required.
  it("accepts all valid sale_type values", () => {
    expect(createSalesDocSchema.safeParse({ sale_type: "line", total_amount: 59 }).success).toBe(true);
    expect(createSalesDocSchema.safeParse({ sale_type: "device", total_amount: 3499 }).success).toBe(true);
    expect(createSalesDocSchema.safeParse({ sale_type: "mixed", total_amount: 3558 }).success).toBe(true);
  });

  it("rejects invalid doc_uuid format", () => {
    const result = createSalesDocSchema.safeParse({
      doc_uuid: "not-a-uuid",
      sale_type: "device",
    });
    expect(result.success).toBe(false);
  });

  // Updated 2026-04-18: commission refactor — total_amount is required.
  it("accepts null optional fields", () => {
    const result = createSalesDocSchema.safeParse({
      sale_type: "device",
      total_amount: 3499,
      sale_date: null,
      customer_id: null,
      customer_phone: null,
      order_id: null,
      notes: null,
    });
    expect(result.success).toBe(true);
  });

  it("validates nested items", () => {
    const result = createSalesDocSchema.safeParse({
      sale_type: "device",
      items: [
        { item_type: "invalid", qty: 1, unit_price: 100, line_total: 100 },
      ],
    });
    expect(result.success).toBe(false);
  });

  // Updated 2026-04-18: commission refactor — total_amount is required.
  it("accepts idempotency_key", () => {
    const result = createSalesDocSchema.safeParse({
      sale_type: "device",
      total_amount: 3499,
      idempotency_key: "unique-key-123",
    });
    expect(result.success).toBe(true);
  });
});

// ─── updateSalesDocSchema ─────────────────────────────────────────

describe("updateSalesDocSchema", () => {
  it("requires id field", () => {
    const result = updateSalesDocSchema.safeParse({
      sale_type: "device",
    });
    expect(result.success).toBe(false);
  });

  it("accepts update with id and partial fields", () => {
    const result = updateSalesDocSchema.safeParse({
      id: 1,
      total_amount: 5000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-positive id", () => {
    const result = updateSalesDocSchema.safeParse({
      id: 0,
      sale_type: "device",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative id", () => {
    const result = updateSalesDocSchema.safeParse({
      id: -1,
    });
    expect(result.success).toBe(false);
  });
});

// ─── submitSalesDocSchema ─────────────────────────────────────────

describe("submitSalesDocSchema", () => {
  it("accepts valid submit request", () => {
    const result = submitSalesDocSchema.safeParse({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("rejects missing id", () => {
    const result = submitSalesDocSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects non-positive id", () => {
    const result = submitSalesDocSchema.safeParse({ id: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer id", () => {
    const result = submitSalesDocSchema.safeParse({ id: 1.5 });
    expect(result.success).toBe(false);
  });
});
