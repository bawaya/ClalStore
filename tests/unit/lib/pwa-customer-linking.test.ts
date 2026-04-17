import { describe, it, expect } from "vitest";
import {
  buildCustomerPhoneCandidates,
  extractCustomerIdsFromSalesDocs,
  attachCustomersToSalesDocs,
} from "@/lib/pwa/customer-linking";

// ─── buildCustomerPhoneCandidates ─────────────────────────────────

describe("buildCustomerPhoneCandidates", () => {
  it("generates candidates for Israeli mobile starting with 05", () => {
    const candidates = buildCustomerPhoneCandidates("0501234567");
    expect(candidates).toContain("0501234567");
    expect(candidates).toContain("972501234567");
    expect(candidates).toContain("+972501234567");
  });

  it("generates candidates for +972 format", () => {
    const candidates = buildCustomerPhoneCandidates("+972501234567");
    expect(candidates).toContain("+972501234567");
    expect(candidates).toContain("972501234567");
    expect(candidates).toContain("0501234567");
  });

  it("generates candidates for 972 format without plus", () => {
    const candidates = buildCustomerPhoneCandidates("972501234567");
    expect(candidates).toContain("972501234567");
    expect(candidates).toContain("0501234567");
    expect(candidates).toContain("+972501234567");
  });

  it("returns empty array for empty string", () => {
    expect(buildCustomerPhoneCandidates("")).toEqual([]);
  });

  it("returns empty array for whitespace only", () => {
    expect(buildCustomerPhoneCandidates("   ")).toEqual([]);
  });

  it("handles phone with dashes and spaces", () => {
    const candidates = buildCustomerPhoneCandidates("050-123-4567");
    expect(candidates).toContain("0501234567");
    expect(candidates).toContain("972501234567");
  });

  it("handles phone with parentheses", () => {
    const candidates = buildCustomerPhoneCandidates("(050) 123 4567");
    expect(candidates).toContain("0501234567");
  });

  it("produces unique candidates", () => {
    const candidates = buildCustomerPhoneCandidates("0501234567");
    const unique = new Set(candidates);
    expect(unique.size).toBe(candidates.length);
  });

  it("includes the original trimmed input", () => {
    const candidates = buildCustomerPhoneCandidates("  0501234567  ");
    expect(candidates).toContain("0501234567");
  });

  it("handles short phone numbers without crashing", () => {
    const candidates = buildCustomerPhoneCandidates("123");
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates).toContain("123");
  });
});

// ─── extractCustomerIdsFromSalesDocs ──────────────────────────────

describe("extractCustomerIdsFromSalesDocs", () => {
  it("extracts unique customer IDs", () => {
    const docs = [
      { customer_id: "cust-1" },
      { customer_id: "cust-2" },
      { customer_id: "cust-1" }, // duplicate
    ];
    const ids = extractCustomerIdsFromSalesDocs(docs);
    expect(ids).toEqual(["cust-1", "cust-2"]);
  });

  it("filters out null customer IDs", () => {
    const docs = [
      { customer_id: "cust-1" },
      { customer_id: null },
      { customer_id: undefined },
    ];
    const ids = extractCustomerIdsFromSalesDocs(docs);
    expect(ids).toEqual(["cust-1"]);
  });

  it("returns empty array for docs with no customer IDs", () => {
    const docs = [
      { customer_id: null },
      { customer_id: undefined },
    ];
    const ids = extractCustomerIdsFromSalesDocs(docs);
    expect(ids).toEqual([]);
  });

  it("returns empty array for empty docs", () => {
    expect(extractCustomerIdsFromSalesDocs([])).toEqual([]);
  });

  it("handles docs without customer_id property", () => {
    const docs = [{} as { customer_id?: string | null }];
    const ids = extractCustomerIdsFromSalesDocs(docs);
    expect(ids).toEqual([]);
  });
});

// ─── attachCustomersToSalesDocs ───────────────────────────────────

describe("attachCustomersToSalesDocs", () => {
  const customers = [
    { id: "cust-1", name: "Ahmad", phone: "0501234567" },
    { id: "cust-2", name: "Sara", phone: "0521234567", customer_code: "CLAL-002" },
  ];

  it("attaches matching customer to each doc", () => {
    const docs = [
      { customer_id: "cust-1", id: 1, sale_type: "device" },
      { customer_id: "cust-2", id: 2, sale_type: "line" },
    ];

    const result = attachCustomersToSalesDocs(docs, customers);

    expect(result[0].customer).not.toBeNull();
    expect(result[0].customer!.name).toBe("Ahmad");
    expect(result[1].customer).not.toBeNull();
    expect(result[1].customer!.name).toBe("Sara");
    expect(result[1].customer!.customer_code).toBe("CLAL-002");
  });

  it("sets customer to null for docs with no customer_id", () => {
    const docs = [
      { customer_id: null, id: 1, sale_type: "device" },
    ];

    const result = attachCustomersToSalesDocs(docs, customers);
    expect(result[0].customer).toBeNull();
  });

  it("sets customer to null for docs with non-matching customer_id", () => {
    const docs = [
      { customer_id: "cust-unknown", id: 1, sale_type: "device" },
    ];

    const result = attachCustomersToSalesDocs(docs, customers);
    expect(result[0].customer).toBeNull();
  });

  it("preserves all original doc fields", () => {
    const docs = [
      { customer_id: "cust-1", id: 1, sale_type: "device", total: 3499, status: "draft" },
    ];

    const result = attachCustomersToSalesDocs(docs, customers);
    expect(result[0].id).toBe(1);
    expect(result[0].sale_type).toBe("device");
    expect(result[0].total).toBe(3499);
    expect(result[0].status).toBe("draft");
  });

  it("handles empty docs array", () => {
    const result = attachCustomersToSalesDocs([], customers);
    expect(result).toEqual([]);
  });

  it("handles empty customers array", () => {
    const docs = [
      { customer_id: "cust-1", id: 1, sale_type: "device" },
    ];

    const result = attachCustomersToSalesDocs(docs, []);
    expect(result[0].customer).toBeNull();
  });

  it("handles multiple docs with the same customer", () => {
    const docs = [
      { customer_id: "cust-1", id: 1, sale_type: "device" },
      { customer_id: "cust-1", id: 2, sale_type: "line" },
    ];

    const result = attachCustomersToSalesDocs(docs, customers);
    expect(result[0].customer!.id).toBe("cust-1");
    expect(result[1].customer!.id).toBe("cust-1");
  });
});
