// =====================================================
// ClalMobile — Admin Queries
// Server-side CRUD for all admin entities
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";
import { INTEGRATION_TYPES } from "@/lib/constants";
import type { Product, Coupon, Hero, LinePlan, Integration } from "@/types/database";

const db = () => createAdminSupabase();

// ===== Dashboard Stats =====
export async function getDashboardStats() {
  const s = db();
  const [orders, products, customers] = await Promise.all([
    s.from("orders").select("id, status, source, total, created_at"),
    s.from("products").select("id, stock, sold, price, active"),
    s.from("customers").select("id, segment, total_spent"),
  ]);

  const ordersData = (orders.data || []) as Array<{ id: string; status: string; source: string; total: number; created_at: string }>;
  const productsData = (products.data || []) as Array<{ id: string; stock: number; sold: number; price: number; active: boolean }>;
  const customersData = (customers.data || []) as Array<{ id: string; segment: string; total_spent: number }>;

  const totalRevenue = ordersData.filter((o) => o.status !== "rejected").reduce((s, o) => s + Number(o.total), 0);
  const newOrders = ordersData.filter((o) => o.status === "new").length;
  const noReply = ordersData.filter((o) => o.status?.startsWith("no_reply")).length;
  const lowStock = productsData.filter((p) => p.stock > 0 && p.stock <= 5 && p.active).length;
  const outOfStock = productsData.filter((p) => p.stock === 0 && p.active).length;
  const vipCustomers = customersData.filter((c) => c.segment === "vip").length;

  // Source distribution
  const sources: Record<string, number> = {};
  ordersData.forEach((o) => { sources[o.source] = (sources[o.source] || 0) + 1; });

  // Status distribution
  const statuses: Record<string, number> = {};
  ordersData.forEach((o) => { statuses[o.status] = (statuses[o.status] || 0) + 1; });

  return {
    totalRevenue, totalOrders: ordersData.length, newOrders, noReply,
    totalProducts: productsData.length, lowStock, outOfStock,
    totalCustomers: customersData.length, vipCustomers,
    sources, statuses,
  };
}

// ===== Products CRUD =====
export async function getAdminProducts(opts?: { limit?: number; offset?: number }) {
  const limit = opts?.limit ?? 0;
  const offset = opts?.offset ?? 0;

  if (limit > 0) {
    const [{ data, error }, { count }] = await Promise.all([
      db().from("products").select("*").order("created_at", { ascending: false }).range(offset, offset + limit - 1),
      db().from("products").select("id", { count: "exact", head: true }),
    ]);
    if (error) throw error;
    return { data: (data || []) as Product[], total: count ?? 0 };
  }

  // No pagination — return all with safety limit (backward compat)
  const { data } = await db().from("products").select("*").order("created_at", { ascending: false }).limit(500);
  return { data: (data || []) as Product[], total: (data || []).length };
}

export async function createProduct(product: Omit<Product, "id" | "created_at" | "updated_at">) {
  const { data, error } = await db().from("products").insert(product).select().single();
  if (error) throw error;
  return data;
}

