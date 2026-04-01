
import { apiSuccess, apiError } from "@/lib/api-response";

// GET — Return VAPID public key for frontend subscription
export async function GET() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return apiError("VAPID not configured", 500);
  return apiSuccess({ publicKey: key });
}
