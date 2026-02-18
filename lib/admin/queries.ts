// =====================================================
// ClalMobile — Admin Queries
// Server-side CRUD for all admin entities
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";
import type { Product, Coupon, Hero, LinePlan, Integration } from "@/types/database";

const db = () => createAdminSupabase();

// ===== Dashboard Stats =====
export async function getDashboardStats() {
  const s = db();
  const [orders, products, customers, revenue] = await Promise.all([
    s.from("orders").select("id, status, source, total, created_at"),
    s.from("products").select("id, stock, sold, price, active"),
    s.from("customers").select("id, segment, total_spent"),
    s.from("orders").select("total").not("status", "eq", "rejected"),
  ]);

  const ordersData = orders.data || [];
  const productsData = products.data || [];
  const customersData = customers.data || [];

  const totalRevenue = (revenue.data || []).reduce((s: number, o: any) => s + Number(o.total), 0);
  const newOrders = ordersData.filter((o: any) => o.status === "new").length;
  const noReply = ordersData.filter((o: any) => o.status?.startsWith("no_reply")).length;
  const lowStock = productsData.filter((p: any) => p.stock > 0 && p.stock <= 5 && p.active).length;
  const outOfStock = productsData.filter((p: any) => p.stock === 0 && p.active).length;
  const vipCustomers = customersData.filter((c: any) => c.segment === "vip").length;

  // Source distribution
  const sources: Record<string, number> = {};
  ordersData.forEach((o: any) => { sources[o.source] = (sources[o.source] || 0) + 1; });

  // Status distribution
  const statuses: Record<string, number> = {};
  ordersData.forEach((o: any) => { statuses[o.status] = (statuses[o.status] || 0) + 1; });

  return {
    totalRevenue, totalOrders: ordersData.length, newOrders, noReply,
    totalProducts: productsData.length, lowStock, outOfStock,
    totalCustomers: customersData.length, vipCustomers,
    sources, statuses,
  };
}

// ===== Products CRUD =====
export async function getAdminProducts() {
  const { data } = await db().from("products").select("*").order("created_at", { ascending: false });
  return (data || []) as Product[];
}

export async function createProduct(product: any) {
  const { data, error } = await db().from("products").insert(product).select().single();
  if (error) throw error;
  return data;
}

export async function updateProduct(id: string, updates: any) {
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
  const { data } = await db().from("coupons").select("*").order("created_at", { ascending: false });
  return (data || []) as Coupon[];
}

export async function createCoupon(coupon: any) {
  const { data, error } = await db().from("coupons").insert(coupon).select().single();
  if (error) throw error;
  return data;
}

export async function updateCoupon(id: string, updates: any) {
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
  const { data } = await db().from("heroes").select("*").order("sort_order");
  return (data || []) as Hero[];
}

export async function createHero(hero: any) {
  const { data, error } = await db().from("heroes").insert(hero).select().single();
  if (error) throw error;
  return data;
}

export async function updateHero(id: string, updates: any) {
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
  const { data } = await db().from("line_plans").select("*").order("sort_order");
  return (data || []) as LinePlan[];
}

export async function createLine(line: any) {
  const { data, error } = await db().from("line_plans").insert(line).select().single();
  if (error) throw error;
  return data;
}

export async function updateLine(id: string, updates: any) {
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
  const { data } = await db().from("settings").select("*");
  const map: Record<string, string> = {};
  (data || []).forEach((s: any) => { map[s.key] = s.value; });
  return map;
}

export async function updateSetting(key: string, value: string) {
  // Try update first, then insert if not exists
  const supabase = db();
  const { data: existing } = await supabase.from("settings").select("key").eq("key", key).single();
  
  if (existing) {
    const { error } = await supabase.from("settings").update({ value }).eq("key", key);
    if (error) throw new Error(`updateSetting update error: ${error.message}`);
  } else {
    const { error } = await supabase.from("settings").insert({ key, value, type: "string" });
    if (error) throw new Error(`updateSetting insert error: ${error.message}`);
  }
}

// ===== Integrations =====
export async function getIntegrations() {
  const { data } = await db().from("integrations").select("*");
  return (data || []) as Integration[];
}

export async function updateIntegration(id: string, updates: any) {
  const payload: any = { ...updates };
  // Always update last_synced_at when modifying an integration
  if (!payload.last_synced_at) payload.last_synced_at = new Date().toISOString();
  const { data, error } = await db().from("integrations").update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

/** Get integration config by type (for server-side provider initialization) */
export async function getIntegrationByType(type: string): Promise<Integration | null> {
  const { data } = await db().from("integrations").select("*").eq("type", type).single();
  return (data as Integration) || null;
}

// ===== Audit =====
export async function logAction(userName: string, action: string, entityType: string, entityId?: string) {
  await db().from("audit_log").insert({ user_name: userName, action, entity_type: entityType, entity_id: entityId });
}
