import { describe, expect, it } from "vitest";
import { buildCustomerTimeline } from "@/lib/crm/customer-timeline";

describe("buildCustomerTimeline", () => {
  it("builds a unified descending timeline from mixed sources", () => {
    const entries = buildCustomerTimeline({
      orders: [
        { id: "CLM-1", status: "approved", total: 499, created_at: "2026-04-10T10:00:00.000Z" },
      ],
      notes: [
        { id: "note-1", text: "عميل مهم ويحتاج متابعة", user_name: "Mira", created_at: "2026-04-11T09:00:00.000Z" },
      ],
      hotAccounts: [
        {
          id: "hot-1",
          label: "الخط الرئيسي",
          hot_mobile_id: "HOT-7788",
          status: "active",
          source: "admin_manual",
          created_at: "2026-04-09T08:00:00.000Z",
        },
      ],
      audits: [
        {
          id: "audit-1",
          action: "create",
          module: "crm",
          entity_type: "customer_hot_account",
          entity_id: "hot-1",
          details: { hot_mobile_id: "HOT-7788" },
          user_name: "Admin",
          created_at: "2026-04-12T12:00:00.000Z",
        },
      ],
    });

    expect(entries).toHaveLength(4);
    expect(entries[0].type).toBe("audit");
    expect(entries[1].type).toBe("note");
    expect(entries[2].type).toBe("order");
    expect(entries[3].type).toBe("hot");
  });

  it("summarizes audit details when available", () => {
    const [entry] = buildCustomerTimeline({
      audits: [
        {
          id: "audit-2",
          action: "update",
          module: "crm",
          entity_type: "customer_hot_account",
          entity_id: "hot-2",
          details: {
            hot_mobile_id: "HOT-9988",
            hot_customer_code: "HC-55",
            archived: true,
          },
          user_name: "Admin",
          created_at: "2026-04-12T10:00:00.000Z",
        },
      ],
    });

    expect(entry.description).toContain("crm");
    expect(entry.description).toContain("HOT-9988");
    expect(entry.description).toContain("HC-55");
    expect(entry.description).toContain("أرشفة");
  });
});
