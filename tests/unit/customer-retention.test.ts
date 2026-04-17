import { describe, expect, it } from "vitest";
import { createSalesDocSchema, updateSalesDocSchema } from "@/lib/pwa/validators";
import {
  attachCustomersToSalesDocs,
  buildCustomerPhoneCandidates,
  extractCustomerIdsFromSalesDocs,
} from "@/lib/pwa/customer-linking";
import { generateCustomerCode } from "@/lib/validators";

describe("Customer retention helpers", () => {
  it("generates stable-format customer codes", () => {
    const code = generateCustomerCode();

    expect(code).toMatch(/^CLAL-[A-Z0-9]{4}\d{3}$/);
  });

  it("builds phone lookup candidates for local and international formats", () => {
    const candidates = buildCustomerPhoneCandidates("+972-54-123-4567");

    expect(candidates).toContain("+972-54-123-4567");
    expect(candidates).toContain("972541234567");
    expect(candidates).toContain("0541234567");
    expect(candidates).toContain("+972541234567");
  });

  it("extracts unique customer ids from sales docs", () => {
    const ids = extractCustomerIdsFromSalesDocs([
      { id: 1, customer_id: "cust-1" },
      { id: 2, customer_id: "cust-2" },
      { id: 3, customer_id: "cust-1" },
      { id: 4, customer_id: null },
    ]);

    expect(ids).toEqual(["cust-1", "cust-2"]);
  });

  it("attaches customer summaries to sales docs", () => {
    const docs = attachCustomersToSalesDocs(
      [
        { id: 11, customer_id: "cust-1", order_id: "CLM-1" },
        { id: 12, customer_id: null, order_id: "CLM-2" },
      ],
      [
        { id: "cust-1", name: "Ahmad", phone: "0541234567", customer_code: "CLAL-ABCD123" },
      ],
    );

    expect(docs[0].customer?.name).toBe("Ahmad");
    expect(docs[0].customer?.customer_code).toBe("CLAL-ABCD123");
    expect(docs[1].customer).toBeNull();
  });

  it("accepts customer_phone in sales doc create schema", () => {
    const parsed = createSalesDocSchema.parse({
      sale_type: "line",
      customer_phone: "0541234567",
      total_amount: 99,
    });

    expect(parsed.customer_phone).toBe("0541234567");
    expect(parsed.currency).toBe("ILS");
  });

  it("accepts customer_phone in sales doc update schema", () => {
    const parsed = updateSalesDocSchema.parse({
      id: 5,
      customer_phone: "0541234567",
    });

    expect(parsed.id).toBe(5);
    expect(parsed.customer_phone).toBe("0541234567");
  });
});