/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Utilities for staging tests (Layer 3).
 *
 * These functions connect to REAL Supabase using SUPABASE_SERVICE_ROLE_KEY.
 * All data is prefixed with TEST_ and cleaned up after each run.
 *
 * DO NOT import this from unit or integration tests — only from tests/staging/.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const TEST_PREFIX = "TEST_";

let cachedClient: SupabaseClient | null = null;

export function getTestSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const rawUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const url = rawUrl?.trim();
  const key = rawKey?.trim();

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for staging tests. " +
      "Set them in your environment or GitHub Actions secrets.",
    );
  }

  if (!/^https?:\/\//.test(url)) {
    throw new Error(
      `SUPABASE_URL is not a valid URL (got "${url.slice(0, 20)}..."). ` +
      "Check the secret value in GitHub Actions.",
    );
  }

  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

/** Create a full set of test data. Returns IDs for later cleanup. */
export async function createStagingData(): Promise<{
  productIds: string[];
  customerIds: string[];
  orderIds: string[];
  conversationIds: string[];
  couponIds: string[];
}> {
  const db = getTestSupabaseClient();

  // Pre-clean any leftover TEST_ rows from previous runs (unique-constraint safety)
  await cleanupStagingData().catch(() => {});

  // Unique suffix so re-runs don't collide on phone/email unique constraints
  const uniq = Date.now().toString(36);

  // 1. Products (5)
  const productsData = [
    { type: "device", brand: "Apple", name_ar: `${TEST_PREFIX}iPhone 15`, name_he: `${TEST_PREFIX}iPhone 15 HE`, price: 3499, cost: 2500, stock: 10, sold: 0, gallery: [], colors: [], storage_options: [], variants: [], specs: {}, active: true, featured: false },
    { type: "device", brand: "Samsung", name_ar: `${TEST_PREFIX}Galaxy S24`, name_he: `${TEST_PREFIX}Galaxy S24 HE`, price: 2999, cost: 2100, stock: 15, sold: 0, gallery: [], colors: [], storage_options: [], variants: [], specs: {}, active: true, featured: true },
    { type: "accessory", brand: "Apple", name_ar: `${TEST_PREFIX}AirPods`, name_he: `${TEST_PREFIX}AirPods HE`, price: 899, cost: 600, stock: 50, sold: 0, gallery: [], colors: [], storage_options: [], variants: [], specs: {}, active: true, featured: false },
    { type: "device", brand: "Xiaomi", name_ar: `${TEST_PREFIX}Redmi Note`, name_he: `${TEST_PREFIX}Redmi Note HE`, price: 999, cost: 700, stock: 20, sold: 0, gallery: [], colors: [], storage_options: [], variants: [], specs: {}, active: true, featured: false },
    { type: "accessory", brand: "Generic", name_ar: `${TEST_PREFIX}Charger`, name_he: `${TEST_PREFIX}Charger HE`, price: 89, cost: 40, stock: 100, sold: 0, gallery: [], colors: [], storage_options: [], variants: [], specs: {}, active: true, featured: false },
  ];
  const { data: products, error: pErr } = await db.from("products").insert(productsData).select();
  if (pErr) throw new Error(`Failed to create test products: ${pErr.message}`);

  // 2. Customers (3) — use time-based unique phone suffixes to avoid collisions on re-runs
  const phone1 = `050999${uniq.slice(-4)}1`;
  const phone2 = `050999${uniq.slice(-4)}2`;
  const phone3 = `050999${uniq.slice(-4)}3`;
  const customersData = [
    { name: `${TEST_PREFIX}Ahmad`, phone: phone1, customer_code: `${TEST_PREFIX}C${uniq}1`, city: "חיפה", email: `${TEST_PREFIX.toLowerCase()}a${uniq}@test.com`, total_orders: 0, total_spent: 0, avg_order_value: 0, segment: "new", tags: [] },
    { name: `${TEST_PREFIX}Sara`, phone: phone2, customer_code: `${TEST_PREFIX}C${uniq}2`, city: "תל אביב", email: `${TEST_PREFIX.toLowerCase()}s${uniq}@test.com`, total_orders: 2, total_spent: 5000, avg_order_value: 2500, segment: "active", tags: ["vip"] },
    { name: `${TEST_PREFIX}Yosef`, phone: phone3, customer_code: `${TEST_PREFIX}C${uniq}3`, city: "ירושלים", email: `${TEST_PREFIX.toLowerCase()}y${uniq}@test.com`, total_orders: 0, total_spent: 0, avg_order_value: 0, segment: "new", tags: [] },
  ];
  const { data: customers, error: cErr } = await db.from("customers").insert(customersData).select();
  if (cErr) throw new Error(`Failed to create test customers: ${cErr.message}`);

  // 3. Orders (2) — valid statuses are defined in migration 022: new|approved|processing|shipped|delivered|cancelled|rejected|returned|no_reply_1..3
  const ordersData = [
    { id: `${TEST_PREFIX}ORD${uniq}1`, customer_id: customers![0].id, status: "new", source: "store", items_total: 3499, discount_amount: 0, total: 3499, payment_method: "credit", payment_details: {}, shipping_city: "חיפה", shipping_address: "Test 1", commission_synced: false },
    { id: `${TEST_PREFIX}ORD${uniq}2`, customer_id: customers![1].id, status: "approved", source: "whatsapp", items_total: 2999, discount_amount: 100, total: 2899, payment_method: "bank", payment_details: {}, shipping_city: "תל אביב", shipping_address: "Test 2", commission_synced: false },
  ];
  const { data: orders, error: oErr } = await db.from("orders").insert(ordersData).select();
  if (oErr) throw new Error(`Failed to create test orders: ${oErr.message}`);

  // 4. Inbox conversations (3)
  const conversationsData = [
    { customer_phone: phone1, customer_name: `${TEST_PREFIX}Ahmad`, channel: "whatsapp", status: "active", priority: "normal", pinned: false, is_blocked: false, unread_count: 1, last_message_text: `${TEST_PREFIX}conversation`, last_message_at: new Date().toISOString(), last_message_direction: "inbound", source: "direct", metadata: {} },
    { customer_phone: phone2, customer_name: `${TEST_PREFIX}Sara`, channel: "webchat", status: "waiting", priority: "high", pinned: true, is_blocked: false, unread_count: 0, last_message_text: `${TEST_PREFIX}waiting`, last_message_at: new Date().toISOString(), last_message_direction: "outbound", source: "direct", metadata: {} },
    { customer_phone: phone3, customer_name: `${TEST_PREFIX}Yosef`, channel: "whatsapp", status: "resolved", priority: "low", pinned: false, is_blocked: false, unread_count: 0, last_message_text: `${TEST_PREFIX}resolved`, last_message_at: new Date().toISOString(), last_message_direction: "outbound", source: "direct", metadata: {} },
  ];
  const { data: conversations, error: convErr } = await db.from("inbox_conversations").insert(conversationsData).select();
  if (convErr) throw new Error(`Failed to create test conversations: ${convErr.message}`);

  // 5. Coupon (1) — unique code per run
  const couponsData = [
    { code: `${TEST_PREFIX}SAVE${uniq}`, type: "percent", value: 10, min_order: 0, max_uses: 100, used_count: 0, active: true },
  ];
  const { data: coupons, error: couErr } = await db.from("coupons").insert(couponsData).select();
  if (couErr) throw new Error(`Failed to create test coupons: ${couErr.message}`);

  return {
    productIds: (products ?? []).map((p: any) => p.id),
    customerIds: (customers ?? []).map((c: any) => c.id),
    orderIds: (orders ?? []).map((o: any) => o.id),
    conversationIds: (conversations ?? []).map((c: any) => c.id),
    couponIds: (coupons ?? []).map((c: any) => c.id),
  };
}