export async function updateProduct(id: string, updates: Partial<Product>) {
  const { data, error } = await db().from("products").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(id: string) {
  const { error } = await db().from("products").delete().eq("id", id);
  if (error) throw error;
}

// ===== Coupons CRUD =====
export async function getAdminCoupons() {
  const { data, error } = await db().from("coupons").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  return (data || []) as Coupon[];
}

export async function createCoupon(coupon: Omit<Coupon, "id" | "created_at">) {
  const { data, error } = await db().from("coupons").insert(coupon).select().single();
  if (error) throw error;
  return data;
}

export async function updateCoupon(id: string, updates: Partial<Coupon>) {
  const { data, error } = await db().from("coupons").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCoupon(id: string) {
  const { error } = await db().from("coupons").delete().eq("id", id);
  if (error) throw error;
}

// ===== Heroes CRUD =====
export async function getAdminHeroes() {
  const { data, error } = await db().from("heroes").select("*").order("sort_order");
  if (error) throw error;
  return (data || []) as Hero[];
}

export async function createHero(hero: Omit<Hero, "id" | "created_at">) {
  const { data, error } = await db().from("heroes").insert(hero).select().single();
  if (error) throw error;
  return data;
}

export async function updateHero(id: string, updates: Partial<Hero>) {
  const { data, error } = await db().from("heroes").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteHero(id: string) {
  const { error } = await db().from("heroes").delete().eq("id", id);
  if (error) throw error;
}

// ===== Line Plans CRUD =====
export async function getAdminLines() {
  const { data, error } = await db().from("line_plans").select("*").order("sort_order");
  if (error) throw error;
  return (data || []) as LinePlan[];
}

export async function createLine(line: Omit<LinePlan, "id" | "created_at">) {
  const { data, error } = await db().from("line_plans").insert(line).select().single();
  if (error) throw error;
  return data;
}

export async function updateLine(id: string, updates: Partial<LinePlan>) {
  const { data, error } = await db().from("line_plans").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteLine(id: string) {
  const { error } = await db().from("line_plans").delete().eq("id", id);
  if (error) throw error;
}

// ===== Settings =====
export async function getAdminSettings() {
  const { data, error } = await db().from("settings").select("*");
  if (error) throw error;
  const map: Record<string, string> = {};
  (data || []).forEach((s: { key: string; value: string }) => { map[s.key] = s.value; });
  return map;
}

export async function updateSetting(key: string, value: string) {
  const { error } = await db()
    .from("settings")
    .upsert({ key, value, type: "string" }, { onConflict: "key" });
  if (error) throw new Error(`updateSetting error: ${error.message}`);
}

// ===== Integrations =====
export async function getIntegrations() {
  const supabase = db();
  const { data, error } = await supabase.from("integrations").select("*");
  if (error) throw error;
  let existing = (data || []) as Integration[];

  // Deduplicate: keep the row with the most config for each type
  const byType = new Map<string, Integration[]>();
  for (const row of existing) {
    const arr = byType.get(row.type) || [];
    arr.push(row);
    byType.set(row.type, arr);
  }
  const dupeIds: string[] = [];
  const deduped: Integration[] = [];
  for (const [, rows] of byType) {
    if (rows.length > 1) {
      rows.sort((a, b) => {
        const aKeys = Object.keys(a.config || {}).filter(k => !k.startsWith("_has_") && (a.config as any)[k]).length;
        const bKeys = Object.keys(b.config || {}).filter(k => !k.startsWith("_has_") && (b.config as any)[k]).length;
        return bKeys - aKeys;
      });
      deduped.push(rows[0]);
      for (let i = 1; i < rows.length; i++) dupeIds.push(rows[i].id);
    } else {
      deduped.push(rows[0]);
    }
  }
  if (dupeIds.length > 0) {
    await supabase.from("integrations").delete().in("id", dupeIds);
  }
  existing = deduped;

  // Ensure all types exist
  const existingTypes = new Set(existing.map((i) => i.type));
  const allTypes = Object.keys(INTEGRATION_TYPES);
  const missing = allTypes.filter((t) => !existingTypes.has(t));
  if (missing.length > 0) {
    const rows = missing.map((type) => ({ type, provider: "", config: {}, status: "inactive" as const }));
    const { data: inserted } = await supabase.from("integrations").insert(rows).select();
    if (inserted) existing.push(...(inserted as Integration[]));
  }
  return existing;
}

export async function updateIntegration(id: string, updates: Partial<Integration>) {
  const payload: Record<string, unknown> = { ...updates };
  // Always update last_synced_at when modifying an integration
  if (!payload.last_synced_at) payload.last_synced_at = new Date().toISOString();
  const { data, error } = await db().from("integrations").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

/** Get integration config by type (for server-side provider initialization) */
export async function getIntegrationByType(type: string): Promise<Integration | null> {
  const { data, error } = await db().from("integrations").select("*").eq("type", type).single();
  if (error && error.code !== "PGRST116") throw error;
  return (data as Integration) || null;
}

// ===== Audit =====
export async function logAction(userName: string, action: string, entityType: string, entityId?: string) {
  await db().from("audit_log").insert({ user_name: userName, action, entity_type: entityType, entity_id: entityId });
}
