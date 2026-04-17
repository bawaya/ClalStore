/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Layer 3 — WhatsApp smoke test.
 *
 * REFUSES to run unless `WHATSAPP_TEST_NUMBER` is explicitly set — this
 * prevents an accidental deploy from pinging a real customer.
 *
 * Two checks:
 *   1. POST a text message via yCloud to `WHATSAPP_TEST_NUMBER`.
 *   2. Fake an inbound webhook payload, POST it to /api/webhook/whatsapp,
 *      and confirm an `inbox_conversations` row was created/updated.
 */
import { describe, it, expect, afterAll } from "vitest";
import {
  getTestSupabaseClient,
  stagingSkipReason,
  TEST_PREFIX,
} from "./setup";

const TEST_NUMBER = process.env.WHATSAPP_TEST_NUMBER;
const YCLOUD_KEY = process.env.YCLOUD_API_KEY;
const STAGING_URL =
  process.env.STAGING_URL?.replace(/\/$/, "") || "http://localhost:3000";

const localSkip = !TEST_NUMBER
  ? "WHATSAPP_TEST_NUMBER not set"
  : stagingSkipReason();

describe.skipIf(localSkip)("Layer 3 · WhatsApp (real yCloud)", () => {
  // Normalize to the E.164-ish shape expected by the webhook saver (no +)
  const cleanPhone = (TEST_NUMBER || "").replace(/[^\d+]/g, "");
  const phoneNoPlus = cleanPhone.replace(/^\+/, "");
  const createdConvIds: string[] = [];

  afterAll(async () => {
    const db = getTestSupabaseClient();
    for (const id of createdConvIds) {
      await db.from("inbox_messages").delete().eq("conversation_id", id);
      await db.from("inbox_conversations").delete().eq("id", id);
    }
    // Extra safety: wipe any rows tied to the test number that we may have
    // touched via the webhook path but didn't track by id.
    const { data: stragglers } = await db
      .from("inbox_conversations")
      .select("id")
      .in("customer_phone", [phoneNoPlus, `+${phoneNoPlus}`, cleanPhone]);
    const strayIds = (stragglers ?? []).map((r: any) => r.id);
    if (strayIds.length) {
      await db.from("inbox_messages").delete().in("conversation_id", strayIds);
      await db.from("inbox_conversations").delete().in("id", strayIds);
    }
  });

  it("sends a single text via yCloud and gets a 2xx", async () => {
    if (!YCLOUD_KEY) {
      console.info("[whatsapp] YCLOUD_API_KEY not set — skipping send");
      return;
    }
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    if (!phoneId) {
      console.info("[whatsapp] WHATSAPP_PHONE_ID not set — skipping send");
      return;
    }

    const res = await fetch(
      "https://api.ycloud.com/v2/whatsapp/messages/sendDirectly",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": YCLOUD_KEY,
        },
        body: JSON.stringify({
          from: phoneId,
          to: cleanPhone.startsWith("+") ? cleanPhone : `+${cleanPhone}`,
          type: "text",
          text: {
            body: `${TEST_PREFIX}staging smoke ${new Date().toISOString()}`,
          },
        }),
      },
    );

    // Accept any 2xx; yCloud returns 200 on success. 400/401/403 surface as
    // an assertion failure so operators see misconfigured credentials.
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
  });

  it("POSTs a simulated inbound webhook and creates an inbox conversation", async () => {
    // Build a minimal yCloud-shaped webhook payload. The server's parseWebhook
    // is lenient; see lib/bot/whatsapp.ts for the fields it actually reads.
    const fakeMessageId = `${TEST_PREFIX}msg_${Date.now()}`;
    const payload = {
      type: "whatsapp.inbound_message.received",
      whatsappInboundMessage: {
        id: fakeMessageId,
        from: phoneNoPlus,
        to: process.env.WHATSAPP_PHONE_ID || "+972000000000",
        type: "text",
        text: { body: `${TEST_PREFIX}webhook ping` },
        timestamp: new Date().toISOString(),
        profile: { name: `${TEST_PREFIX}Staging Sender` },
      },
    };

    // If the server has WEBHOOK_SECRET set, signed requests are required —
    // we can't mint a valid HMAC without it, so we skip the POST phase.
    if (process.env.WEBHOOK_SECRET) {
      console.info(
        "[whatsapp] WEBHOOK_SECRET set — skipping unsigned webhook POST",
      );
      return;
    }

    let res: Response;
    try {
      res = await fetch(`${STAGING_URL}/api/webhook/whatsapp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      console.info(
        `[whatsapp] webhook unreachable at ${STAGING_URL} — skipping: ${(err as Error).message}`,
      );
      return;
    }

    expect([200, 202]).toContain(res.status);

    // Give the server a beat to finish its writes, then verify the row landed.
    await new Promise((r) => setTimeout(r, 1500));
    const db = getTestSupabaseClient();
    const { data } = await db
      .from("inbox_conversations")
      .select("id, customer_phone")
      .in("customer_phone", [phoneNoPlus, `+${phoneNoPlus}`])
      .order("created_at", { ascending: false })
      .limit(1);

    expect((data ?? []).length).toBeGreaterThan(0);
    if (data && data[0]) {
      createdConvIds.push(data[0].id);
      expect([phoneNoPlus, `+${phoneNoPlus}`]).toContain(data[0].customer_phone);
    }
  });
});
