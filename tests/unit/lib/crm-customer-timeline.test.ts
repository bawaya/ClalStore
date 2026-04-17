import { describe, it, expect } from "vitest";
import { buildCustomerTimeline } from "@/lib/crm/customer-timeline";
import type { CustomerTimelineEntry } from "@/lib/crm/customer-timeline";

describe("buildCustomerTimeline", () => {
  // ─── Basic assembly ──────────────────────────────────────────

  it("builds a unified descending timeline from mixed sources", () => {
    const entries = buildCustomerTimeline({
      orders: [
        { id: "CLM-1", status: "approved", total: 499, created_at: "2026-04-10T10:00:00.000Z" },
      ],
      notes: [
        { id: "note-1", text: "عميل مهم", user_name: "Mira", created_at: "2026-04-11T09:00:00.000Z" },
      ],
      hotAccounts: [
        {
          id: "hot-1", label: "الخط الرئيسي", hot_mobile_id: "HOT-7788",
          status: "active", source: "admin_manual", created_at: "2026-04-09T08:00:00.000Z",
        },
      ],
      audits: [
        {
          id: "audit-1", action: "create", module: "crm",
          entity_type: "customer_hot_account", entity_id: "hot-1",
          details: { hot_mobile_id: "HOT-7788" },
          user_name: "Admin", created_at: "2026-04-12T12:00:00.000Z",
        },
      ],
    });

    expect(entries).toHaveLength(4);
    // Descending by date
    expect(entries[0].type).toBe("audit");
    expect(entries[1].type).toBe("note");
    expect(entries[2].type).toBe("order");
    expect(entries[3].type).toBe("hot");
  });

  // ─── Empty inputs ─────────────────────────────────────────────

  it("returns empty array when all inputs are empty", () => {
    const entries = buildCustomerTimeline({});
    expect(entries).toEqual([]);
  });

  it("returns empty array when inputs are undefined", () => {
    const entries = buildCustomerTimeline({
      orders: undefined,
      notes: undefined,
      conversations: undefined,
    });
    expect(entries).toEqual([]);
  });

  // ─── Orders ───────────────────────────────────────────────────

  it("formats order entries with id, status and total", () => {
    const [entry] = buildCustomerTimeline({
      orders: [{ id: "CLM-42", status: "shipped", total: 3499, created_at: "2026-04-10T10:00:00.000Z" }],
    });
    expect(entry.type).toBe("order");
    expect(entry.title).toContain("CLM-42");
    expect(entry.description).toContain("shipped");
    expect(entry.description).toContain("3,499");
    expect(entry.entityType).toBe("order");
    expect(entry.entityId).toBe("CLM-42");
  });

  it("handles order with null status and total", () => {
    const [entry] = buildCustomerTimeline({
      orders: [{ id: "CLM-99", status: null, total: null, created_at: "2026-04-01T00:00:00.000Z" }],
    });
    expect(entry.description).toContain("بدون حالة");
  });

  // ─── Deals ────────────────────────────────────────────────────

  it("formats deal entries with product name and value", () => {
    const [entry] = buildCustomerTimeline({
      deals: [{
        id: "deal-1", stage: "qualified", product_name: "iPhone 16",
        employee_name: "Sami", estimated_value: 5000, created_at: "2026-04-10T10:00:00.000Z",
      }],
    });
    expect(entry.type).toBe("deal");
    expect(entry.title).toBe("iPhone 16");
    expect(entry.description).toContain("qualified");
    expect(entry.description).toContain("5,000");
    expect(entry.actorName).toBe("Sami");
    expect(entry.entityType).toBe("pipeline_deal");
  });

  it("falls back to product_summary when product_name is missing", () => {
    const [entry] = buildCustomerTimeline({
      deals: [{
        id: "deal-2", product_summary: "Galaxy S25",
        created_at: "2026-04-10T00:00:00.000Z",
      }],
    });
    expect(entry.title).toBe("Galaxy S25");
  });

  it("uses fallback title when deal has no product info", () => {
    const [entry] = buildCustomerTimeline({
      deals: [{ id: "deal-3", created_at: "2026-04-10T00:00:00.000Z" }],
    });
    expect(entry.title).toBe("صفقة CRM");
  });

  // ─── Conversations ────────────────────────────────────────────

  it("formats conversation entries", () => {
    const [entry] = buildCustomerTimeline({
      conversations: [{
        id: "conv-1", channel: "whatsapp", status: "active",
        customer_name: "Ahmad", updated_at: "2026-04-10T10:00:00.000Z",
      }],
    });
    expect(entry.type).toBe("conversation");
    expect(entry.title).toContain("whatsapp");
    expect(entry.description).toContain("active");
    expect(entry.entityType).toBe("bot_conversation");
  });

  it("defaults channel to webchat when not specified", () => {
    const [entry] = buildCustomerTimeline({
      conversations: [{ id: "conv-2", updated_at: "2026-04-10T10:00:00.000Z" }],
    });
    expect(entry.title).toContain("webchat");
  });

  // ─── Notes ────────────────────────────────────────────────────

  it("formats note entries with truncated text", () => {
    const longText = "a".repeat(200);
    const [entry] = buildCustomerTimeline({
      notes: [{ id: "note-1", text: longText, user_name: "Admin", created_at: "2026-04-10T00:00:00.000Z" }],
    });
    expect(entry.type).toBe("note");
    expect(entry.description.length).toBeLessThanOrEqual(181); // 180 chars + ellipsis
    expect(entry.actorName).toBe("Admin");
  });

  // ─── HOT Accounts ────────────────────────────────────────────

  it("formats hot account entries with label", () => {
    const [entry] = buildCustomerTimeline({
      hotAccounts: [{
        id: "hot-1", label: "Main Line", hot_mobile_id: "HOT-123",
        status: "active", source: "manual", created_at: "2026-04-10T00:00:00.000Z",
      }],
    });
    expect(entry.type).toBe("hot");
    expect(entry.title).toBe("Main Line");
    expect(entry.description).toContain("active");
    expect(entry.description).toContain("HOT-123");
  });

  it("falls back to hot_mobile_id when no label", () => {
    const [entry] = buildCustomerTimeline({
      hotAccounts: [{
        id: "hot-2", hot_mobile_id: "HOT-999",
        status: "active", created_at: "2026-04-10T00:00:00.000Z",
      }],
    });
    expect(entry.title).toBe("HOT-999");
  });

  // ─── Audits ───────────────────────────────────────────────────

  it("formats audit entries with summarized details", () => {
    const [entry] = buildCustomerTimeline({
      audits: [{
        id: "audit-1", action: "update", module: "crm",
        entity_type: "customer_hot_account", entity_id: "hot-2",
        details: { hot_mobile_id: "HOT-9988", hot_customer_code: "HC-55", archived: true },
        user_name: "Admin", created_at: "2026-04-12T10:00:00.000Z",
      }],
    });
    expect(entry.type).toBe("audit");
    expect(entry.description).toContain("crm");
    expect(entry.description).toContain("HOT-9988");
    expect(entry.description).toContain("HC-55");
    expect(entry.description).toContain("أرشفة");
    expect(entry.actorName).toBe("Admin");
  });

  it("handles audit with no details", () => {
    const [entry] = buildCustomerTimeline({
      audits: [{
        id: "audit-2", action: "delete", module: "products",
        created_at: "2026-04-10T00:00:00.000Z",
      }],
    });
    expect(entry.description).toContain("products");
  });

  // ─── Sorting ──────────────────────────────────────────────────

  it("sorts entries in descending chronological order", () => {
    const entries = buildCustomerTimeline({
      orders: [
        { id: "CLM-1", total: 100, created_at: "2026-04-01T00:00:00.000Z" },
        { id: "CLM-2", total: 200, created_at: "2026-04-15T00:00:00.000Z" },
      ],
      notes: [
        { id: "note-1", text: "middle", created_at: "2026-04-10T00:00:00.000Z" },
      ],
    });

    expect(entries[0].id).toBe("order-CLM-2");
    expect(entries[1].id).toBe("note-note-1");
    expect(entries[2].id).toBe("order-CLM-1");
  });
});
