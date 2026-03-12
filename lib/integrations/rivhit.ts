// =====================================================
// ClalMobile — iCredit (Rivhit) Payment Provider
// Official API: https://rivhit-api.readme.io/reference
// Endpoint: https://icredit.rivhit.co.il/API/PaymentPageRequest.svc
// Auth: GroupPrivateToken (GUID from payment page settings)
// =====================================================

import type { PaymentProvider, ChargeParams, ChargeResult, PaymentStatus, RefundResult } from "./hub";
import { getIntegrationConfig } from "./hub";

const ICREDIT_LIVE = "https://icredit.rivhit.co.il/API/PaymentPageRequest.svc";
const ICREDIT_TEST = "https://testicredit.rivhit.co.il/API/PaymentPageRequest.svc";

export interface IcreditConfig {
  groupPrivateToken: string;
  testMode: boolean;
  maxPayments: number;
  minPayments: number;
  saleType: number;
  sendMail: boolean;
  createCustomer: boolean;
  documentLanguage: string;
  ipnUrlOverride: string;
  successUrlOverride: string;
  failUrlOverride: string;
}

async function getIcreditConfig(): Promise<IcreditConfig> {
  const dbCfg = await getIntegrationConfig("payment");
  const groupPrivateToken = dbCfg.group_private_token || process.env.ICREDIT_GROUP_PRIVATE_TOKEN || "";
  const testMode = dbCfg.test_mode === "true" || dbCfg.test_mode === true || process.env.ICREDIT_TEST_MODE === "true";
  if (!groupPrivateToken) throw new Error("iCredit GroupPrivateToken not configured");
  return {
    groupPrivateToken,
    testMode,
    maxPayments: parseInt(dbCfg.max_payments || "12", 10) || 12,
    minPayments: parseInt(dbCfg.min_payments || "1", 10) || 1,
    saleType: parseInt(dbCfg.sale_type || "1", 10) || 1,
    sendMail: dbCfg.send_mail !== "false",
    createCustomer: dbCfg.create_customer !== "false",
    documentLanguage: dbCfg.document_language || "he",
    ipnUrlOverride: dbCfg.ipn_url_override || "",
    successUrlOverride: dbCfg.success_url_override || "",
    failUrlOverride: dbCfg.fail_url_override || "",
  };
}

function getBaseUrl(testMode: boolean) {
  return testMode ? ICREDIT_TEST : ICREDIT_LIVE;
}

/** Currency codes used by iCredit: 1=ILS, 2=USD, 3=EUR, 4=GBP */
function getCurrencyCode(currency?: string): number {
  switch (currency?.toUpperCase()) {
    case "USD": return 2;
    case "EUR": return 3;
    case "GBP": return 4;
    default: return 1;
  }
}

