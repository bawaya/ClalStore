import { z } from "zod";

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
  sale_date: z.string().optional().nullable(), // YYYY-MM-DD
  customer_id: z.string().max(100).optional().nullable(),
  customer_phone: z.string().max(20).optional().nullable(),
  order_id: z.string().max(100).optional().nullable(),
  total_amount: z.number().min(0).optional().default(0),
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

