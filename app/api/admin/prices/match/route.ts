
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabase } from '@/lib/supabase';
import type { Product } from '@/types/database';
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";
import { getAdminOpenAIRuntime } from "@/lib/ai/openai-admin";

type AiParsedRow = {
  deviceName: string;
  storage: string;
  price: number;
  priceWithVat: number;
  monthlyPrice: number;
  productId: string | null;
  variantStorage: string | null;
  confidence: 'exact' | 'fuzzy' | 'none';
  brand: string;
};

const OPENAI_API = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

function inferBrand(brandRaw: string, deviceName: string): string {
  if (brandRaw?.trim()) return brandRaw.trim();
  const n = (deviceName || '').toLowerCase();
  if (/iphone|ipad|mac|apple watch/i.test(n)) return 'Apple';
  if (/galaxy|z flip|z fold|samsung|a\d|s\d/i.test(n)) return 'Samsung';
  if (/xiaomi|redmi|poco/i.test(n)) return 'Xiaomi';
  if (/google|pixel/i.test(n)) return 'Google';
  if (/oppo|realme|oneplus/i.test(n)) return 'Oppo';
  if (/honor|huawei/i.test(n)) return 'Honor';
  if (/motorola|moto/i.test(n)) return 'Motorola';
  if (/nokia/i.test(n)) return 'Nokia';
  if (/sony|xperia/i.test(n)) return 'Sony';
  return 'Other';
}

