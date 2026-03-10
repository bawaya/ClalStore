// =====================================================
// ClalMobile — UPay Payment Provider
// Israeli payment gateway — Redirect-based hosted page
// API: https://app.upay.co.il/API6/clientsecure/json.php
// =====================================================

import type {
  PaymentProvider,
  ChargeParams,
  ChargeResult,
  PaymentStatus,
  RefundResult,
} from "./hub";
import { getIntegrationConfig } from "./hub";

const UPAY_API = "https://app.upay.co.il/API6/clientsecure/json.php";
const UPAY_PUBLIC_API = "https://app.upay.co.il/API6/client/json.php";

interface UpayConfig {
  apiUsername: string;
  apiKey: string;
  testMode: boolean;
  language: string;
  maxPayments: number;
}

async function getUpayConfig(): Promise<UpayConfig> {
  const dbCfg = await getIntegrationConfig("payment_upay");
  const apiUsername = dbCfg.api_username || process.env.UPAY_API_USERNAME || "";
  const apiKey = dbCfg.api_key || process.env.UPAY_API_KEY || "";
  if (!apiUsername || !apiKey) throw new Error("UPay credentials not configured");
  return {
    apiUsername,
    apiKey,
    testMode: dbCfg.test_mode === "true" || dbCfg.test_mode === true,
    language: dbCfg.language || "HE",
    maxPayments: parseInt(dbCfg.max_payments || "1", 10) || 1,
  };
}

