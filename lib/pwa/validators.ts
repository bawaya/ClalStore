import { z } from "zod";

export const MAX_SALE_AMOUNT = 100000; // ILS sanity cap (audit 4.12)
export const MAX_SALE_DAYS_BACK = 90; // can't back-date > 90d (audit 4.16)

const saleDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ يجب أن يكون بصيغة YYYY-MM-DD")
  .refine((s) => {
    const t = new Date(s + "T00:00:00Z").getTime();
    if (Number.isNaN(t)) return false;
    const now = Date.now();
    const cutoff = now - MAX_SALE_DAYS_BACK * 86400000;
    // Allow up to the end of today (UTC+3 Israel leniency: +1 day)
    const maxFuture = now + 1 * 86400000;
    return t >= cutoff && t <= maxFuture;
  }, `التاريخ يجب أن يكون خلال آخر ${MAX_SALE_DAYS_BACK} يوم`);

export const salesDocItemSchema = z.object({
  item_type: z.enum(["line", "device", "accessory"]),
  product_id: z.string().max(100).optional().nullable(),
  product_name: z.string().max(500).optional().nullable(),
  qty: z.number().int().min(1).max(100).default(1),
  unit_price: z.number().min(0).default(0),
  line_total: z.number().min(0).default(0),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export const createSalesDocSchema = z.object({
  doc_uuid: z.string().uuid().optional(),
  sale_type: z.enum(["line", "device", "mixed"]),
  sale_date: saleDateSchema.optional().nullable(),
  customer_id: z.string().max(100).optional().nullable(),
  customer_phone: z.string().max(20).optional().nullable(),
  customer_confirmed_name: z.string().max(200).optional().nullable(),
  order_id: z.string().max(100).optional().nullable(),
  total_amount: z
    .number()
    .positive("مبلغ البيع يجب أن يكون أكبر من صفر")
    .max(MAX_SALE_AMOUNT, `مبلغ البيع لا يمكن أن يتجاوز ${MAX_SALE_AMOUNT}`),
  currency: z.string().max(10).optional().default("ILS"),
  notes: z.string().max(5000).optional().nullable(),
  device_client_id: z.string().max(200).optional().nullable(),
  idempotency_key: z.string().max(200).optional().nullable(),
  items: z.array(salesDocItemSchema).optional().default([]),
});

export const updateSalesDocSchema = createSalesDocSchema.partial().extend({
  id: z.number().int().positive(),
});

export const submitSalesDocSchema = z.object({
  id: z.number().int().positive(),
});

/** Customer creation from PWA (decision 5). */
export const createCustomerFromPwaSchema = z.object({
  name: z.string().min(2).max(200),
  phone: z
    .string()
    .min(7)
    .max(20)
    .regex(/^[0-9+\- ]+$/, "رقم الهاتف غير صالح"),
  national_id: z
    .string()
    .max(20)
    .regex(/^[0-9]+$/, "رقم الهوية أرقام فقط")
    .optional()
    .nullable(),
  email: z.string().email().max(200).optional().nullable(),
});
