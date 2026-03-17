/**
 * FINAL precise price update — explicit product ID + storage mapping
 * Fixes all mismatches from the fuzzy v2 run
 */
const { loadEnvConfig } = require("@next/env");
const { createClient } = require("@supabase/supabase-js");

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const db = createClient(supabaseUrl, supabaseKey);

// Explicit: productId → { storage: { price, monthly } }
// Only variants listed here get updated. Unlisted variants are untouched.
const PRODUCT_PRICES = {
  // ──── iPhone 17 ────
  "52a959a8-5167-4bf4-abb1-797384147219": {
    "256GB": { price: 3798, monthly: 169 },
    "512GB": { price: 4698, monthly: 192 },
  },
  "0cfa619d-7068-4cf8-96e8-945849a8bb5a": { // iPhone 17 Air
    "256GB": { price: 3949, monthly: 170 },
    "512GB": { price: 4949, monthly: 199 },
    "1TB":   { price: 5849, monthly: 219 },
  },
  "45829250-2046-4ddd-a346-34611bbb578e": { // iPhone 17 Pro
    "256GB": { price: 5148, monthly: 207 },
    "512GB": { price: 6048, monthly: 225 },
    "1TB":   { price: 6998, monthly: 250 },
  },
  "966e3231-acb9-4163-8d2e-b0f5f72946c6": { // iPhone 17 Pro Max
    "256GB": { price: 5598, monthly: 219 },
    "512GB": { price: 6498, monthly: 239 },
    "1TB":   { price: 7398, monthly: 269 },
    "2TB":   { price: 9198, monthly: 315 },
  },

  // ──── Samsung Galaxy S26 ────
  "424155b1-0f78-468b-a4d8-01d05573ee05": { // Galaxy S26 Ultra
    "256GB": { price: 4519, monthly: 189 },
    "512GB": { price: 5199, monthly: 215 },
    "1TB":   { price: 6199, monthly: 239 },
  },

  // ──── Samsung Galaxy S25 ────
  "98a92284-81e7-4ccb-9665-00638c2b91a0": { // Galaxy S25
    "128GB": { price: 2829, monthly: 129 },
    "256GB": { price: 2949, monthly: 139 },
  },
  "abc93db3-ebd8-45ca-86e5-ffc8803852ee": { // Galaxy S25+
    "256GB": { price: 3398, monthly: 149 },
    "512GB": { price: 3799, monthly: 159 },
  },
  "124b39d9-1800-4dab-8ec7-44690fa1698f": { // Galaxy S25 Ultra
    "256GB": { price: 4049, monthly: 169 },
    "512GB": { price: 4390, monthly: 179 },
    "1TB":   { price: 5599, monthly: 209 },
  },
  "8e3de1fb-1078-4b0a-81e6-a122088b21e0": { // S25 Edge
    "256GB": { price: 2399, monthly: 109 },
    "512GB": { price: 2999, monthly: 129 },
  },
  "dba567d0-67f5-4d3b-9a5d-eec4d05d3dcc": { // S25 FE
    "128GB": { price: 2248, monthly: 115 },
    "256GB": { price: 2598, monthly: 123 },
  },

  // ──── Samsung Galaxy S24 ────
  "b24c8fe4-bb30-4fc6-bab4-2bd275e6521c": { // S24 Ultra
    "256GB": { price: 4519, monthly: 169 },
    "512GB": { price: 4899, monthly: 169 },
  },
  "32e94455-9769-474c-9642-13ec165cc58c": { // S24 Ultra (dup)
    "256GB": { price: 4519, monthly: 169 },
    "512GB": { price: 4899, monthly: 169 },
  },
  "a1505323-d442-4a6d-a873-db0480a79cb2": { // S24+
    "256GB": { price: 3599, monthly: 129 },
    "512GB": { price: 3899, monthly: 139 },
  },
  "4960bfb4-e86a-4845-af88-270ed9b8a101": { // S24 FE
    "128GB": { price: 2299, monthly: 103 },
    "256GB": { price: 2450, monthly: 115 },
  },

  // ──── Samsung Galaxy S23 ────
  "8b672cb0-099a-4f3a-bdf5-072cbcf7abc9": { // S23 Ultra (Arabic)
    "256GB": { price: 4539, monthly: 169 },
    "512GB": { price: 5399, monthly: 199 },
  },
  "178aa014-0a8f-47dc-ade8-502c0b9ca7a7": { // S23 Ultra (Arabic dup)
    "256GB": { price: 4539, monthly: 169 },
    "512GB": { price: 5399, monthly: 199 },
  },
  "d9ac5fff-d05e-40c7-91e4-0decf88123a7": { // S23+ (Arabic)
    "256GB": { price: 3729, monthly: 160 },
  },
  "9c3099ee-f281-4d84-a754-06a706bd9d6a": { // S23 (Arabic)
    "128GB": { price: 2119, monthly: 119 },
  },
  "c2301d4a-19e9-4ea2-9bff-041084e0a290": { // S23 FE (Arabic)
    "128GB": { price: 1669, monthly: 99 },
  },
  "66bc1d4b-2268-46cd-a490-ee8dff9cd958": { // S24 (Arabic)
    "128GB": { price: 3049, monthly: 99 },
    "256GB": { price: 3099, monthly: 119 },
  },
  "d2ede50b-d403-4cad-9485-78ce84755e7e": { // S24 (Arabic dup)
    "128GB": { price: 3049, monthly: 99 },
    "256GB": { price: 3099, monthly: 119 },
  },
  "e2363c1c-2e00-4e0f-b345-0f35b8eae47b": { // S24 FE (Arabic)
    "128GB": { price: 2299, monthly: 103 },
    "256GB": { price: 2450, monthly: 115 },
  },
  "b0fdcdf4-13e1-49a5-99dd-f50efe5b639c": { // S24+ (Arabic)
    "256GB": { price: 3599, monthly: 129 },
    "512GB": { price: 3899, monthly: 139 },
  },
  "5649fdd3-8e19-4ad1-8d25-bce57eb7e646": { // S25 FE (Arabic)
    "128GB": { price: 2248, monthly: 115 },
    "256GB": { price: 2598, monthly: 123 },
  },
  "4725a242-c9a1-4565-9ce3-595377410b7d": { // S25 Edge (Arabic)
    "256GB": { price: 2399, monthly: 109 },
    "512GB": { price: 2999, monthly: 129 },
  },

  // ──── Samsung Galaxy Z ────
  "fa175e73-82b7-4789-a867-f64245710f9e": { // Z Flip7
    "256GB": { price: 4049, monthly: 169 },
    "512GB": { price: 4549, monthly: 189 },
  },
  "d0fd0027-986e-4f4b-a47a-6ae7e5426da6": { // Z Flip7 (Arabic)
    "256GB": { price: 4049, monthly: 169 },
    "512GB": { price: 4549, monthly: 189 },
  },
  "1722ba00-20d4-4ba9-a133-34560f6da241": { // Z Flip6
    "256GB": { price: 3929, monthly: 139 },
    "512GB": { price: 4639, monthly: 179 },
  },
  "ffc79c9b-da82-4469-ad10-32ca9cd52b75": { // Z Flip6 (Arabic)
    "256GB": { price: 3929, monthly: 139 },
    "512GB": { price: 4639, monthly: 179 },
  },
  "5edc6689-0940-4ec7-9fd7-b08c6164f8f9": { // Z Fold7
    "256GB": { price: 7335, monthly: 259 },
    "512GB": { price: 7949, monthly: 279 },
  },
  "10332570-a58a-4183-92d1-4802e49c016f": { // Z Fold7 (Arabic)
    "256GB": { price: 7335, monthly: 259 },
    "512GB": { price: 7949, monthly: 279 },
  },
  "91913d6f-dc2a-48e0-a995-5173ed9699bb": { // Z Fold6 (Arabic)
    "256GB": { price: 6799, monthly: 229 },
    "512GB": { price: 7359, monthly: 249 },
  },
  "c81b359d-7ee9-4b2a-9f39-63ced5068b51": { // Z Fold6 (Arabic dup)
    "256GB": { price: 6799, monthly: 229 },
    "512GB": { price: 7359, monthly: 249 },
  },
  "b749770a-1f8b-472e-b180-9e44733cf31b": { // Z Fold5 (Arabic)
    "256GB": { price: 5949, monthly: 199 },
  },
  "0a8d634e-a9d2-40ed-931a-3ff8a8acfeba": { // Z Fold4 (Arabic)
    "256GB": { price: 4539, monthly: 159 },
  },

  // ──── Samsung Galaxy A Series ────
  "f3c392c0-6cab-472b-b27c-6e7ede1f9548": { // A73
    "128GB": { price: 1969, monthly: 89 },
  },
  "b4fc449a-f772-48c4-a5b0-451282cd4ed1": { // A72
    "128GB": { price: 1809, monthly: 75 },
  },
  "ac201f2f-dee1-421f-aba5-0fdc46e5a7ec": { // A56
    "128GB": { price: 1569, monthly: 85 },
    "256GB": { price: 1799, monthly: 89 },
  },
  "ca2c19e5-05b7-4296-a3f4-7ce90f0c7ebe": { // A56 dup
    "128GB": { price: 1569, monthly: 85 },
    "256GB": { price: 1799, monthly: 89 },
  },
  "647d3d1b-0901-479a-aaba-0e6205a26886": { // A55
    "128GB": { price: 1869, monthly: 93 },
    "256GB": { price: 1899, monthly: 99 },
  },
  "cd36dff8-9d60-4eb8-a47d-63ceb56fd303": { // A55 dup
    "128GB": { price: 1869, monthly: 93 },
    "256GB": { price: 1899, monthly: 99 },
  },
  "21d6e78b-83b9-46e4-81d3-faeedb2b29fb": { // A54
    "128GB": { price: 1769, monthly: 95 },
  },
  "887759b6-b30e-4c11-ae76-9179adc37f2f": { // A53
    "128GB": { price: 1669, monthly: 69 },
  },
  "c5da21af-1ce2-4bd5-8fa8-f1c3eae0ce12": { // A36
    "128GB": { price: 1249, monthly: 79 },
  },
  "7427711d-89b5-46e2-a97c-c8164508002d": { // A34
    "128GB": { price: 1309, monthly: 69 },
  },
  "042fe66a-7cb1-4b1f-b365-444267ee3c9a": { // A26
    "128GB": { price: 1099, monthly: 64 },
  },
  "fe98364d-6170-4a44-9d21-07efbcb511ba": { // A25
    "128GB": { price: 1109, monthly: 65 },
  },
  "402f7329-b59a-4078-bf97-ff312ba911cc": { // A17
    "128GB": { price: 699, monthly: 49 },
  },
  "d9ebfd0f-0221-4cba-902b-b5c8a9e216c1": { // A16
    "128GB": { price: 849, monthly: 49 },
  },
  "4254f8a1-08bd-46c2-9d99-70ca39e64bd3": { // A06
    "64GB":  { price: 599, monthly: 33 },
    "128GB": { price: 699, monthly: 37 },
  },
  "8e00e89a-353a-46ea-a086-4f3427932cd3": { // A06 dup
    "64GB":  { price: 599, monthly: 33 },
    "128GB": { price: 699, monthly: 37 },
  },
  "4254f8a1-08bd-46c2-9d99-70ca39e64bd4": { // A07 — skipped (no ID match)
  },
  "11154dee-c7ac-4793-9eb5-363777eab354": { // M54
    "256GB": { price: 1519, monthly: 89 },
  },

  // ──── Google Pixel ────
  "2ae692bc-7913-44af-9516-8634479e66f0": { // Pixel 9
    "128GB": { price: 2649, monthly: 119 },
  },
  "4c89a46a-fc14-4577-94f9-38f577594e06": { // Pixel 9 Pro XL
    "256GB": { price: 3899, monthly: 169 },
  },

  // ──── Oppo ────
  "29413f38-e5e5-4953-a9f2-e99ebf91c4ef": { // A76
    "128GB": { price: 1109, monthly: 55 },
  },
  "9290539d-4fed-4b4c-9e2f-284d6fb57c77": { // A94
    "128GB": { price: 1619, monthly: 70 },
  },
  "92580c49-ecc5-48a9-b1b6-97319fc467b4": { // Reno 6
    "128GB": { price: 2069, monthly: 85 },
  },
  "36ef24dc-17de-4d73-902b-44fe787f5b1d": { // Reno 7
    "256GB": { price: 2219, monthly: 85 },
  },

  // ──── Xiaomi ────
  "956230ae-4657-4d9a-90cb-a601beb910d2": { // 15T
    "256GB": { price: 1999, monthly: 109 },
    "512GB": { price: 2349, monthly: 129 },
  },
  "ab2905b9-e6c6-4bf4-a408-6387294b6050": { // 15T dup
    "256GB": { price: 1999, monthly: 109 },
    "512GB": { price: 2349, monthly: 129 },
  },
  "bc837e6a-817e-40dc-b063-cf652e5691f9": { // 15T Pro
    "512GB": { price: 2999, monthly: 149 },
  },
  "497fb054-4df4-4d90-81a5-d67af78e3e77": { // Poco X6 Pro
    "512GB": { price: 1499, monthly: 59 },
  },
  "212ed2e3-dad2-4933-8231-f5e1b3c8c328": { // Poco X7 Pro
    "512GB": { price: 1949, monthly: 99 },
  },
  "41303898-3adf-47f7-99ae-3c6313dbe6d4": { // Redmi 15C
    "128GB": { price: 539, monthly: 49 },
    "256GB": { price: 649, monthly: 59 },
  },
  "470c6c6e-e87b-44d3-b5d0-ee559b1bc863": { // Redmi Note 13
    "256GB": { price: 849, monthly: 37 },
  },
  "9c917698-8c6d-4ff5-a84d-bd91607bfbbf": { // Redmi Note 13 Pro
    "512GB": { price: 1499, monthly: 59 },
  },
  "fb8102e3-cd6a-4e79-9d7a-c442c0026992": { // Redmi Note 14 Pro Plus
    "512GB": { price: 2087, monthly: 109 },
  },
  "e334d2f4-7992-424b-b7a1-55a908705a5d": { // Redmi Note 14 Pro
    "512GB": { price: 1722, monthly: 87 },
  },
  "2f79d9df-787f-40e0-a348-6aae0626dce5": { // POCO F2 Pro
    "256GB": { price: 2529, monthly: 99 },
  },

  // ──── ZTE ────
};

