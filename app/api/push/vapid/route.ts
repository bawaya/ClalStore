
import { apiSuccess, apiError } from "@/lib/api-response";
import { getIntegrationConfig } from "@/lib/integrations/hub";

// GET — Return VAPID public key for frontend subscription
export async function GET() {
  const pushCfg = await getIntegrationConfig("push_notifications");
  const key = pushCfg.public_key || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return apiError("VAPID not configured", 500);
  return apiSuccess({ publicKey: key });
}
