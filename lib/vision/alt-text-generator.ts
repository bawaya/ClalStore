// =====================================================
// Alt-text generator — produces SEO-friendly + a11y alt
// text for product images in Arabic, Hebrew, and English.
// Stored on classification_history (alt_text rows) and
// surfaced via the products API for rendering.
// =====================================================

import { z } from "zod";
import {
  callGateway,
  DEFAULT_VISION_MODEL,
  FALLBACK_VISION_MODEL,
} from "./gateway-client";

const altSchema = z.object({
  alt_ar: z.string().min(1).max(150),
  alt_he: z.string().min(1).max(150),
  alt_en: z.string().min(1).max(150),
});

export type AltTexts = z.infer<typeof altSchema>;

const SYSTEM = `You write concise, SEO-friendly, accessibility-compliant alt text for product images at ClalMobile.

# RULES
- 60–120 characters per language
- Mention brand + model + key visible feature (color, angle, in-use)
- No emoji, no marketing fluff, no quotation marks
- Avoid starting with "صورة" / "תמונה" / "image" — screen readers already announce that
- Match the language naturally: descriptive but plain

# OUTPUT (strict JSON)
{
  "alt_ar": "...",
  "alt_he": "...",
  "alt_en": "..."
}`;

export interface AltInput {
  image_url: string;
  brand?: string;
  product_name?: string;
  product_type?: string;
  color?: string;
}

export async function generateAltText(input: AltInput): Promise<AltTexts> {
  const ctx =
    (input.brand ? `Brand: ${input.brand}\n` : "") +
    (input.product_name ? `Model: ${input.product_name}\n` : "") +
    (input.product_type ? `Type: ${input.product_type}\n` : "") +
    (input.color ? `Color: ${input.color}\n` : "");

  const res = await callGateway({
    model: DEFAULT_VISION_MODEL,
    fallbackModels: [FALLBACK_VISION_MODEL],
    system: SYSTEM,
    user: [
      { type: "text", text: ctx + "Write alt text in 3 languages." },
      { type: "image", url: input.image_url },
    ],
    maxTokens: 400,
    temperature: 0.3,
    tags: ["feature:alt-text"],
    cacheControl: "max-age=86400",
  });

  const parsed = altSchema.safeParse(res.json);
  if (!parsed.success) {
    throw new Error(
      `Alt-text output invalid: ${parsed.error.issues
        .slice(0, 2)
        .map((i) => i.message)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

/** Produce alt-text for every image attached to a product. Returns the
 *  per-image triples — UI presents them so the admin can copy/paste, and
 *  any caller can persist them where the schema fits (we recommend
 *  a `gallery_alts` JSONB column once the product team is ready). */
export async function generateAltsForProduct(opts: {
  brand?: string;
  product_name?: string;
  product_type?: string;
  primary?: string;
  gallery?: string[];
  colors?: { name: string; image: string }[];
}): Promise<{
  primary?: AltTexts;
  gallery: AltTexts[];
  colors: { color: string; alt: AltTexts }[];
}> {
  const tasks: Promise<unknown>[] = [];
  let primary: AltTexts | undefined;
  const gallery: AltTexts[] = [];
  const colors: { color: string; alt: AltTexts }[] = [];

  const baseCtx = {
    brand: opts.brand,
    product_name: opts.product_name,
    product_type: opts.product_type,
  };

  if (opts.primary) {
    tasks.push(
      generateAltText({ ...baseCtx, image_url: opts.primary })
        .then((alt) => {
          primary = alt;
        })
        .catch(() => {
          /* skip on failure */
        }),
    );
  }
  for (const url of opts.gallery || []) {
    tasks.push(
      generateAltText({ ...baseCtx, image_url: url })
        .then((alt) => {
          gallery.push(alt);
        })
        .catch(() => {
          /* skip on failure */
        }),
    );
  }
  for (const c of opts.colors || []) {
    if (!c.image) continue;
    tasks.push(
      generateAltText({ ...baseCtx, image_url: c.image, color: c.name })
        .then((alt) => {
          colors.push({ color: c.name, alt });
        })
        .catch(() => {
          /* skip on failure */
        }),
    );
  }

  await Promise.all(tasks);
  return { primary, gallery, colors };
}
