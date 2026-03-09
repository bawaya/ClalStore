export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase';
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

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

export async function POST(req: NextRequest) {
  const steps: string[] = [];

  try {
    steps.push('parsing request');
    const body = await req.json();
    const pdfText = body?.pdfText as string;
    if (!pdfText?.trim()) {
      return NextResponse.json({ error: 'No PDF text', steps }, { status: 400 });
    }
    steps.push('pdfText=' + pdfText.length);

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
    steps.push('key=' + !!apiKey);
    if (!apiKey) {
      return NextResponse.json({ error: 'No API key', steps }, { status: 500 });
    }

    const systemPrompt = 'You are a data extraction and matching assistant for a mobile phone store.\n\nTASK 1: Extract data from the PDF price list:\n- Hebrew PDF price list for mobile devices.\n- Each row has device name and multiple price columns.\n- Use FIRST price column from LEFT (labeled 1-18). Price is BEFORE VAT.\n- Extract: device name (English), storage (e.g. 256GB), price.\n- SKIP headers, totals, page numbers, notes.\n- Translate Hebrew names to English.\n\nTASK 2: Match to our database:\n- Match by brand + model + storage.\n- confidence: exact/fuzzy/none.\n\nRULES:\n- priceWithVat = Math.round(price * 1.18)\n- Separate rows per storage size.\n- Return ONLY JSON array.\n\nFORMAT: [{"deviceName":"iPhone 16 Pro Max","storage":"256GB","price":4200,"priceWithVat":4956,"productId":"id-or-null","variantStorage":"256GB-or-null","confidence":"exact"}]';

    const userMsg = '=== PRODUCT CATALOG ===\n' + JSON.stringify(productList, null, 1) + '\n\n=== PDF TEXT ===\n' + pdfText;

    steps.push('prompt=' + userMsg.length);
    steps.push('calling Anthropic API directly');

    const anthropicBody = JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0.1,
      system: systemPrompt + '\n\nRespond with JSON only, no extra text or markdown.',
      messages: [{ role: 'user', content: userMsg }],
    });

    steps.push('reqBody=' + anthropicBody.length);

    const response = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: anthropicBody,
    });

    steps.push('status=' + response.status);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      steps.push('errBody=' + errText.substring(0, 500));
      return NextResponse.json({ error: 'Claude API ' + response.status + ': ' + errText.substring(0, 300), steps }, { status: 500 });
    }

    const data = await response.json();
    const aiText = data.content?.[0]?.text || '';
    const tokens = { input: data.usage?.input_tokens || 0, output: data.usage?.output_tokens || 0 };
    steps.push('tokens=' + tokens.input + '+' + tokens.output);

    if (!aiText) {
      return NextResponse.json({ error: 'Claude empty response', data, steps }, { status: 500 });
    }

    steps.push('parsing JSON');
    let parsed: AiParsedRow[];
    try {
      const cleaned = aiText.replace(/```json\s*|```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) parsed = [];
    } catch (e: any) {
      return NextResponse.json({ error: 'JSON parse: ' + e.message, aiText: aiText.substring(0, 500), steps }, { status: 500 });
    }

    steps.push('parsed=' + parsed.length);

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

    steps.push('done');
    return NextResponse.json({ data: results, summary, tokens, steps });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err), steps, stack: err.stack?.substring(0, 300) }, { status: 500 });
  }
}