/** Remove ALL data with the TEST_ prefix. Always runs afterAll, even if tests fail. */
export async function cleanupStagingData(): Promise<void> {
  const db = getTestSupabaseClient();

  // Delete in dependency order
  await db.from("order_items").delete().like("order_id", `${TEST_PREFIX}%`);
  await db.from("order_status_history").delete().like("order_id", `${TEST_PREFIX}%`);
  await db.from("order_notes").delete().like("order_id", `${TEST_PREFIX}%`);
  await db.from("orders").delete().like("id", `${TEST_PREFIX}%`);
  await db.from("inbox_messages").delete().in(
    "conversation_id",
    (await db.from("inbox_conversations").select("id").like("customer_name", `${TEST_PREFIX}%`)).data?.map((r: any) => r.id) ?? [],
  );
  await db.from("inbox_notes").delete().in(
    "conversation_id",
    (await db.from("inbox_conversations").select("id").like("customer_name", `${TEST_PREFIX}%`)).data?.map((r: any) => r.id) ?? [],
  );
  await db.from("inbox_conversations").delete().like("customer_name", `${TEST_PREFIX}%`);
  await db.from("customer_notes").delete().in(
    "customer_id",
    (await db.from("customers").select("id").like("name", `${TEST_PREFIX}%`)).data?.map((r: any) => r.id) ?? [],
  );
  await db.from("customer_hot_accounts").delete().in(
    "customer_id",
    (await db.from("customers").select("id").like("name", `${TEST_PREFIX}%`)).data?.map((r: any) => r.id) ?? [],
  );
  await db.from("customers").delete().like("name", `${TEST_PREFIX}%`);
  await db.from("coupons").delete().like("code", `${TEST_PREFIX}%`);
  await db.from("products").delete().like("name_ar", `${TEST_PREFIX}%`);
  await db.from("commission_sales").delete().like("customer_name", `${TEST_PREFIX}%`);
  await db.from("pipeline_deals").delete().like("customer_name", `${TEST_PREFIX}%`);
  await db.from("tasks").delete().like("title", `${TEST_PREFIX}%`);
}

/** Helper for RLS tests — create a short-lived user session */
export async function createTestUserSession(role: "admin" | "user" = "user"): Promise<{
  userId: string;
  cleanup: () => Promise<void>;
}> {
  const db = getTestSupabaseClient();
  const email = `${TEST_PREFIX.toLowerCase()}${role}_${Date.now()}@test.local`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: "TestPassword123!",
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Failed to create test user: ${error?.message}`);

  // If admin, insert into users table
  if (role === "admin") {
    await db.from("users").insert({
      auth_id: data.user.id,
      name: `${TEST_PREFIX}Admin`,
      email,
      role: "super_admin",
      status: "active",
    });
  }

  return {
    userId: data.user.id,
    cleanup: async () => {
      await db.from("users").delete().eq("auth_id", data.user!.id);
      await db.auth.admin.deleteUser(data.user!.id);
    },
  };
}
