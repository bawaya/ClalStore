// =====================================================
// Zod schemas for Intelligence outputs
// Validates everything coming out of Opus before it touches the DB.
// =====================================================

import { z } from "zod";

const productTypeSchema = z.enum([
  "device", "accessory", "appliance", "tv", "computer", "tablet", "network",
]);

export const classificationItemSchema = z.object({
  brand: z.string().min(1).max(60).nullable(),
  type: productTypeSchema,
  subkind: z.string().max(40).nullable().optional(),
  appliance_kind: z.string().max(40).nullable().optional(),
  name_en: z.string().min(1).max(200),
  description_ar: z.string().max(2000).optional().default(""),
  description_he: z.string().max(2000).optional().default(""),
  specs: z.record(z.string(), z.union([z.string(), z.number()])).optional().default({}),
  confidence: z.object({
    brand: z.number().min(0).max(1).optional(),
    type: z.number().min(0).max(1).optional(),
    subkind: z.number().min(0).max(1).optional(),
  }).optional().default({}),
  needs_review: z.boolean().optional().default(false),
});

export type ClassificationItem = z.infer<typeof classificationItemSchema>;

export const classificationArraySchema = z.array(classificationItemSchema);

// ────────────────────────────────────────────────
// Health report
// ────────────────────────────────────────────────

const idArr = z.array(z.string().uuid());
const idStr = z.string().uuid();

export const healthReportSchema = z.object({
  summary: z.object({
    score: z.number().min(0).max(100),
    total_issues: z.number().int().min(0),
  }),
  duplicates: z.array(z.object({
    ids: idArr,
    name: z.string(),
    reason: z.string(),
  })).default([]),
  brand_inconsistency: z.array(z.object({
    ids: idArr,
    current_brands: z.array(z.string()),
    suggested: z.string(),
  })).default([]),
  missing_fields: z.array(z.object({
    id: idStr,
    missing: z.array(z.string()),
  })).default([]),
  type_misclassified: z.array(z.object({
    id: idStr,
    current_type: productTypeSchema,
    suggested_type: productTypeSchema,
    reason: z.string(),
  })).default([]),
  price_outliers: z.array(z.object({
    ids: idArr,
    model: z.string(),
    prices: z.array(z.number()),
    reason: z.string(),
  })).default([]),
  missing_subkind: z.array(z.object({
    id: idStr,
    type: productTypeSchema,
    suggested_subkind: z.string(),
  })).default([]),
});

export type HealthReport = z.infer<typeof healthReportSchema>;

// ────────────────────────────────────────────────
// Generator
// ────────────────────────────────────────────────

export const generatorOutputSchema = z.object({
  name_en: z.string().min(1).max(200),
  description_ar: z.string().max(2000),
  description_he: z.string().max(2000),
  specs_inferred: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
});

export type GeneratorOutput = z.infer<typeof generatorOutputSchema>;

// ────────────────────────────────────────────────
// Chat — bulk action proposal
// ────────────────────────────────────────────────

export const bulkActionSchema = z.object({
  action: z.literal("bulk_update"),
  filter: z.record(z.string(), z.unknown()),
  changes: z.record(z.string(), z.unknown()),
  estimated_count: z.number().int().min(0),
  preview: z.array(idStr).max(20),
});

export type BulkAction = z.infer<typeof bulkActionSchema>;