export async function createPaymentPage(params: {
  orderId: string;
  amount: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerCity?: string;
  customerAddress?: string;
  idNumber?: string;
  items: { name: string; price: number; quantity: number }[];
  maxInstallments?: number;
  language?: string;
  currency?: string;
}): Promise<{ success: boolean; paymentUrl?: string; privateSaleToken?: string; publicSaleToken?: string; error?: string }> {
  const cfg = await getIcreditConfig();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
  const baseUrl = getBaseUrl(cfg.testMode);

  const nameParts = params.customerName.trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const successUrl = cfg.successUrlOverride
    ? `${cfg.successUrlOverride}?order=${params.orderId}&value=${params.amount}`
    : `${appUrl}/store/checkout/success?order=${params.orderId}&value=${params.amount}`;
  const failUrl = cfg.failUrlOverride
    ? `${cfg.failUrlOverride}?order=${params.orderId}`
    : `${appUrl}/store/checkout/failed?order=${params.orderId}`;
  const ipnUrl = cfg.ipnUrlOverride || `${appUrl}/api/payment/callback`;

  try {
    const res = await fetch(`${baseUrl}/GetUrl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        GroupPrivateToken: cfg.groupPrivateToken,
        Items: params.items.map((i) => ({
          UnitPrice: i.price,
          Quantity: i.quantity,
          Description: i.name,
        })),
        RedirectURL: successUrl,
        FailRedirectURL: failUrl,
        IPNURL: ipnUrl,
        IPNMethod: 2,
        MaxPayments: params.maxInstallments || cfg.maxPayments,
        MinPayments: cfg.minPayments,
        Currency: getCurrencyCode(params.currency),
        PriceIncludeVAT: true,
        CustomerFirstName: firstName,
        CustomerLastName: lastName,
        PhoneNumber: params.customerPhone,
        EmailAddress: params.customerEmail || "",
        Address: params.customerAddress || "",
        City: params.customerCity || "",
        IdNumber: params.idNumber ? Number(params.idNumber) : undefined,
        Custom1: params.orderId,
        Order: params.orderId,
        Comments: `ClalMobile Order ${params.orderId}`,
        DocumentLanguage: params.language || cfg.documentLanguage,
        SendMail: params.customerEmail ? cfg.sendMail : false,
        CreateCustomer: cfg.createCustomer,
        HideItemList: false,
        DisplayBackButton: true,
        SaleType: cfg.saleType,
      }),
    });

    const data = await res.json();

    if (data.Status === 0 && data.URL) {
      return {
        success: true,
        paymentUrl: data.URL,
        privateSaleToken: data.PrivateSaleToken,
        publicSaleToken: data.PublicSaleToken,
      };
    }

    return {
      success: false,
      error: data.DebugMessage || `iCredit error (Status: ${data.Status})`,
    };
  } catch (err: any) {
    console.error("iCredit GetUrl error:", err);
    return { success: false, error: err.message };
  }
}

/** Verify an IPN (callback) from iCredit */
export async function verifyIPN(saleId: string, totalAmount: number): Promise<{ verified: boolean; status?: string }> {
  const cfg = await getIcreditConfig();
  const { groupPrivateToken } = cfg;
  const baseUrl = getBaseUrl(cfg.testMode);

  try {
    const res = await fetch(`${baseUrl}/Verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        GroupPrivateToken: groupPrivateToken,
        SaleId: saleId,
        TotalAmount: totalAmount,
      }),
    });

    const data = await res.json();
    return { verified: data.Status === "VERIFIED", status: data.Status };
  } catch {
    return { verified: false };
  }
}

/** Get sale details by SaleId + PrivateSaleToken */
export async function getSaleDetails(saleId: string, privateSaleToken: string) {
  const cfg = await getIcreditConfig();
  const baseUrl = getBaseUrl(cfg.testMode);

  try {
    const res = await fetch(`${baseUrl}/SaleDetails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ SaleId: saleId, SalePrivateToken: privateSaleToken }),
    });

    return await res.json();
  } catch {
    return null;
  }
}

export class RivhitProvider implements PaymentProvider {
  name = "iCredit";

  async createCharge(params: ChargeParams): Promise<ChargeResult> {
    const result = await createPaymentPage({
      orderId: params.orderId,
      amount: params.amount,
      customerName: params.customerName,
      customerPhone: params.customerPhone,
      customerEmail: params.customerEmail,
      items: [{ name: params.description, price: params.amount, quantity: 1 }],
      maxInstallments: params.installments || 12,
    });

    if (result.success) {
      return {
        success: true,
        transactionId: result.privateSaleToken,
        redirectUrl: result.paymentUrl,
      };
    }

    return { success: false, error: result.error };
  }

  async verifyPayment(transactionId: string): Promise<PaymentStatus> {
    return { status: "pending", transactionId, amount: 0 };
  }

  async refund(_transactionId: string, _amount?: number): Promise<RefundResult> {
    return { success: false, error: "Refunds should be done from iCredit dashboard" };
  }
}
