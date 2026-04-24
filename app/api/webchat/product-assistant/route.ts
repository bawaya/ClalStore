import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api-response";
import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { runProductAssistant, type ProductAssistantMessage } from "@/lib/ai/product-assistant";
import { getProduct } from "@/lib/store/queries";
import type { Product } from "@/types/database";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .min(1)
    .max(24),
  page: z.enum(["smart-home", "product"]).optional(),
  productId: z.string().uuid().optional(),
  lang: z.enum(["ar", "he"]).optional(),
  useWebSearch: z.boolean().optional(),
});

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = checkRateLimit(getRateLimitKey(ip, "product-assistant"), {
    maxRequests: 20,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return apiError("طلبات كثيرة — حاول لاحقاً", 429);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError("جسم غير صالح", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || "بيانات غير صالحة", 400);
  }

  const { messages, page, productId, lang, useWebSearch } = parsed.data;

  let product: Product | null = null;
  if (page === "product" && productId) {
    product = await getProduct(productId);
  }

  const result = await runProductAssistant({
    messages: messages as ProductAssistantMessage[],
    context: { page, product, lang: lang || "ar" },
    useWebSearch,
  });

  if ("error" in result) {
    return apiError(result.error, 503);
  }

  return apiSuccess({
    reply: result.text,
    usedWebSearch: result.usedWebSearch,
  });
}
