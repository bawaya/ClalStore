// =====================================================
// Store — Product shopping assistant (Claude + optional web search)
// =====================================================

import type { Product } from "@/types/database";
import { callGemini } from "@/lib/ai/gemini";
import { getConfiguredAIRuntime } from "@/lib/ai/runtime";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const DEFAULT_ANTHROPIC_MODEL =
  process.env.ANTHROPIC_PRODUCT_ASSISTANT_MODEL || "claude-sonnet-4-20250514";

const WEB_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 3,
};

type AnthropicContentBlock = { type: string; text?: string };

function extractTextFromMessage(data: { content?: AnthropicContentBlock[] }): string {
  if (!data?.content?.length) return "";
  return data.content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text as string)
    .join("\n")
    .trim();
}

function buildSystemPrompt(context?: { page?: string; product?: Product | null; langHint?: string }): string {
  const store =
    "أنت مساعد تسوّق لمتجر ClalMobile / قسم ClalHome للأجهزة المنزلية الذكية في إسرائيل. " +
    "أجب بالعربية أو العبرية حسب سؤال المستخدم. الأسعار غالباً بالشيكel (₪). " +
    "إذا سُئلت عن سعر منتج من الكتالوج ولم يُعطَ لك سياقه، اطلب تسمية المنتج أو رابط الصفحة. " +
    "كن دقيقاً: إن احتجت معلومة تقنية حديثة من الويب، استخدم أداة البحث عند الحاجة. " +
    "لا تخترع أسعاراً محددة لمنتجات حقيقية دون مصدر. ";

  let extra = "";
  if (context?.page === "smart-home") {
    extra += "المستخدم في صفحة أجهزة منزلية ذكية (مكانس، مطابخ صغيرة، قهوة...). ";
  }
  if (context?.product) {
    const pr = context.product;
    extra +=
      `منتج مفتوح في الصفحة: ${pr.brand} — ${pr.name_ar} (₪${pr.price})` +
      (pr.warranty_months ? `, ضمان ${pr.warranty_months} شهر` : "") +
      (pr.model_number ? `, موديل ${pr.model_number}` : "") +
      ". أجب عن هذا المنتج عند الاقتضاء. ";
  }
  if (context?.langHint === "he") {
    extra += "يفضّل المستخدم العبرية في هذه الجلسة. ";
  }
  return store + extra;
}

export type ProductAssistantMessage = { role: "user" | "assistant"; content: string };

export async function runProductAssistant(input: {
  messages: ProductAssistantMessage[];
  context?: { page?: "smart-home" | "product"; product?: Product | null; lang?: "ar" | "he" };
  /** When false, skip web search (faster, cheaper) — e.g. if env disables tools */
  useWebSearch?: boolean;
}): Promise<{ text: string; usedWebSearch: boolean } | { error: string }> {
  const runtime = await getConfiguredAIRuntime("store");
  if (!runtime) {
    return { error: "خدمة المساعد غير مفعّلة على الخادم" };
  }

  const useWeb = input.useWebSearch !== false;
  const system = buildSystemPrompt({
    page: input.context?.page,
    product: input.context?.page === "product" ? input.context?.product : undefined,
    langHint: input.context?.lang,
  });

  const messages = input.messages
    .filter((m) => m.content?.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.trim() }));

  if (messages.length === 0) {
    return { error: "لا يوجد رسائل" };
  }

  if (runtime.provider === "Google Gemini") {
    const result = await callGemini({
      apiKey: runtime.apiKey,
      model: runtime.model,
      systemPrompt: system,
      messages,
      maxTokens: 2000,
      temperature: 0.5,
      timeout: 60_000,
    });

    if (!result?.text?.trim()) {
      return { error: "لم يعد النموذج نصًا كافيًا" };
    }

    return { text: result.text.trim(), usedWebSearch: false };
  }

  const body: Record<string, unknown> = {
    model: runtime.model || DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 2000,
    temperature: 0.5,
    system,
    messages,
  };

  if (useWeb) {
    body.tools = [WEB_TOOL];
  }

  const call = async (b: typeof body) => {
    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": runtime.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(b),
      signal: AbortSignal.timeout(60_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
      content?: AnthropicContentBlock[];
      stop_reason?: string;
    };
    return { res, data };
  };

  const first = await call(body);
  if (!first.res.ok) {
    const errMsg = first.data.error?.message || `HTTP ${first.res.status}`;
    if (useWeb) {
      const retry = { ...body };
      delete retry.tools;
      const second = await call(retry);
      if (!second.res.ok) {
        return { error: errMsg + " / " + (second.data.error?.message || "retry failed") };
      }
      return { text: extractTextFromMessage(second.data) || "…", usedWebSearch: false };
    }
    return { error: errMsg };
  }

  let text = extractTextFromMessage(first.data);
  if (text) {
    return { text, usedWebSearch: useWeb };
  }

  if (useWeb) {
    const retryBody = { ...body };
    delete retryBody.tools;
    const second = await call(retryBody);
    if (second.res.ok) {
      text = extractTextFromMessage(second.data);
      if (text) return { text, usedWebSearch: false };
    }
  }

  return { error: "لم يعد النموذج نصّاً كافٍ" };
}
