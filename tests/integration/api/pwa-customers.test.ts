/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for POST /api/pwa/customers
 * (decision 5 — PWA customer create with dedup, phase 10).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockSupabaseClient,
  makeCustomer,
} from "@/tests/helpers";

// ── Fixtures ──────────────────────────────────────────
const existingCustomer = makeCustomer({
  id: "cust-1",
  name: "Ahmad",
  phone: "0501234567",
  id_number: "123456789",
});

// ── Hoisted mock state ────────────────────────────────
const hoisted = vi.hoisted(() => ({
  auth: {
    authId: "auth-emp1",
    appUserId: "emp1",
    role: "sales",
    name: "Sales Rep",
  },
  clientRef: { current: null as any },
}));

// ── Supabase client ───────────────────────────────────
const supabaseClient = createMockSupabaseClient({
  customers: { data: [] },
});
hoisted.clientRef.current = supabaseClient;

// ── Mocks ─────────────────────────────────────────────
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => hoisted.clientRef.current),
  createAdminSupabase: vi.fn(() => hoisted.clientRef.current),
}));

vi.mock("@/lib/pwa/auth", () => ({
  requireEmployee: vi.fn().mockResolvedValue(hoisted.auth),
}));

// NOTE: we use the REAL customer-linking + pwa/validators here so that
// phone-candidate dedup and Zod validation are exercised end-to-end.

import { POST as createCustomer } from "@/app/api/pwa/customers/route";

function setPhoneLookup(found: any | null) {
  supabaseClient.__queryBuilders.get("customers")!.maybeSingle = vi
    .fn()
    .mockResolvedValueOnce({ data: found, error: null }) // phone lookup
    .mockResolvedValueOnce({ data: null, error: null }); // national_id lookup (if reached)
}

function setPhoneAndIdLookup(phoneFound: any | null, idFound: any | null) {
  supabaseClient.__queryBuilders.get("customers")!.maybeSingle = vi
    .fn()
    .mockResolvedValueOnce({ data: phoneFound, error: null })
    .mockResolvedValueOnce({ data: idFound, error: null });
}

function setInsertResult(data: any, error: any = null) {
  supabaseClient.__queryBuilders.get("customers")!.single = vi
    .fn()
    .mockResolvedValueOnce({ data, error });
}

describe("POST /api/pwa/customers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // default: no duplicates found
    setPhoneAndIdLookup(null, null);
    setInsertResult({
      id: "new-cust-99",
      name: "Ahmad",
      phone: "0501234567",
      id_number: null,
    });
  });

  it("creates a new customer: 201 with existed=false", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/customers",
      body: {
        name: "Ahmad",
        phone: "050-123-4567",
      },
    });
    const res = await createCustomer(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.existed).toBe(false);
    expect(body.customer.id).toBe("new-cust-99");
  });

  it("dedup by phone (normalised variants): returns existing with existed=true", async () => {
    setPhoneLookup(existingCustomer);
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/customers",
      body: {
        // different formatting of same phone
        name: "Ahmad Duplicate",
        phone: "+972501234567",
      },
    });
    const res = await createCustomer(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.existed).toBe(true);
    expect(body.customer.id).toBe("cust-1");
  });

  it("dedup by national_id: returns existing with existed=true", async () => {
    // Phone lookup: no match. national_id lookup: match.
    setPhoneAndIdLookup(null, existingCustomer);
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/customers",
      body: {
        name: "Ahmad",
        phone: "0509999999", // new phone
        national_id: "123456789",
      },
    });
    const res = await createCustomer(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.existed).toBe(true);
    expect(body.customer.id).toBe("cust-1");
  });

  it("invalid phone format: 400", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/customers",
      body: {
        name: "Ahmad",
        phone: "abc-not-a-phone",
      },
    });
    const res = await createCustomer(req);
    expect(res.status).toBe(400);
  });

  it("missing name: 400", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/customers",
      body: {
        phone: "0501234567",
      },
    });
    const res = await createCustomer(req);
    expect(res.status).toBe(400);
  });

  it("name too short (< 2 chars): 400", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/customers",
      body: {
        name: "A",
        phone: "0501234567",
      },
    });
    const res = await createCustomer(req);
    expect(res.status).toBe(400);
  });

  it("invalid national_id (non-numeric): 400", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/customers",
      body: {
        name: "Ahmad",
        phone: "0501234567",
        national_id: "ABC123",
      },
    });
    const res = await createCustomer(req);
    expect(res.status).toBe(400);
  });

  it("db insert error → 500", async () => {
    setPhoneAndIdLookup(null, null);
    setInsertResult(null, { message: "unique_violation" });
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/customers",
      body: {
        name: "Ahmad",
        phone: "0501234567",
      },
    });
    const res = await createCustomer(req);
    expect(res.status).toBe(500);
  });
});
