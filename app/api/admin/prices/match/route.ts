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
  const steps: string[] = [];

  try {
    steps.push('parsing request');
    const body = await req.json();
    const pdfText = body?.pdfText as string;
    if (!pdfText?.trim()) {
      return NextResponse.json({ error: 'No PDF text provided', steps }, { status: 400 });
    }
    steps.push('pdfText len=' + pdfText.length);

    steps.push('fetching products');
    const db = createAdminSupabase();
    const { data: products, error: dbErr } = await db.from('products').select('*').eq('type', 'device');

    if (dbErr) {
      return NextResponse.json({ error: 'DB: ' + dbErr.message, steps }, { status: 500 });
    }
    if (!products?.length) {
      return NextResponse.json({ error: 'No products in DB', steps }, { status: 404 });
    }
    steps.push('products=' + products.length);

    const productList = (products as Product[]).map((p) => ({
      id: p.id,
      brand: p.brand,
      name_en: p.name_en || '',
      name_ar: p.name_ar,
      name_he: p.name_he || '',
      variants: (p.variants || []).map((v) => ({ storage: v.storage, price: v.price })),
    }));

    const apiKey = process.env.ANTHROPIC_API_KEY_ADMIN || process.env.ANTHROPIC_API_KEY || '';
    steps.push('key=' + (apiKey.length > 0) + ' len=' + apiKey.length);
    if (!apiKey) {
      return NextResponse.json({ error: 'No ANTHROPIC_API_KEY_ADMIN', steps }, { status: 500 });
    }

    const systemPrompt = 'You are a data extraction and matching assistant for a mobile phone store.\n\nTASK 1: Extract data from the PDF price list:\n- The text is from a Hebrew PDF price list for mobile devices.\n- Each row has: device name (brand + model + storage) and multiple price columns.\n- Use the FIRST price column from the LEFT (labeled 1-18 or similar). This is the price BEFORE VAT.\n- Extract: device name (in English), storage capacity (e.g. 256GB), and the price.\n- SKIP headers, totals, page numbers, notes, and non-device rows.\n- Translate Hebrew device names to English.\n\nTASK 2: Match each extracted device to a product in our database:\n- I will provide our product catalog with IDs, names, and storage variants.\n- Match by brand + model + storage capacity.\n- confidence: exact = clear match, fuzzy = likely match, none = no match.\n\nRULES:\n- priceWithVat = Math.round(price * 1.18)\n- If a device appears with different storage sizes, output separate rows.\n- Return ONLY a JSON array. No explanation, no markdown.\n\nOUTPUT FORMAT:\n[{"deviceName":"iPhone 16 Pro Max","storage":"256GB","price":4200,"priceWithVat":4956,"productId":"id-or-null","variantStorage":"256GB-or-null","confidence":"exact"}]';

    const userMessage = '=== OUR PRODUCT CATALOG ===\n'
      + JSON.stringify(productList, null, 1)
      + '\n\n=== PDF PRICE LIST TEXT ===\n'
      + pdfText;

    steps.push('prompt len=' + userMessage.length);
    steps.push('calling Claude');

    const aiResult = await callClaude({
      apiKey,
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 4000,
      temperature: 0.1,
      jsonMode: true,
      timeout: 55000,
    });

    if (!aiResult) {
      return NextResponse.json({ error: 'Claude returned null', steps }, { status: 500 });
    }

    steps.push('claude ok ' + aiResult.duration + 'ms tok=' + aiResult.tokens.input + '+' + aiResult.tokens.output);

    if (!aiResult.json && !aiResult.text) {
      return NextResponse.json({ error: 'Claude empty response', steps }, { status: 500 });
    }

    steps.push('parsing JSON');
    let parsed: AiParsedRow[];
    try {
      const raw = aiResult.json || JSON.parse(aiResult.text.replace(/```json\s*|```\s*/g, '').trim());
      parsed = Array.isArray(raw) ? raw : [];
    } catch (e: any) {
      return NextResponse.json({ error: 'JSON parse: ' + e.message, aiText: aiResult.text?.substring(0, 500), steps }, { status: 500 });
    }

    steps.push('parsed rows=' + parsed.length);

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

    return NextResponse.json({ data: results, summary, aiTokens: aiResult.tokens, aiDuration: aiResult.duration, steps });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err), steps, stack: err.stack?.substring(0, 300) }, { status: 500 });
  }
}
