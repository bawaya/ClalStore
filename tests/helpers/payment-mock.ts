/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

// ───── Rivhit / iCredit ─────

export const rivhitMockResponses = {
  createPaymentPage: {
    success: true,
    paymentUrl: "https://icredit.test/pay/mock-sale-123",
    privateSaleToken: "pvt-token-mock",
    publicSaleToken: "pub-token-mock",
  },
  createPaymentPageError: {
    success: false,
    error: "Invalid credentials",
  },
  verifyIPN: {
    verified: true,
    status: "approved",
  },
  verifyIPNFailed: {
    verified: false,
  },
  saleDetails: {
    SaleId: "mock-sale-123",
    TotalAmount: 3499,
    Currency: "ILS",
    Status: 1,
    CardSuffix: "1234",
    NumOfPayments: 1,
  },
};

// ───── UPay ─────

export const upayMockResponses = {
  session: "upay-session-mock-123",
  loginSuccess: true,
  createPaymentPage: {
    success: true,
    paymentUrl: "https://upay.test/pay?session=upay-session-mock-123",
  },
  createPaymentPageError: {
    success: false,
    error: "Session expired",
  },
  verifyTransaction: {
    valid: true,
    status: "completed",
    amount: 3499,
  },
  verifyTransactionFailed: {
    valid: false,
    error: "Transaction not found",
  },
};

// ───── fetch mock for payment providers ─────

export function installPaymentFetchMock() {
  const fetchMock = vi.fn().mockImplementation(async (url: string, init?: any) => {
    const urlStr = typeof url === "string" ? url : "";

    // Rivhit / iCredit
    if (urlStr.includes("icredit") || urlStr.includes("rivhit")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          Status: 0,
          URL: rivhitMockResponses.createPaymentPage.paymentUrl,
          PrivateSaleToken: rivhitMockResponses.createPaymentPage.privateSaleToken,
          PublicSaleToken: rivhitMockResponses.createPaymentPage.publicSaleToken,
        }),
      };
    }

    // UPay
    if (urlStr.includes("upay")) {
      const body = init?.body ? JSON.parse(init.body) : {};
      if (urlStr.includes("login") || urlStr.includes("session")) {
        return { ok: true, status: 200, json: async () => ({ sessionId: upayMockResponses.session }) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ url: upayMockResponses.createPaymentPage.paymentUrl }),
      };
    }

    return { ok: true, status: 200, json: async () => ({}) };
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Simulate a payment callback query string (used for GET /api/payment/callback) */
export function makePaymentCallbackParams(overrides: Record<string, string> = {}) {
  return {
    orderId: "CLM-001",
    Status: "0",
    SaleId: "mock-sale-123",
    PrivateSaleToken: "pvt-token-mock",
    PublicSaleToken: "pub-token-mock",
    Amount: "3499",
    ...overrides,
  };
}
