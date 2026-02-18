// =====================================================
// ClalMobile — Integration Hub
// Swappable provider abstraction for all integrations
// Change provider without changing business logic
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";

// ===== DB Config Helper =====
/** Read integration config from DB by type, returns config JSONB or empty object */
export async function getIntegrationConfig(type: string): Promise<Record<string, any>> {
  try {
    const db = createAdminSupabase();
    const { data } = await db
      .from("integrations")
      .select("config, status")
      .eq("type", type)
      .single();
    if (data && data.status === "active" && data.config) {
      return data.config as Record<string, any>;
    }
  } catch {
    // DB unavailable — fall through to env vars
  }
  return {};
}

// ===== Payment Provider Interface =====
export interface PaymentProvider {
  name: string;
  createCharge(params: ChargeParams): Promise<ChargeResult>;
  verifyPayment(transactionId: string): Promise<PaymentStatus>;
  refund(transactionId: string, amount?: number): Promise<RefundResult>;
}

export interface ChargeParams {
  amount: number;
  currency?: string;
  description: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  cardToken?: string;
  installments?: number;
  orderId: string;
}

export interface ChargeResult {
  success: boolean;
  transactionId?: string;
  redirectUrl?: string;
  error?: string;
}

export interface PaymentStatus {
  status: "success" | "pending" | "failed" | "refunded";
  transactionId: string;
  amount: number;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  error?: string;
}

// ===== Email Provider Interface =====
export interface EmailProvider {
  name: string;
  send(params: EmailParams): Promise<EmailResult>;
  sendTemplate(templateId: string, to: string, data: Record<string, string>): Promise<EmailResult>;
}

export interface EmailParams {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ===== SMS Provider Interface =====
export interface SMSProvider {
  name: string;
  send(to: string, message: string): Promise<{ success: boolean; error?: string }>;
}

// ===== WhatsApp Provider Interface =====
export interface WhatsAppProvider {
  name: string;
  sendText(to: string, text: string): Promise<{ success: boolean }>;
  sendButtons(to: string, text: string, buttons: { id: string; title: string }[]): Promise<{ success: boolean }>;
  sendTemplate(to: string, templateName: string, params: string[]): Promise<{ success: boolean }>;
}

// ===== Shipping Provider Interface =====
export interface ShippingProvider {
  name: string;
  createShipment(params: ShipmentParams): Promise<ShipmentResult>;
  trackShipment(trackingId: string): Promise<TrackingStatus>;
}

export interface ShipmentParams {
  orderId: string;
  customerName: string;
  phone: string;
  city: string;
  address: string;
  items: { name: string; quantity: number }[];
}

export interface ShipmentResult {
  success: boolean;
  trackingId?: string;
  estimatedDelivery?: string;
  error?: string;
}

export interface TrackingStatus {
  status: "pending" | "picked_up" | "in_transit" | "delivered" | "failed";
  lastUpdate: string;
  location?: string;
}

// ===== Provider Registry =====
type ProviderType = "payment" | "email" | "sms" | "whatsapp" | "shipping" | "analytics";

const providers: Record<ProviderType, any> = {
  payment: null,
  email: null,
  sms: null,
  whatsapp: null,
  shipping: null,
  analytics: null,
};

let initialized = false;
let initPromise: Promise<void> | null = null;

export function registerProvider(type: ProviderType, provider: any) {
  providers[type] = provider;
}

/** Ensure providers are initialized (lazy, one-time) */
async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;
  initPromise = initializeProviders();
  await initPromise;
  initialized = true;
}

/** Get a provider — lazy-initializes on first call */
export async function getProvider<T>(type: ProviderType): Promise<T | null> {
  await ensureInitialized();
  return providers[type] as T | null;
}

// ===== Initialize All Providers =====
export async function initializeProviders() {
  // Payment — Rivhit (check DB config first, then env)
  const paymentCfg = await getIntegrationConfig("payment");
  if (paymentCfg.api_key || process.env.RIVHIT_API_KEY) {
    const { RivhitProvider } = await import("./rivhit");
    registerProvider("payment", new RivhitProvider());
  }

  // Email — SendGrid (check DB config first, then env)
  const emailCfg = await getIntegrationConfig("email");
  if (emailCfg.api_key || process.env.SENDGRID_API_KEY) {
    const { SendGridProvider } = await import("./sendgrid");
    registerProvider("email", new SendGridProvider());
  }

  // WhatsApp — yCloud (check DB config first, then env)
  const whatsappCfg = await getIntegrationConfig("whatsapp");
  if (whatsappCfg.api_key || process.env.YCLOUD_API_KEY) {
    const { YCloudWhatsAppProvider } = await import("./ycloud-wa");
    registerProvider("whatsapp", new YCloudWhatsAppProvider());
  }
}