function norm(s) { return (s||"").toUpperCase().replace(/\s/g,""); }
function storageRank(storage) {
  const m = String(storage || "").toUpperCase().replace(/\s/g, "").match(/(\d+)(GB|TB)/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const n = Number(m[1]);
  return m[2] === "TB" ? n * 1024 : n;
}

async function main() {
  console.log("=== FINAL price correction (authoritative VAT list) ===\n");
  let updated = 0, errors = 0;

  for (const [pid, storageMap] of Object.entries(PRODUCT_PRICES)) {
    if (Object.keys(storageMap).length === 0) continue;

    const { data: product, error: e } = await db.from("products").select("*").eq("id", pid).single();
    if (e || !product) { console.log(`SKIP ${pid}: not found`); continue; }

    const name = product.name_en || product.name_ar;
    let variants = [...(product.variants || [])];
    let changed = false;

    // 1) Set authoritative prices from price list
    for (const [storage, { price, monthly }] of Object.entries(storageMap)) {
      const idx = variants.findIndex(v => norm(v.storage) === norm(storage));
      if (idx >= 0) {
        const prevPrice = Number(variants[idx].price || 0);
        const prevMonthly = Number(variants[idx].monthly_price || 0);
        const prevOld = Number(variants[idx].old_price || 0);
        const normalizedOld = prevOld > price ? prevOld : undefined;
        variants[idx] = { ...variants[idx], price, monthly_price: monthly, old_price: normalizedOld };
        if (prevPrice !== price || prevMonthly !== monthly) {
          console.log(`  ${name} ${storage}: ₪${prevPrice} → ₪${price} (×36: ₪${monthly})`);
          changed = true;
        }
      } else {
        variants.push({ storage, price, monthly_price: monthly, old_price: undefined });
        console.log(`  ${name} ${storage}: NEW variant → ₪${price} (×36: ₪${monthly})`);
        changed = true;
      }
    }

    // 2) Normalize all variants (fix reversed old/new and clean invalid discounts)
    variants = variants.map((v) => {
      const p = Number(v.price || 0);
      const o = v.old_price == null ? undefined : Number(v.old_price);
      let fixedOld = o;

      if (fixedOld != null && fixedOld < p) {
        // reversed values entered by mistake
        return { ...v, price: fixedOld, old_price: p };
      }
      if (fixedOld != null && fixedOld === p) {
        fixedOld = undefined;
      }
      return { ...v, old_price: fixedOld };
    });

    // 3) Keep storage options in sync with variants (important for showing 256GB in store)
    variants.sort((a, b) => storageRank(a.storage) - storageRank(b.storage));
    const storageOptions = [...new Set(variants.map((v) => String(v.storage || "").trim()).filter(Boolean))];

    if (storageOptions.join("|") !== (product.storage_options || []).join("|")) {
      changed = true;
    }

    if (!changed) continue;

    const prices = variants.map(v => v.price).filter(p => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : product.price;

    const { error: upErr } = await db.from("products").update({
      variants,
      storage_options: storageOptions,
      old_price: product.old_price && product.old_price > minPrice ? product.old_price : undefined,
      price: minPrice,
      updated_at: new Date().toISOString(),
    }).eq("id", pid);

    if (upErr) {
      console.log(`  ERROR ${name}: ${upErr.message}`);
      errors++;
    } else {
      console.log(`  ✓ ${name}: base → ₪${minPrice}\n`);
      updated++;
    }
  }

  console.log(`\n=== DONE: ${updated} updated, ${errors} errors ===`);
}

main().catch(e => { console.error(e); process.exit(1); });
