// =====================================================
// Color detector — given a product image, detect dominant
// color of the product body and suggest hex + bilingual name.
// Useful when an admin uploads a color variant image and
// we want to auto-fill the ProductColor record.
// =====================================================

import { z } from "zod";
import {
  callGateway,
  DEFAULT_VISION_MODEL,
  FALLBACK_VISION_MODEL,
} from "./gateway-client";

const colorSchema = z.object({
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  name_en: z.string().min(1).max(40),
  name_ar: z.string().min(1).max(40),
  name_he: z.string().min(1).max(40),
  confidence: z.number().min(0).max(1),
  notes: z.string().max(160).optional().default(""),
});

export type DetectedColor = z.infer<typeof colorSchema>;

const COLOR_DETECTOR_SYSTEM = `You analyze a product image and return the dominant body color of the product itself (NOT the background).

# RULES
- Identify the actual color of the product surface, ignoring shadows, reflections, and the background
- Output a single canonical hex (#RRGGBB), a clean English name, and matching Arabic / Hebrew translations
- Use ClalMobile's color naming conventions when applicable:
  - Black → أسود / שחור
  - White → أبيض / לבן
  - Silver → فضي / כסף
  - Gold → ذهبي / זהב
  - Rose Gold → ذهبي وردي / זהב ורוד
  - Titanium → تيتانيوم / טיטניום
  - Midnight → ميدنايت / מידנייט
  - Pacific Blue → أزرق هادئ / כחול שלווה
  - Graphite → جرافيت / גרפיט
  - Space Gray → رمادي فضائي / אפור חלל
- For unusual colors, give your best descriptive name in all three languages
- confidence: 0..1 — how sure you are about the color name (lower if the image is ambiguous)

# OUTPUT (strict JSON)
{
  "hex": "#1a1a2e",
  "name_en": "Midnight Black",
  "name_ar": "أسود ميدنايت",
  "name_he": "שחור מידנייט",
  "confidence": 0.95,
  "notes": "<optional Arabic note if ambiguous, otherwise empty>"
}`;

export async function detectProductColor(
  imageUrl: string,
  hint?: { product_name?: string; brand?: string },
): Promise<DetectedColor> {
  const ctx =
    (hint?.product_name ? `Product: ${hint.product_name}\n` : "") +
    (hint?.brand ? `Brand: ${hint.brand}\n` : "");

  const res = await callGateway({
    model: DEFAULT_VISION_MODEL,
    fallbackModels: [FALLBACK_VISION_MODEL],
    system: COLOR_DETECTOR_SYSTEM,
    user: [
      { type: "text", text: ctx + "Identify the dominant body color of the product." },
      { type: "image", url: imageUrl },
    ],
    maxTokens: 300,
    temperature: 0,
    tags: ["feature:color-detector"],
    cacheControl: "max-age=86400",
  });

  const parsed = colorSchema.safeParse(res.json);
  if (!parsed.success) {
    throw new Error(
      `Color detector output invalid: ${parsed.error.issues
        .slice(0, 2)
        .map((i) => i.message)
        .join("; ")}`,
    );
  }
  return parsed.data;
}
