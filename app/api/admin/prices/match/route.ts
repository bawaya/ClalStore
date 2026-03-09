export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase';
import { callClaude } from '@/lib/ai/claude';
import type { Product } from '@/types/database';

type AiParsedRow = {
  deviceName: string;
  storage: string;
  price: number;
  priceWithVat: number;
  productId: string | null;
  variantStorage: string | null;
  confidence: 'exact' | 'fuzzy' | 'none';
};

export async function POST(req: NextRequest) {
  try {
    const { pdfText } = (await req.json()) as { pdfText: string };
    if (!pdfText?.trim()) {
      return NextResponse.json({ error: 'No PDF text provided' }, { status: 400 });
    }

    const db = createAdminSupabase();
    const { data: products } = await db.from('products').select('*').eq('type', 'device');

    if (!products?.length) {
      return NextResponse.json({ error: 'No products found in DB' }, { status: 404 });
    }

    const productList = (products as Product[]).map((p) => ({
      id: p.id,
      brand: p.brand,
      name_en: p.name_en || '',
      name_ar: p.name_ar,
      name_he: p.name_he || '',
      variants: (p.variants || []).map((v) => ({ storage: v.storage, price: v.price })),
    }));

    const systemPrompt = [
      'You are a data extraction and matching assistant for a mobile phone store.',
      '',
      'TASK 1: Extract data from the PDF price list:',
      '- The text is from a Hebrew PDF price list for mobile devices.',
      '- Each row has: device name (brand + model + storage) and multiple price columns.',
      '- Use the FIRST price column from the LEFT (labeled 1-18 or similar). This is the price BEFORE VAT.',
      '- Extract: device name (in English), storage capacity (e.g. 256GB), and the price from the 1-18 column.',
      '- SKIP headers, totals, page numbers, notes, and non-device rows.',
      '- Translate Hebrew device names to English (e.g. \u05D0\u05D9\u05D9\u05E4\u05D5\u05DF 16 = iPhone 16).',
      '',
      'TASK 2: Match each extracted device to a product in our database:',
      '- I will provide our product catalog with IDs, names, and storage variants.',
      '- Match by brand + model + storage capacity.',
      '- confidence: exact = clear match, fuzzy = likely match, none = no match.',
      '',
      'RULES:',
      '- priceWithVat = Math.round(price * 1.18)',
      '- If a device appears with different storage sizes, output separate rows.',
      '- Return ONLY a JSON array. No explanation, no markdown.',
      '',
      'OUTPUT FORMAT:',
      '[{"deviceName":"iPhone 16 Pro Max","storage":"256GB","price":4200,"priceWithVat":4956,"productId":"abc-123","variantStorage":"256GB","confidence":"exact"}]',
    ].join('\n');

    const userMessage = '=== OUR PRODUCT CATALOG ===\n'
      + JSON.stringify(productList, null, 1)
      + '\n\n=== PDF PRICE LIST TEXT (rows by newlines, columns by |) ===\n'
      + pdfText;

    const aiResult = await callClaude({
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 4000,
      temperature: 0.1,
      jsonMode: true,
      timeout: 60000,
    });

    if (!aiResult?.json && !aiResult?.text) {
      return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 });
    }

    let parsed: AiParsedRow[];
    try {
      const raw = aiResult.json || JSON.parse(
        aiResult.text.replace(/```json\s*|```\s*/g, '').trim()
      );
      parsed = Array.isArray(raw) ? raw : [];
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
    }

    const productMap = new Map((products as Product[]).map((p) => [p.id, p]));

    const results = parsed.map((row) => {
      const product = row.productId ? productMap.get(row.productId) : null;
      const variant = product?.variants?.find(
        (v) => v.storage?.toUpperCase().replace(/\s/g, '') === (row.variantStorage || '').toUpperCase().replace(/\s/g, '')
      );

      return {
        pdfDeviceName: row.deviceName,
        pdfStorage: row.storage || '',
        pdfPriceRaw: row.price,
        priceWithVat: row.priceWithVat,
        matched: !!variant,
        confidence: row.confidence || 'none',
        productId: product?.id || null,
        productNameAr: product?.name_ar || null,
        productNameHe: product?.name_he || null,
        variantStorage: variant?.storage || null,
        currentPrice: variant?.price ?? null,
        newPrice: row.priceWithVat,
        matchScore: row.confidence === 'exact' ? 1 : row.confidence === 'fuzzy' ? 0.6 : 0,
      };
    });

    const summary = {
      total: results.length,
      matched: results.filter((r) => r.matched).length,
      exact: results.filter((r) => r.confidence === 'exact').length,
      fuzzy: results.filter((r) => r.confidence === 'fuzzy').length,
      unmatched: results.filter((r) => !r.matched).length,
    };

    return NextResponse.json({ data: results, summary, aiTokens: aiResult.tokens, aiDuration: aiResult.duration });
  } catch (err: any) {
    console.error('[prices/match] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}