export async function POST(req: NextRequest) {
  const steps: string[] = [];

  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    steps.push('parsing request');
    const body = await req.json();
    const pdfText = body?.pdfText as string;
    if (!pdfText?.trim()) {
      return apiError('No PDF text', 400);
    }
    steps.push('pdfText=' + pdfText.length);

    steps.push('fetching products');
    const supabase = createAdminSupabase();
    const { data: products, error: dbErr } = await supabase.from('products').select('*').eq('type', 'device');
    if (dbErr) {
      console.error("Price match DB error:", dbErr.message);
      return apiError("فشل في جلب المنتجات", 500);
    }
    if (!products?.length) {
      return apiError('No products in DB', 404);
    }
    steps.push('products=' + products.length);

    const productList = (products as Product[]).map((p) => ({
      id: p.id,
      b: p.brand,
      n: p.name_en || p.name_ar,
      v: (p.variants || []).map((v) => v.storage),
    }));

    const runtime = await getAdminOpenAIRuntime("pricing");
    const apiKey = runtime?.apiKey || "";
    const model = runtime?.model || DEFAULT_MODEL;
    steps.push('key=' + !!apiKey);
    steps.push('model=' + model);
    if (!apiKey) {
      return apiError('No OpenAI API key', 500);
    }

    const systemPrompt = [
      'You extract device prices from PDF/Excel text and match them to a product catalog.',
      'CATALOG: [{id,b:brand,n:name,v:[storages]}]',
      'TASK: From the price list, extract each device with:',
      '1. The 1-18 installments price column (BEFORE VAT)',
      '2. The 36-installments monthly payment column (the monthly amount for 36 months, BEFORE VAT)',
      'Translate Hebrew device names to English when possible.',
      'Match by brand + model + storage.',
      'SKIP headers, totals, notes, and non-device lines.',
      'Output price and monthlyPrice as the raw values (BEFORE VAT) from the PDF.',
      'If no 36-month column exists, set monthlyPrice to 0.',
      'Return ONE LINE per detected device in this exact pipe-separated format:',
      'deviceName || storage || price || monthlyPrice || productId || variantStorage || confidence || brand',
      'Rules for empty values:',
      '- If no product match, leave productId empty',
      '- If no variant match, leave variantStorage empty',
      '- If no 36-month price, use 0 for monthlyPrice',
      '- confidence must be exact or fuzzy or none',
      '- brand: always extract (Apple, Samsung, Xiaomi, etc.) from device name for creating new products',
      'Return ONLY data lines. No JSON. No markdown. No numbering. No explanation.',
      'Example:',
      'iPhone 16 Pro Max || 256GB || 4200 || 127 || prod_123 || 256GB || exact || Apple',
    ].join('\n');

    const userMsg = 'CATALOG:\n' + JSON.stringify(productList) + '\n\nPDF:\n' + pdfText;

    steps.push('prompt=' + userMsg.length);
    steps.push('calling OpenAI');

    const openAiBody = JSON.stringify({
      model,
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
      return apiError('OpenAI ' + response.status + ': ' + errText.substring(0, 300), 500);
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
      return apiError('Empty response', 500);
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
            monthlyPriceText = '',
            productIdRaw = '',
            variantStorageRaw = '',
            confidenceRaw = 'none',
            brandRaw = '',
          ] = parts;

          const price = Number(priceText.replace(/[^\d.]/g, ''));
          const monthlyRaw = Number(monthlyPriceText.replace(/[^\d.]/g, ''));
          const confidence = /^(exact|fuzzy|none)$/i.test(confidenceRaw)
            ? confidenceRaw.toLowerCase()
            : 'none';
          const brand = inferBrand(brandRaw, deviceName);
          const priceWithVat = Number.isFinite(price) ? Math.round(price * 1.18) : 0;
          const monthlyPrice = Number.isFinite(monthlyRaw) ? Math.round(monthlyRaw * 1.18) : 0;

          return {
            deviceName,
            storage,
            price: Number.isFinite(price) ? price : 0,
            priceWithVat,
            monthlyPrice,
            productId: productIdRaw || null,
            variantStorage: variantStorageRaw || null,
            confidence: confidence as AiParsedRow['confidence'],
            brand,
          };
        })
        .filter((row: AiParsedRow) => row.deviceName && row.price > 0);
    } catch (e: unknown) {
      return apiError('Parse: ' + errMsg(e, "Unknown error"), 500);
    }

    steps.push('parsed=' + parsed.length);

    const productMap = new Map((products as Product[]).map((p) => [p.id, p]));
    const productListArr = products as Product[];

    /** مطابقة محلية عند فشل OpenAI — تطابق brand + model + storage */
    const fallbackMatch = (row: AiParsedRow): { productId: string | null; variantStorage: string | null } => {
      const norm = (s: string) => (s || '').toUpperCase().replace(/\s/g, '');
      const normStorage = (s: string) => norm(String(s || '').replace(/[^\dGBT]/gi, ''));
      const baseModel = (name: string) => name.replace(/\s*(?:128|256|512|64|32|1)\s*(?:GB|TB)\s*$/i, '').trim();
      const toCompare = (s: string) => (s || '').toLowerCase()
        .replace(/آيفون|ايفون/g, 'iphone').replace(/جالكسي|جالاكسي/g, 'galaxy')
        .replace(/^(samsung\s+)?galaxy\s+/i, '').replace(/\s*5g\s*/gi, ' ').replace(/\s+/g, ' ');

      const rowBrand = (row.brand || inferBrand('', row.deviceName)).toLowerCase();
      const rowStorage = normStorage(row.storage || '');
      const rowModel = baseModel(row.deviceName || '');
      const rowCompare = toCompare(rowModel);

      let best: { productId: string; variantStorage: string; score: number } | null = null;

      for (const p of productListArr) {
        const pBrand = (p.brand || '').toLowerCase();
        if (pBrand !== rowBrand) continue;

        const pCompare = toCompare(p.name_en || p.name_ar || '');

        const modelMatch = pCompare.includes(rowCompare) || rowCompare.includes(pCompare) ||
          norm(pCompare) === norm(rowCompare) ||
          (rowCompare.match(/\d+/) && pCompare.match(/\d+/) && rowCompare.match(/\d+/)?.[0] === pCompare.match(/\d+/)?.[0]);

        if (!modelMatch) continue;

        const variants = p.variants || [];
        const storages = [...new Set([...(p.storage_options || []), ...variants.map((v: any) => v.storage).filter(Boolean)])];

        for (const st of storages) {
          if (!st) continue;
          if (normStorage(st) === rowStorage || norm(st) === rowStorage) {
            const score = pCompare === rowCompare ? 1 : 0.8;
            if (!best || score > best.score) {
              best = { productId: p.id, variantStorage: st, score };
            }
          }
        }
      }
      return best ? { productId: best.productId, variantStorage: best.variantStorage } : { productId: null, variantStorage: null };
    };

    const results = parsed.map((row) => {
      let productId = row.productId;
      let variantStorage = row.variantStorage;
      if (!productId) {
        const fb = fallbackMatch(row);
        productId = fb.productId;
        variantStorage = fb.variantStorage;
      }
      const product = productId ? productMap.get(productId) : null;
      const variant = product?.variants?.find(
        (v) => v.storage?.toUpperCase().replace(/\s/g, '') === (variantStorage || '').toUpperCase().replace(/\s/g, '')
      );

      return {
        pdfDeviceName: row.deviceName,
        pdfStorage: row.storage || '',
        pdfBrand: row.brand || 'Other',
        pdfPriceRaw: row.price,
        priceWithVat: row.priceWithVat,
        monthlyPrice: row.monthlyPrice || 0,
        matched: !!variant,
        confidence: row.confidence || 'none',
        productId: product?.id || null,
        productNameAr: product?.name_ar || null,
        productNameHe: product?.name_he || null,
        variantStorage: variant?.storage || null,
        currentPrice: variant?.price ?? null,
        currentMonthly: variant?.monthly_price ?? null,
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
    return apiSuccess({ rows: results, summary, tokens, steps, provider: 'openai' });
  } catch (err: unknown) {
    console.error("Price match error:", err);
    return apiError("فشل في مطابقة الأسعار", 500);
  }
}

