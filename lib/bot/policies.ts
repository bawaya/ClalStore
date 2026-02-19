// =====================================================
// ClalMobile — Bot Policies Engine
// Load policies from bot_policies table
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";

const db = () => createAdminSupabase();

export type PolicyType = "warranty" | "return" | "privacy" | "terms" | "shipping" | "installments" | "faq";

export interface BotPolicy {
  id: string;
  type: PolicyType;
  title_ar: string;
  title_he?: string;
  content_ar: string;
  content_he?: string;
  page_url?: string;
  active: boolean;
}

// ===== Cache =====
let policyCache: BotPolicy[] | null = null;
let policyCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

// ===== Load policies =====
export async function loadPolicies(): Promise<BotPolicy[]> {
  const now = Date.now();
  if (policyCache && now - policyCacheTime < CACHE_TTL) return policyCache;

  try {
    const { data } = await db()
      .from("bot_policies")
      .select("*")
      .eq("active", true)
      .order("sort_order");

    policyCache = (data || []) as BotPolicy[];
    policyCacheTime = now;
    return policyCache;
  } catch {
    return [];
  }
}

// ===== Get policy by type =====
export async function getPolicy(type: PolicyType): Promise<BotPolicy | null> {
  const policies = await loadPolicies();
  return policies.find(p => p.type === type) || null;
}

// ===== Detect policy type from message =====
export function detectPolicyType(message: string): PolicyType | null {
  const lower = message.toLowerCase();

  if (/ضمان|אחריות|warranty/i.test(lower)) return "warranty";
  if (/ارجاع|إرجاع|استرجاع|استبدال|تبديل|الغاء|إلغاء|החזרה|ביטול|החלפה|return|refund|exchange|cancel/i.test(lower)) return "return";
  if (/شحن|توصيل|משלוח|shipping|delivery/i.test(lower)) return "shipping";
  if (/تقسيط|قسط|دفعات|תשלומים|installment/i.test(lower)) return "installments";
  if (/خصوصية|بيانات|פרטיות|privacy/i.test(lower)) return "privacy";

  return null;
}

// ===== Format policy response =====
export function formatPolicyResponse(policy: BotPolicy, lang: "ar" | "he" | "en"): string {
  const title = lang === "he" ? (policy.title_he || policy.title_ar) : policy.title_ar;
  const content = lang === "he" ? (policy.content_he || policy.content_ar) : policy.content_ar;
  const pageLink = policy.page_url ? `\n\n📄 المزيد: clalmobile.com${policy.page_url}` : "";

  return `📋 *${title}*\n\n${content}${pageLink}`;
}

// ===== Invalidate cache =====
export function invalidatePolicyCache(): void {
  policyCache = null;
  policyCacheTime = 0;
}
