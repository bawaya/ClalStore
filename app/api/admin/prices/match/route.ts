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

const OPENAI_API = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

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
      b: p.brand,
      n: p.name_en || p.name_ar,
      v: (p.variants || []).map((v) => v.storage),
    }));

    const apiKey =
      process.env.OPENAI_API_KEY_PRICES ||
      process.env.OPENAI_API_KEY_ADMIN ||
      process.env.OPENAI_API_KEY ||
      '';
    steps.push('key=' + !!apiKey);
    if (!apiKey) {
      return NextResponse.json({ error: 'No OpenAI API key', steps }, { status: 500 });
    }

    const systemPrompt = [
      'You extract device prices from PDF text and match them to a product catalog.',
      'CATALOG: [{id,b:brand,n:name,v:[storages]}]',
      'TASK: From the Hebrew PDF price list, extract each device with its 1-18 column price (the first numeric price column from the left, BEFORE VAT).',
      'Translate Hebrew device names to English when possible.',
      'Match by brand + model + storage.',
      'SKIP headers, totals, notes, and non-device lines.',
      'Compute priceWithVat = Math.round(price * 1.18).',
      'Return ONE LINE per detected device in this exact pipe-separated format:',
      'deviceName || storage || price || priceWithVat || productId || variantStorage || confidence',
      'Rules for empty values:',
      '- If no product match, leave productId empty',
      '- If no variant match, leave variantStorage empty',
      '- confidence must be exact or fuzzy or none',
      'Return ONLY data lines. No JSON. No markdown. No numbering. No explanation.',
      'Example:',
      'iPhone 16 Pro Max || 256GB || 4200 || 4956 || prod_123 || 256GB || exact',
    ].join('\n');

    const userMsg = 'CATALOG:\n' + JSON.stringify(productList) + '\n\nPDF:\n' + pdfText;

    steps.push('prompt=' + userMsg.length);
    steps.push('calling OpenAI');

    const openAiBody = JSON.stringify({
      model: MODEL,
      temperature: 0.1,
      max_tokens: 12000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
    });

    steps.push('reqBody=' + openAiBody.length);

    const response = await fetch(OPENAI_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: openAiBody,
    });

    steps.push('status=' + response.status);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      steps.push('err=' + errText.substring(0, 500));
      return NextResponse.json({ error: 'OpenAI ' + response.status + ': ' + errText.substring(0, 300), steps }, { status: 500 });
    }

    const data = await response.json();
    const aiText: string = data.choices?.[0]?.message?.content || '';
    const tokens = {
      input: data.usage?.prompt_tokens || 0,
      output: data.usage?.completion_tokens || 0,
    };
    const stopReason = data.choices?.[0]?.finish_reason || '';
    steps.push('tokens=' + tokens.input + '+' + tokens.output + ' stop=' + stopReason);

    if (!aiText) {
      return NextResponse.json({ error: 'Empty response', data, steps }, { status: 500 });
    }

    steps.push('parsing lines len=' + aiText.length);
    let parsed: AiParsedRow[];
    try {
      const cleaned = aiText
        .replace(/```[\s\S]*?\n/g, '')
        .replace(/```/g, '')
        .trim();

      const lines: string[] = cleaned
        .split(/\r?\n/)
        .map((line: string) => line.trim())
        .filter(Boolean)
        .filter((line: string) => line.includes('||'));

      parsed = lines
        .map((line: string) => {
          const parts = line.split('||').map((part: string) => part.trim());
          const [
            deviceName = '',
            storage = '',
            priceText = '',
            priceWithVatText = '',
            productIdRaw = '',
            variantStorageRaw = '',
            confidenceRaw = 'none',
          ] = parts;

          const price = Number(priceText.replace(/[^\d.]/g, ''));
          const priceWithVat = Number(priceWithVatText.replace(/[^\d.]/g, ''));
          const confidence = /^(exact|fuzzy|none)$/i.test(confidenceRaw)
            ? confidenceRaw.toLowerCase()
            : 'none';

          return {
            deviceName,
            storage,
            price: Number.isFinite(price) ? price : 0,
            priceWithVat: Number.isFinite(priceWithVat) ? priceWithVat : 0,
            productId: productIdRaw || null,
            variantStorage: variantStorageRaw || null,
            confidence: confidence as AiParsedRow['confidence'],
          };
        })
        .filter((row: AiParsedRow) => row.deviceName && row.price > 0);
    } catch (e: any) {
      return NextResponse.json({ error: 'Parse: ' + e.message, aiText: aiText.substring(0, 1000), steps }, { status: 500 });
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
    return NextResponse.json({ data: results, summary, tokens, steps, provider: 'openai' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err), steps, stack: err.stack?.substring(0, 300) }, { status: 500 });
  }
}

