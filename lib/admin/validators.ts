import { z } from "zod";

export const productSchema = z.object({
  name_ar: z.string().min(1).max(200),
  name_he: z.string().max(200).default(""),
  brand: z.string().min(1).max(100),
  type: z.enum(["device", "accessory"]),
  price: z.number().min(0),
  old_price: z.number().min(0).optional(),
  cost: z.number().min(0).default(0),
  stock: z.number().int().min(0).default(0),
  sold: z.number().int().min(0).default(0),
  image_url: z.string().max(1000).optional(),
  gallery: z.array(z.string()).optional().default([]),
  colors: z.array(z.any()).optional().default([]),
  storage_options: z.array(z.string()).optional().default([]),
  variants: z.array(z.any()).optional().default([]),
  specs: z.record(z.string(), z.string()).optional().default({}),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  description_ar: z.string().max(5000).optional(),
  description_he: z.string().max(5000).optional(),
});

export const productUpdateSchema = productSchema.partial();

export const couponSchema = z.object({
  code: z.string().min(1).max(50).transform((v) => v.toUpperCase()),
  type: z.enum(["fixed", "percent"]),
  value: z.number().min(0),
  min_order: z.number().min(0).default(0),
  max_uses: z.number().int().min(0).default(0),
  used_count: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
  expires_at: z.string().optional(),
});

export const couponUpdateSchema = couponSchema.partial();

export const heroSchema = z.object({
  title_ar: z.string().min(1).max(200),
  title_he: z.string().max(200).optional().default(""),
  subtitle_ar: z.string().max(500).optional().default(""),
  subtitle_he: z.string().max(500).optional().default(""),
  image_url: z.string().max(1000).optional().default(""),
  link_url: z.string().max(1000).optional().default(""),
  cta_text_ar: z.string().max(100).optional().default(""),
  cta_text_he: z.string().max(100).optional().default(""),
  sort_order: z.number().int().min(0).optional().default(0),
  active: z.boolean().optional().default(true),
});

export const heroUpdateSchema = heroSchema.partial();

export const lineSchema = z.object({
  name_ar: z.string().min(1).max(200),
  name_he: z.string().max(200).optional().default(""),
  data_amount: z.string().min(1).max(50),
  price: z.number().min(0),
  features_ar: z.array(z.string()).optional().default([]),
  features_he: z.array(z.string()).optional().default([]),
  popular: z.boolean().optional().default(false),
  sort_order: z.number().int().min(0).optional().default(0),
  active: z.boolean().optional().default(true),
});

export const lineUpdateSchema = lineSchema.partial();

export const dealSchema = z.object({
  title_ar: z.string().min(1).max(200),
  title_he: z.string().max(200).nullable().default(""),
  description_ar: z.string().max(1000).nullable().default(""),
  description_he: z.string().max(1000).nullable().default(""),
  product_id: z.string().optional().nullable(),
  discount_type: z.enum(["fixed", "percent"]).optional().nullable(),
  discount_value: z.number().min(0).optional().nullable(),
  active: z.boolean().nullable().default(true),
  starts_at: z.string().optional().nullable(),
  ends_at: z.string().optional().nullable(),
});

export const dealUpdateSchema = dealSchema.partial();

export const idParam = z.string().uuid().or(z.string().min(1).max(100));

/**
 * Validate request body against a Zod schema.
 * Returns { data, error: null } on success, { data: null, error } on failure.
 */
export function validateBody<T>(body: unknown, schema: z.ZodSchema<T>): 
  { data: T; error: null } | { data: null; error: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { data: null, error: issues };
  }
  return { data: result.data, error: null };
}
