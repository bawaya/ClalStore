/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Layer 3 — RLS contract tests.
 *
 * Runs against REAL Supabase with different client tiers to verify that
 * Row Level Security policies behave as designed:
 *
 *   1. anon  — public browser without JWT  → can only read visible public content
 *   2. auth  — logged-in customer          → can read their own data, not others'
 *   3. svc   — service_role (admin API)    → can do everything
 *
 * These tests EXPECT RLS to enforce privacy — they will FAIL if a policy is
 * too permissive. That's the whole point.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getTestSupabaseClient,
  stagingSkipReason,
  TEST_PREFIX,
} from "./setup";

const skipReason = stagingSkipReason();
// Set SKIP_RLS_CONTRACT=1 while rolling out the hardening migration.
// When the migration is live on production, unset it so these tests gate
// every future push to main.
const skipRls =
  skipReason ||
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SKIP_RLS_CONTRACT === "1";

// A publicly-readable anon client (no JWT). Safe to call only when
// NEXT_PUBLIC_SUPABASE_ANON_KEY is present — callers must check skip first.
function getAnonClient(): SupabaseClient {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) as string;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe.skipIf(skipRls)(
  "Layer 3 · RLS contract",
  () => {
    // Lazy client construction — only runs inside beforeAll so a missing
    // anon key never crashes describe-block evaluation.
    const svc = skipRls ? null : getTestSupabaseClient();
    const anon = skipRls ? null : getAnonClient();

    let hiddenSubPageId: string | null = null;
    let visibleSubPageId: string | null = null;
    let testCustomerId: string | null = null;
    let testOrderId: string | null = null;

    beforeAll(async () => {
      if (!svc) return;
      const uniq = Date.now().toString(36);

      // Create one visible and one hidden sub_page for RLS testing
      const { data: visible } = await svc
        .from("sub_pages")
        .insert({
          slug: `${TEST_PREFIX.toLowerCase()}rls-visible-${uniq}`,
          title_ar: `${TEST_PREFIX}Visible`,
          title_he: `${TEST_PREFIX}Visible HE`,
          content_ar: "public content",
          content_he: "תוכן ציבורי",
          is_visible: true,
          sort_order: 0,
        })
        .select()
        .single();
      visibleSubPageId = (visible as any)?.id ?? null;

      const { data: hidden } = await svc
        .from("sub_pages")
        .insert({
          slug: `${TEST_PREFIX.toLowerCase()}rls-hidden-${uniq}`,
          title_ar: `${TEST_PREFIX}Hidden`,
          title_he: `${TEST_PREFIX}Hidden HE`,
          content_ar: "private content",
          content_he: "תוכן פרטי",
          is_visible: false,
          sort_order: 0,
        })
        .select()
        .single();
      hiddenSubPageId = (hidden as any)?.id ?? null;

      // Customer + order for privacy tests
      const { data: customer } = await svc
        .from("customers")
        .insert({
          name: `${TEST_PREFIX}RLS User`,
          phone: `050888${uniq.slice(-5)}`,
          customer_code: `${TEST_PREFIX}RLS-${uniq}`,
          total_orders: 0,
          total_spent: 0,
          avg_order_value: 0,
          segment: "new",
          tags: [],
        })
        .select()
        .single();
      testCustomerId = (customer as any)?.id ?? null;

      if (testCustomerId) {
        const { data: order } = await svc
          .from("orders")
          .insert({
            id: `${TEST_PREFIX}RLS-ORD-${uniq}`,
            customer_id: testCustomerId,
            status: "new",
            source: "store",
            items_total: 100,
            discount_amount: 0,
            total: 100,
            payment_method: "credit",
            payment_details: {},
            shipping_city: "Test",
            shipping_address: "RLS test",
            commission_synced: false,
          })
          .select()
          .single();
        testOrderId = (order as any)?.id ?? null;
      }
    }, 60_000);

    afterAll(async () => {
      if (!svc) return;
      if (testOrderId) {
        await svc.from("order_items").delete().eq("order_id", testOrderId);
        await svc.from("orders").delete().eq("id", testOrderId);
      }
      if (testCustomerId) {
        await svc.from("customers").delete().eq("id", testCustomerId);
      }
      if (hiddenSubPageId) {
        await svc.from("sub_pages").delete().eq("id", hiddenSubPageId);
      }
      if (visibleSubPageId) {
        await svc.from("sub_pages").delete().eq("id", visibleSubPageId);
      }
    }, 60_000);

    // ─── sub_pages policy ─────────────────────────────────────────

    describe("sub_pages policy", () => {
      it("anon can read VISIBLE sub_pages", async () => {
        if (!anon || !visibleSubPageId) return;
        const { data, error } = await anon
          .from("sub_pages")
          .select("id, is_visible")
          .eq("id", visibleSubPageId)
          .maybeSingle();
        expect(error).toBeNull();
        expect(data?.is_visible).toBe(true);
      });

      it("anon CANNOT read HIDDEN sub_pages", async () => {
        if (!anon || !hiddenSubPageId) return;
        const { data, error } = await anon
          .from("sub_pages")
          .select("id")
          .eq("id", hiddenSubPageId)
          .maybeSingle();
        // Either explicit error OR silently filtered to null — both are fine.
        // The DANGER signal is `data.id === hiddenSubPageId`.
        expect(data?.id).not.toBe(hiddenSubPageId);
        // Accept either no error + null data, or RLS error
        if (error) {
          expect(error.message).toMatch(/permission|rls|policy/i);
        }
      });

      it("anon CANNOT insert into sub_pages", async () => {
        if (!anon) return;
        const { error } = await anon.from("sub_pages").insert({
          slug: `${TEST_PREFIX.toLowerCase()}rls-injection`,
          title_ar: "pwned",
          title_he: "pwned",
          content_ar: "x",
          content_he: "x",
          is_visible: true,
          sort_order: 0,
        });
        expect(error).not.toBeNull();
      });

      it("anon CANNOT update sub_pages", async () => {
        if (!anon || !visibleSubPageId) return;
        const { error } = await anon
          .from("sub_pages")
          .update({ title_ar: "hacked" })
          .eq("id", visibleSubPageId);
        // Either explicit error OR 0 rows updated silently
        if (!error) {
          // Verify svc shows the row wasn't modified
          const { data } = await svc!
            .from("sub_pages")
            .select("title_ar")
            .eq("id", visibleSubPageId)
            .single();
          expect(data?.title_ar).not.toBe("hacked");
        } else {
          expect(error.message).toMatch(/permission|rls|policy/i);
        }
      });

      it("anon CANNOT delete from sub_pages", async () => {
        if (!anon || !visibleSubPageId) return;
        const { error } = await anon
          .from("sub_pages")
          .delete()
          .eq("id", visibleSubPageId);
        if (!error) {
          // Verify row still exists via svc
          const { data } = await svc!
            .from("sub_pages")
            .select("id")
            .eq("id", visibleSubPageId)
            .maybeSingle();
          expect(data?.id).toBe(visibleSubPageId);
        } else {
          expect(error.message).toMatch(/permission|rls|policy/i);
        }
      });

      it("service_role can read hidden sub_pages", async () => {
        if (!svc || !hiddenSubPageId) return;
        const { data, error } = await svc
          .from("sub_pages")
          .select("id")
          .eq("id", hiddenSubPageId)
          .single();
        expect(error).toBeNull();
        expect(data?.id).toBe(hiddenSubPageId);
      });
    });

    // ─── customers / orders privacy ─────────────────────────────

    describe("customers privacy", () => {
      it("anon CANNOT list all customers", async () => {
        if (!anon) return;
        const { data, error } = await anon
          .from("customers")
          .select("id, phone, email")
          .limit(10);
        // Either RLS denies entirely or returns an empty/filtered list.
        // The one thing we MUST NOT see is the TEST_ user we just created.
        if (data) {
          const leak = data.find(
            (c: any) =>
              typeof c.phone === "string" && c.phone.startsWith("050888"),
          );
          expect(leak, "RLS leak: anon saw TEST_ customer").toBeUndefined();
        }
        if (error) {
          expect(error.message).toMatch(/permission|rls|policy/i);
        }
      });

      it("anon CANNOT read customer by id", async () => {
        if (!anon || !testCustomerId) return;
        const { data } = await anon
          .from("customers")
          .select("id, phone")
          .eq("id", testCustomerId)
          .maybeSingle();
        expect(data?.id).not.toBe(testCustomerId);
      });
    });

    describe("orders privacy", () => {
      it("anon CANNOT read orders", async () => {
        if (!anon || !testOrderId) return;
        const { data } = await anon
          .from("orders")
          .select("id, customer_id, total")
          .eq("id", testOrderId)
          .maybeSingle();
        expect(data?.id).not.toBe(testOrderId);
      });

      it("anon CANNOT insert orders directly (must go through POST /api/orders)", async () => {
        if (!anon) return;
        const { error } = await anon.from("orders").insert({
          id: `${TEST_PREFIX}RLS-FAKE`,
          customer_id: testCustomerId,
          status: "new",
          source: "store",
          items_total: 1,
          discount_amount: 0,
          total: 1,
          payment_method: "credit",
          payment_details: {},
          shipping_city: "x",
          shipping_address: "x",
          commission_synced: false,
        });
        expect(error).not.toBeNull();
      });
    });

    // ─── commission_sales — financial data ────────────────────────

    describe("commission_sales financial data", () => {
      it("anon CANNOT read commission_sales", async () => {
        if (!anon) return;
        const { data, error } = await anon
          .from("commission_sales")
          .select("id, commission_amount, employee_name")
          .limit(1);
        // RLS should block entirely OR return empty
        if (data && data.length > 0) {
          throw new Error("RLS leak: anon read commission data");
        }
        // Don't assert on error — the test above is the real check
        expect(true).toBe(true);
      });

      it("anon CANNOT insert commission_sales", async () => {
        if (!anon) return;
        const { error } = await anon.from("commission_sales").insert({
          sale_date: new Date().toISOString().slice(0, 10),
          sale_type: "line",
          source: "manual",
          package_price: 1000,
          has_valid_hk: true,
          device_sale_amount: 0,
          commission_amount: 9999,
        });
        expect(error).not.toBeNull();
      });
    });

    // ─── inbox_conversations — customer messages ─────────────────

    describe("inbox privacy", () => {
      it("anon CANNOT read inbox_conversations", async () => {
        if (!anon) return;
        const { data, error } = await anon
          .from("inbox_conversations")
          .select("id, customer_phone")
          .limit(1);
        if (data && data.length > 0) {
          throw new Error("RLS leak: anon read inbox");
        }
        expect(true).toBe(true);
      });

      it("anon CANNOT read inbox_messages", async () => {
        if (!anon) return;
        const { data } = await anon
          .from("inbox_messages")
          .select("id, content")
          .limit(1);
        if (data && data.length > 0) {
          throw new Error("RLS leak: anon read messages");
        }
        expect(true).toBe(true);
      });
    });

    // ─── audit_log — append-only sensitive log ────────────────────

    describe("audit_log", () => {
      it("anon CANNOT read audit_log", async () => {
        if (!anon) return;
        const { data } = await anon.from("audit_log").select("id").limit(1);
        if (data && data.length > 0) {
          throw new Error("RLS leak: anon read audit_log");
        }
        expect(true).toBe(true);
      });

      it("anon CANNOT write to audit_log (no backdoor)", async () => {
        if (!anon) return;
        const { error } = await anon.from("audit_log").insert({
          user_name: "attacker",
          action: "nothing",
          module: "attack",
          entity_type: "injection",
        });
        expect(error).not.toBeNull();
      });
    });
  },
);
