import { z } from "zod";

export const productSchema = z.object({
  name_ar: z.string().min(1).max(200),
  name_he: z.string().max(200).default(""),
  brand: z.string().min(1).max(100),
  type: z.enum(["device", "accessory"]),
  price: z.number().min(0),
  old_price: z.number().min(0).optional().nullable(),
  cost: z.number().min(0).default(0),
  stock: z.number().int().min(0).default(0),
  sold: z.number().int().min(0).default(0),
  image_url: z.string().max(1000).optional().nullable(),
  gallery: z.array(z.string()).optional().default([]),
  colors: z.array(z.any()).optional().default([]),
  storage_options: z.array(z.string()).optional().default([]),
  variants: z.array(z.any()).optional().default([]),
  specs: z.record(z.string(), z.string()).optional().default({}),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  description_ar: z.string().max(5000).optional().nullable(),
  description_he: z.string().max(5000).optional().nullable(),
});

export const productUpdateSchema = productSchema.partial();

export const couponSchema = z.object({
  code: z.string().min(1).max(50).transform((v) => v.toUpperCase()),
  type: z.enum(["fixed", "percent"]),
  value: z.number().min(0),
  min_order: z.number().min(0).nullable().default(0),
  max_uses: z.number().int().min(0).nullable().default(0),
  used_count: z.number().int().min(0).nullable().default(0),
  active: z.boolean().nullable().default(true),
  expires_at: z.string().optional().nullable(),
});

export const couponUpdateSchema = couponSchema.partial();

export const heroSchema = z.object({
  title_ar: z.string().min(1).max(200),
  title_he: z.string().max(200).nullable().default(""),
  subtitle_ar: z.string().max(500).nullable().default(""),
  subtitle_he: z.string().max(500).nullable().default(""),
  image_url: z.string().max(1000).nullable().default(""),
  link_url: z.string().max(1000).nullable().default(""),
  cta_text_ar: z.string().max(100).nullable().default(""),
  cta_text_he: z.string().max(100).nullable().default(""),
  sort_order: z.number().int().min(0).nullable().default(0),
  active: z.boolean().nullable().default(true),
});

export const heroUpdateSchema = heroSchema.partial();

export const categorySchema = z.object({
  name_ar: z.string().min(1).max(200),
  name_he: z.string().max(200).nullable().default(""),
  type: z.enum(["manual", "auto"]).default("manual"),
  rule: z.string().max(500).optional().nullable(),
  product_ids: z.array(z.string()).optional().default([]),
  sort_order: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});
export const categoryUpdateSchema = categorySchema.partial();

export const lineSchema = z.object({
  name_ar: z.string().min(1).max(200),
  name_he: z.string().max(200).nullable().default(""),
  data_amount: z.string().min(1).max(50),
  price: z.number().min(0),
  features_ar: z.array(z.string()).nullable().optional().default([]),
  features_he: z.array(z.string()).nullable().optional().default([]),
  popular: z.boolean().nullable().default(false),
  sort_order: z.number().int().min(0).nullable().default(0),
  active: z.boolean().nullable().default(true),
});

export const lineUpdateSchema = lineSchema.partial();

export const dealSchema = z.object({
  title_ar: z.string().min(1).max(200),
  title_he: z.string().max(200).nullable().default(""),
  description_ar: z.string().max(1000).nullable().default(""),
  description_he: z.string().max(1000).nullable().default(""),
  product_id: z.string().optional().nullable(),
  discount_type: z.enum(["fixed", "percentage"]).optional().nullable(),
  discount_value: z.number().min(0).optional().nullable(),
  active: z.boolean().nullable().default(true),
  starts_at: z.string().optional().nullable(),
  ends_at: z.string().optional().nullable(),
});

export const dealUpdateSchema = dealSchema.partial();

export const idParam = z.string().uuid().or(z.string().min(1).max(100));

// ===== Pipeline Deal =====

export const pipelineDealSchema = z.object({
  stage_id: z.number().int().min(1),
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().max(30).optional(),
  customer_email: z.string().email().max(200).optional(),
  product_name: z.string().max(500).optional(),
  product_id: z.string().max(100).optional(),
  estimated_value: z.number().min(0).optional(),
  notes: z.string().max(2000).optional(),
  lost_reason: z.string().max(500).optional(),
});

export const pipelineDealUpdateSchema = pipelineDealSchema.partial().extend({
  id: z.string().min(1),
});

// ===== Customer =====

export const customerSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(1).max(30),
  email: z.string().email().max(200).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  id_number: z.string().max(20).optional().nullable(),
  segment: z.string().max(50).optional().default("new"),
  birthday: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  source: z.string().max(50).optional().default("manual"),
  gender: z.string().max(20).optional().nullable(),
  preferred_language: z.string().max(10).optional().default("ar"),
  notes: z.string().max(5000).optional().nullable(),
});

export const customerUpdateSchema = customerSchema.partial();

export const customerNoteSchema = z.object({
  text: z.string().min(1).max(5000),
});

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

// ===== Public Route Schemas =====

export const orderSchema = z.object({
  customer: z.object({
    name: z.string().min(1).max(200),
    phone: z.string().min(7).max(20),
    city: z.string().min(1).max(100),
    address: z.string().min(1).max(500),
    email: z.string().email().max(200).optional(),
    idNumber: z.string().max(20).optional(),
    notes: z.string().max(2000).optional(),
  }),
  items: z.array(z.object({
    productId: z.string().min(1),
    name: z.string().min(1).max(300),
    brand: z.string().max(100),
    type: z.string().max(50),
    price: z.number().min(0),
    quantity: z.number().int().min(1).max(100).optional(),
    color: z.string().max(100).optional(),
    storage: z.string().max(50).optional(),
    productName: z.string().max(300).optional(),
  })).min(1),
  payment: z.record(z.string(), z.unknown()).optional(),
  couponCode: z.string().max(50).optional(),
  discountAmount: z.number().min(0).optional(),
  source: z.string().max(50).optional(),
});

export const reviewSchema = z.object({
  product_id: z.string().min(1),
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().max(20).optional(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(300).optional(),
  body: z.string().max(5000).optional(),
});

export const contactSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(7).max(20),
  email: z.string().email().max(200).optional().nullable(),
  subject: z.string().max(300).optional(),
  message: z.string().min(1).max(5000),
});

export const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().max(200).optional(),
});

export const couponValidateSchema = z.object({
  code: z.string().min(1).max(50),
  total: z.number().min(0),
});

export const abandonedCartSchema = z.object({
  visitor_id: z.string().min(1).max(200),
  customer_phone: z.string().max(20).optional().nullable(),
  customer_name: z.string().max(200).optional().nullable(),
  items: z.array(z.unknown()).min(1),
  total: z.number().min(0).optional(),
});

export const manualOrderSchema = z.object({
  customer_name: z.string().min(1).max(200),
  customer_phone: z.string().min(7).max(20),
  customer_email: z.string().email().max(200).optional(),
  items: z.array(z.object({
    product_id: z.string().optional(),
    name: z.string().min(1),
    price: z.number().min(0),
    quantity: z.number().int().min(1).default(1),
  })).min(1),
  subtotal: z.number().min(0),
  discount: z.number().min(0).optional(),
  shipping: z.number().min(0).optional(),
  total: z.number().min(0),
  notes: z.string().max(2000).optional(),
  source: z.enum(["manual", "phone", "pipeline"]).default("manual"),
  deal_id: z.string().optional(),
  payment_method: z.string().optional(),
  status: z.string().optional(),
});

export type ManualOrderInput = z.infer<typeof manualOrderSchema>;