async function upayRequest(
  url: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  try {
    const params = new URLSearchParams();
    for (const [key, val] of Object.entries(data)) {
      params.set(key, typeof val === "string" ? val : JSON.stringify(val));
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    console.error("[UPay] Request error:", err);
    return null;
  }
}

/** Get a session ID from UPay */
export async function getUpaySession(cfg: UpayConfig): Promise<string | null> {
  const res = await upayRequest(UPAY_PUBLIC_API, {
    msg: JSON.stringify({
      header: {
        refername: "UPAY",
        livesystem: cfg.testMode ? 0 : 1,
        language: cfg.language,
      },
      request: {
        mainaction: "SESSION",
        minoraction: "GETSESSION",
        encoding: "json",
      },
    }),
  });

  if (!res) return null;
  const result = res as any;
  if (result?.success && result?.result?.sessionid) {
    return result.result.sessionid;
  }
  return null;
}

/** Login to UPay to validate credentials */
export async function upayLogin(cfg: UpayConfig): Promise<boolean> {
  const session = await getUpaySession(cfg);
  if (!session) return false;

  const res = await upayRequest(UPAY_API, {
    msg: JSON.stringify({
      header: { sessionid: session },
      request: {
        mainaction: "CONNECTION",
        minoraction: "LOGIN",
        encoding: "json",
        parameters: {
          email: cfg.apiUsername,
          key: cfg.apiKey,
        },
      },
    }),
  });

  const result = res as any;
  return !!(result?.success);
}

/** Get redirect URL for a payment */
export async function createUpayPaymentPage(params: {
  orderId: string;
  amount: number;
  currency?: string;
  customerEmail?: string;
  customerPhone?: string;
  description?: string;
}): Promise<{ success: boolean; paymentUrl?: string; error?: string }> {
  const cfg = await getUpayConfig();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

  const callbackUrl = `${appUrl}/api/payment/upay/callback`;

  const transfer: Record<string, unknown> = {
    email: cfg.apiUsername,
    commissionreduction: 0,
    amount: params.amount,
    currency: params.currency || "ILS",
    maxpayments: cfg.maxPayments,
    paymentdate: new Date().toISOString().split("T")[0],
    productdescription: params.orderId,
    returnurl: `${callbackUrl}?order_id=${params.orderId}`,
    ipnurl: `${callbackUrl}?order_id=${params.orderId}`,
  };

  if (params.customerPhone) {
    const phone = params.customerPhone.replace(/-/g, "");
    if (phone.startsWith("05") || phone.startsWith("+9725")) {
      transfer.cellphonenotify = phone;
    }
  }
  if (params.customerEmail) {
    transfer.emailnotify = params.customerEmail;
  }

  const res = await upayRequest(UPAY_API, {
    msgs: JSON.stringify([
      {
        header: {
          refername: "UPAY",
          livesystem: cfg.testMode ? 0 : 1,
          language: cfg.language,
        },
        request: {
          mainaction: "CONNECTION",
          minoraction: "LOGIN",
          encoding: "json",
          parameters: {
            email: cfg.apiUsername,
            key: cfg.apiKey,
          },
        },
      },
      {
        header: {
          refername: "UPAY",
          livesystem: cfg.testMode ? 0 : 1,
          language: cfg.language,
        },
        request: {
          mainaction: "CASHIER",
          minoraction: "REDIRECTDEPOSITCREDITCARDTRANSFER",
          encoding: "json",
          numbertemplate: 15,
          parameters: {
            transfers: [transfer],
            foreign: "0",
            key: cfg.apiKey,
            cardreader: "0",
            creditcardcompanytype: "ISR",
            creditcardtype: "PR",
          },
        },
      },
    ]),
  });

  if (!res) return { success: false, error: "No response from UPay" };

  const results = (res as any)?.results;
  const paymentUrl = results?.[1]?.result?.transactions?.[0]?.url;

  if (paymentUrl) {
    return { success: true, paymentUrl };
  }

  const errMsg =
    results?.[1]?.result?.errormessage ||
    results?.[0]?.result?.errormessage ||
    "Unknown UPay error";
  return { success: false, error: errMsg };
}

/** Verify a transaction by ID */
export async function verifyUpayTransaction(
  transactionId: string,
  orderId: string
): Promise<{
  valid: boolean;
  status?: string;
  amount?: number;
  error?: string;
}> {
  const cfg = await getUpayConfig();

  const res = await upayRequest(UPAY_API, {
    msgs: JSON.stringify([
      {
        header: {
          refername: "UPAY",
          livesystem: cfg.testMode ? 0 : 1,
          language: cfg.language,
        },
        request: {
          mainaction: "CONNECTION",
          minoraction: "LOGIN",
          encoding: "json",
          parameters: {
            email: cfg.apiUsername,
            key: cfg.apiKey,
          },
        },
      },
      {
        header: {
          refername: "UPAY",
          livesystem: cfg.testMode ? 0 : 1,
          language: cfg.language,
        },
        request: {
          mainaction: "TRANSACTIONSINFO",
          minoraction: "GETTRANSACTIONS",
          encoding: "json",
          parameters: {
            cashierids: [transactionId],
          },
        },
      },
    ]),
  });

  if (!res) return { valid: false, error: "No response from UPay" };

  const results = (res as any)?.results;
  const trx = results?.[1]?.result?.sendertransactions?.[0];

  if (!trx) return { valid: false, error: "Transaction not found" };

  const isSuccess = trx.transferstatus === "S" || trx.transferstatus === "A";
  const matchesOrder = String(trx.productdescription) === String(orderId);

  return {
    valid: isSuccess && matchesOrder,
    status: trx.transferstatus,
    amount: trx.amount,
    error: !isSuccess
      ? "Transaction not successful"
      : !matchesOrder
        ? "Order ID mismatch"
        : undefined,
  };
}

export class UpayProvider implements PaymentProvider {
  name = "UPay";

  async createCharge(params: ChargeParams): Promise<ChargeResult> {
    const result = await createUpayPaymentPage({
      orderId: params.orderId,
      amount: params.amount,
      currency: params.currency || "ILS",
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      description: params.description,
    });

    if (result.success) {
      return {
        success: true,
        redirectUrl: result.paymentUrl,
      };
    }

    return { success: false, error: result.error };
  }

  async verifyPayment(transactionId: string): Promise<PaymentStatus> {
    const result = await verifyUpayTransaction(transactionId, "");

    if (result.valid) {
      return {
        status: "success",
        transactionId,
        amount: result.amount || 0,
      };
    }

    return {
      status: result.status === "P" ? "pending" : "failed",
      transactionId,
      amount: result.amount || 0,
    };
  }

  async refund(_transactionId: string, _amount?: number): Promise<RefundResult> {
    return {
      success: false,
      error: "UPay refunds must be processed through the UPay dashboard",
    };
  }
}
