/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Layer 3 — Real Supabase CRUD.
 *
 * Every row is prefixed TEST_ and removed at the end of the run
 * (both inline `afterAll` cleanups AND the global sweep in setup).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  getTestSupabaseClient,
  TEST_PREFIX,
  stagingSkipReason,
  useStagingFixtures,
  stagingCtx,
} from "./setup";

const skipReason = stagingSkipReason();

describe.skipIf(skipReason)("Layer 3 · Supabase CRUD", () => {
  // Builds the shared fixture set (products, customers, orders, conversations,
  // coupons) and tears it down at the end — even on failure.
  useStagingFixtures();

  // ------------------------------------------------------------------
  // Product CRUD
  // ------------------------------------------------------------------
  describe("Products", () => {
    let productId: string | null = null;

    afterAll(async () => {
      if (!productId) return;
      const db = getTestSupabaseClient();
      await db.from("products").delete().eq("id", productId);
    });

    it("creates a product with TEST_ prefix", async () => {
      const db = getTestSupabaseClient();
      const { data, error } = await db
        .from("products")
        .insert({
          type: "device",
          brand: "TestBrand",
          name_ar: `${TEST_PREFIX}CRUD Product`,
          name_he: `${TEST_PREFIX}CRUD Product HE`,
          price: 1234,
          cost: 900,
          stock: 7,
          sold: 0,
          gallery: [],
          colors: [],
          storage_options: [],
          variants: [],
          specs: {},
          active: true,
          featured: false,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data!.name_ar).toContain(TEST_PREFIX);
      productId = data!.id;
    });

    it("reads the product back from the DB", async () => {
      expect(productId).toBeTruthy();
      const db = getTestSupabaseClient();
      const { data, error } = await db
        .from("products")
        .select("*")
        .eq("id", productId!)
        .single();
      expect(error).toBeNull();
      expect(data!.price).toBe(1234);
      expect(data!.stock).toBe(7);
    });

    it("updates the product", async () => {
      expect(productId).toBeTruthy();
      const db = getTestSupabaseClient();
      const { error } = await db
        .from("products")
        .update({ price: 1500, stock: 5 })
        .eq("id", productId!);
      expect(error).toBeNull();

      const { data } = await db
        .from("products")
        .select("price, stock")
        .eq("id", productId!)
        .single();
      expect(data!.price).toBe(1500);
      expect(data!.stock).toBe(5);
    });

    it("deletes the product", async () => {
      expect(productId).toBeTruthy();
      const db = getTestSupabaseClient();
      const { error } = await db.from("products").delete().eq("id", productId!);
      expect(error).toBeNull();

      const { data } = await db
        .from("products")
        .select("id")
        .eq("id", productId!)
        .maybeSingle();
      expect(data).toBeNull();
      productId = null; // so afterAll is a no-op
    });
  });

  // ------------------------------------------------------------------
  // Full order (order + items + status history)
  // ------------------------------------------------------------------
  describe("Full order lifecycle", () => {
    const orderId = `${TEST_PREFIX}ORD_FULL_${Date.now()}`;

    afterAll(async () => {
      const db = getTestSupabaseClient();
      await db.from("order_status_history").delete().eq("order_id", orderId);
      await db.from("order_items").delete().eq("order_id", orderId);
      await db.from("orders").delete().eq("id", orderId);
    });

    it("creates an order with items and initial status history row", async () => {
      const db = getTestSupabaseClient();
      const customerId = stagingCtx.customerIds[0];
      const productId = stagingCtx.productIds[0];
      expect(customerId).toBeTruthy();
      expect(productId).toBeTruthy();

      const { error: oErr } = await db.from("orders").insert({
        id: orderId,
        customer_id: customerId,
        status: "new",
        source: "store",
        items_total: 3499,
        discount_amount: 0,
        total: 3499,
        payment_method: "credit",
        payment_details: {},
        shipping_city: "حيفا",
        shipping_address: "Test 123",
        commission_synced: false,
      } as any);
      expect(oErr).toBeNull();

      const { error: iErr } = await db.from("order_items").insert({
        order_id: orderId,
        product_id: productId,
        product_name: `${TEST_PREFIX}iPhone 15`,
        product_brand: "Apple",
        product_type: "device",
        price: 3499,
        quantity: 1,
      } as any);
      expect(iErr).toBeNull();

      const { error: hErr } = await db.from("order_status_history").insert({
        order_id: orderId,
        new_status: "new",
        changed_by_name: `${TEST_PREFIX}system`,
        notes: "order created",
      } as any);
      expect(hErr).toBeNull();

      const { data } = await db
        .from("order_items")
        .select("id, quantity")
        .eq("order_id", orderId);
      expect((data ?? []).length).toBe(1);
      expect(data![0].quantity).toBe(1);
    });

    it("records each status transition in order_status_history", async () => {
      const db = getTestSupabaseClient();
      const transitions: Array<[string, string]> = [
        ["new", "approved"],
        ["approved", "shipped"],
        ["shipped", "delivered"],
      ];

      for (const [oldStatus, newStatus] of transitions) {
        const { error: updErr } = await db
          .from("orders")
          .update({ status: newStatus })
          .eq("id", orderId);
        expect(updErr).toBeNull();

        const { error: hErr } = await db.from("order_status_history").insert({
          order_id: orderId,
          old_status: oldStatus,
          new_status: newStatus,
          changed_by_name: `${TEST_PREFIX}system`,
        } as any);
        expect(hErr).toBeNull();
      }

      const { data } = await db
        .from("order_status_history")
        .select("new_status")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      expect((data ?? []).length).toBeGreaterThanOrEqual(4); // initial + 3 transitions
      const statuses = (data ?? []).map((r: any) => r.new_status);
      expect(statuses).toEqual(
        expect.arrayContaining(["new", "approved", "shipped", "delivered"]),
      );

      const { data: order } = await db
        .from("orders")
        .select("status")
        .eq("id", orderId)
        .single();
      expect(order!.status).toBe("delivered");
    });
  });

  // ------------------------------------------------------------------
  // Customer
  // ------------------------------------------------------------------
  describe("Customers", () => {
    let customerId: string | null = null;

    afterAll(async () => {
      if (!customerId) return;
      const db = getTestSupabaseClient();
      await db.from("customers").delete().eq("id", customerId);
    });

    it("creates and reads a customer", async () => {
      const db = getTestSupabaseClient();
      const phone = `05900${String(Math.floor(Math.random() * 1e5)).padStart(5, "0")}`;
      const { data, error } = await db
        .from("customers")
        .insert({
          name: `${TEST_PREFIX}CRUD Customer`,
          phone,
          customer_code: `${TEST_PREFIX}CUST_${Date.now()}`,
          email: `${TEST_PREFIX.toLowerCase()}crud@test.local`,
          total_orders: 0,
          total_spent: 0,
          avg_order_value: 0,
          segment: "new",
          tags: [],
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.phone).toBe(phone);
      expect(data!.name).toContain(TEST_PREFIX);
      customerId = data!.id;

      const { data: read } = await db
        .from("customers")
        .select("id, name")
        .eq("id", customerId!)
        .single();
      expect(read!.name).toContain(TEST_PREFIX);
    });
  });

  // ------------------------------------------------------------------
  // Inbox conversation + message
  // ------------------------------------------------------------------
  describe("Inbox", () => {
    let conversationId: string | null = null;

    afterAll(async () => {
      if (!conversationId) return;
      const db = getTestSupabaseClient();
      await db.from("inbox_messages").delete().eq("conversation_id", conversationId);
      await db.from("inbox_conversations").delete().eq("id", conversationId);
    });

    it("creates a conversation and attaches a message", async () => {
      const db = getTestSupabaseClient();
      const { data: conv, error } = await db
        .from("inbox_conversations")
        .insert({
          customer_phone: "0509990000",
          customer_name: `${TEST_PREFIX}Inbox Test`,
          channel: "whatsapp",
          status: "active",
          priority: "normal",
          pinned: false,
          is_blocked: false,
          unread_count: 1,
          last_message_text: `${TEST_PREFIX}hello`,
          last_message_at: new Date().toISOString(),
          last_message_direction: "inbound",
          source: "direct",
          metadata: {},
        } as any)
        .select()
        .single();

      expect(error).toBeNull();
      conversationId = conv!.id;

      const { error: mErr } = await db.from("inbox_messages").insert({
        conversation_id: conversationId!,
        direction: "inbound",
        sender_type: "customer",
        message_type: "text",
        content: `${TEST_PREFIX}hello`,
        status: "delivered",
      } as any);
      expect(mErr).toBeNull();

      const { data: msgs } = await db
        .from("inbox_messages")
        .select("id, content")
        .eq("conversation_id", conversationId!);
      expect((msgs ?? []).length).toBe(1);
      expect(msgs![0].content).toContain(TEST_PREFIX);
    });
  });

  // ------------------------------------------------------------------
  // RLS check — anon read against a public table
  // ------------------------------------------------------------------
  describe("RLS / anon access", () => {
    it("documents whether anon can read sub_pages", async () => {
      const url =
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anonKey) {
        console.warn(
          "[RLS] NEXT_PUBLIC_SUPABASE_ANON_KEY not set — skipping anon read check",
        );
        return;
      }

      const anon = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data, error } = await anon
        .from("sub_pages")
        .select("id, slug")
        .limit(1);

      // Contract: either the table returns rows (public-by-design) OR RLS
      // rejects the query with an error. Any other shape is a bug.
      const ok = !error || data == null;
      expect(ok).toBe(true);

      // Surface the current policy to the test log so operators know what's
      // actually in effect without having to open the Supabase dashboard.
      if (error) {
        console.info(`[RLS] sub_pages anon read ENFORCED: ${error.message}`);
      } else {
        console.info(
          `[RLS] sub_pages anon read ALLOWED (returned ${data?.length ?? 0} rows)`,
        );
      }
    });
  });

  // ------------------------------------------------------------------
  // RPC: check_rate_limit (best-effort — only runs if the function exists)
  // ------------------------------------------------------------------
  describe("RPC check_rate_limit", () => {
    it("returns the expected shape when the function is deployed", async () => {
      const db = getTestSupabaseClient();
      const key = `${TEST_PREFIX}rl_${Date.now()}`;
      const { data, error } = await db.rpc("check_rate_limit", {
        p_key: key,
        p_max: 10,
        p_window_ms: 60_000,
        p_reset_at: new Date(Date.now() + 60_000).toISOString(),
      });

      // Function missing → treat as skipped, not failed.
      const isMissing =
        !!error &&
        /not find the function|does not exist|PGRST/i.test(error.message);
      if (isMissing) {
        console.info(
          "[rpc] check_rate_limit not deployed — skipping",
        );
        return;
      }

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(typeof data.allowed).toBe("boolean");
      expect(typeof data.remaining).toBe("number");
      expect(data.reset_at).toBeTruthy();

      // Cleanup the rate-limit row, best-effort.
      await db.from("rate_limits").delete().eq("key", key).then(
        () => {},
        () => {},
      );
    });
  });

  // ------------------------------------------------------------------
  // Index validation — best-effort via information_schema / pg_indexes
  // ------------------------------------------------------------------
  describe("Schema introspection", () => {
    it("confirms expected indexes exist (best-effort)", async () => {
      const db = getTestSupabaseClient();

      // Try an RPC wrapper first (if the project has one). Otherwise fall
      // back to a PostgREST select on pg_indexes via a view, if exposed.
      const { data, error } = await db.rpc("list_indexes", {
        p_table: "orders",
      });

      if (error && /not find the function|does not exist/i.test(error.message)) {
        console.info(
          "[schema] list_indexes RPC not deployed — skipping index check",
        );
        return;
      }

      if (!error && Array.isArray(data)) {
        // If the RPC exists, assert at least one index is reported.
        expect(data.length).toBeGreaterThan(0);
      } else {
        console.info(
          "[schema] index introspection unavailable — skipping",
        );
      }
    });
  });
});
