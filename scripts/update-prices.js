/**
 * Update product prices from HOT Mobile price list
 * Column used: "שלם כולל מעמ" (Full price including VAT)
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

// Price list data extracted from HOT Mobile price list image
// Format: { productId: { "storage": newPrice } }
const PRICE_UPDATES = {
  // ========== Apple ==========

  // iPhone 17 (id: 52a959a8)
  "52a959a8-5167-4bf4-abb1-797384147219": {
    "256GB": 3798,
    "512GB": 4498,
  },

  // iPhone 17 Air (id: 0cfa619d)
  "0cfa619d-7068-4cf8-96e8-945849a8bb5a": {
    "256GB": 3949,
    "512GB": 4449,
    "1TB": 5849,
  },

  // iPhone 17 Pro (id: 45829250)
  "45829250-2046-4ddd-a346-34611bbb578e": {
    "256GB": 5148,
    "512GB": 5948,
    "1TB": 6998,
  },

  // iPhone 17 Pro Max (id: 966e3231)
  "966e3231-acb9-4163-8d2e-b0f5f72946c6": {
    "256GB": 5598,
    "512GB": 6498,
    "1TB": 7498,
    "2TB": 9198,
  },

  // ========== Samsung Galaxy S Series ==========

  // Samsung Galaxy S26 Ultra (id: 424155b1) - 512GB, 1TB
  "424155b1-0f78-468b-a4d8-01d05573ee05": {
    "512GB": 5869,
    "1TB": 7350,
  },

  // Samsung Galaxy S25 (id: 98a92284) - 128, 256, 512
  "98a92284-81e7-4ccb-9665-00638c2b91a0": {
    "128GB": 2397,
    "256GB": 2997,
    "512GB": 2898,
  },

  // Samsung Galaxy S25+ (id: abc93db3)
  "abc93db3-ebd8-45ca-86e5-ffc8803852ee": {
    "256GB": 3569,
    "512GB": 3999,
  },

  // Samsung Galaxy S25 Ultra (id: 124b39d9)
  "124b39d9-1800-4dab-8ec7-44690fa1698f": {
    "256GB": 4698,
    "512GB": 4998,
    "1TB": 5998,
  },

  // Samsung Galaxy S25 Edge (id: 8e3de1fb)
  "8e3de1fb-1078-4b0a-81e6-a122088b21e0": {
    "256GB": 3399,
    "512GB": 3799,
  },

  // Samsung Galaxy S25 FE (id: dba567d0)
  "dba567d0-67f5-4d3b-9a5d-eec4d05d3dcc": {
    "128GB": 1945,
    "256GB": 2240,
    "512GB": 2590,
  },

  // Samsung Galaxy S24 Ultra (id: b24c8fe4)
  "b24c8fe4-bb30-4fc6-bab4-2bd275e6521c": {
    "256GB": 3829,
    "512GB": 4319,
    "1TB": 5199,
  },

  // Samsung Galaxy S24 Ultra (id: 32e94455)
  "32e94455-9769-474c-9642-13ec165cc58c": {
    "256GB": 3504,
    "512GB": 3829,
    "1TB": 4619,
  },

  // Samsung Galaxy S24+ (id: a1505323)
  "a1505323-d442-4a6d-a873-db0480a79cb2": {
    "256GB": 2970,
    "512GB": 3399,
  },

  // Samsung Galaxy S24 FE (id: 4960bfb4)
  "4960bfb4-e86a-4845-af88-270ed9b8a101": {
    "128GB": 1750,
    "256GB": 2099,
    "512GB": 2450,
  },

  // ========== Samsung Galaxy Z Series ==========

  // Samsung Galaxy Z Flip7 (id: fa175e73)
  "fa175e73-82b7-4789-a867-f64245710f9e": {
    "256GB": 4431,
    "512GB": 4831,
  },

  // Samsung Galaxy Z Fold7 (id: 5edc6689)
  "5edc6689-0940-4ec7-9fd7-b08c6164f8f9": {
    "256GB": 7751,
    "512GB": 8351,
    "1TB": 9351,
  },

  // Samsung Galaxy Z Flip6 (id: 1722ba00)
  "1722ba00-20d4-4ba9-a133-34560f6da241": {
    "256GB": 2695,
    "512GB": 3195,
  },

  // ========== Samsung Galaxy A Series ==========

  // Samsung Galaxy A72 (id: b4fc449a)
  "b4fc449a-f772-48c4-a5b0-451282cd4ed1": {
    "128GB": 1698,
    "256GB": 1969,
  },

  // Samsung Galaxy A56 (id: ac201f2f)
  "ac201f2f-dee1-421f-aba5-0fdc46e5a7ec": {
    "128GB": 1533,
    "256GB": 1769,
  },

  // Samsung Galaxy A56 (id: ca2c19e5) - second entry
  "ca2c19e5-05b7-4296-a3f4-7ce90f0c7ebe": {
    "128GB": 1533,
    "256GB": 1769,
  },

  // Samsung Galaxy A55 (id: 647d3d1b)
  "647d3d1b-0901-479a-aaba-0e6205a26886": {
    "128GB": 1369,
    "256GB": 1569,
  },

  // Samsung Galaxy A55 (id: cd36dff8)
  "cd36dff8-9d60-4eb8-a47d-63ceb56fd303": {
    "128GB": 1369,
    "256GB": 1569,
  },

  // Samsung Galaxy A54 (id: 21d6e78b)
  "21d6e78b-83b9-46e4-81d3-faeedb2b29fb": {
    "128GB": 1414,
    "256GB": 1760,
  },

  // Samsung Galaxy A36 (id: c5da21af)
  "c5da21af-1ce2-4bd5-8fa8-f1c3eae0ce12": {
    "128GB": 1139,
    "256GB": 1339,
  },

  // Samsung Galaxy A26 (id: 042fe66a)
  "042fe66a-7cb1-4b1f-b365-444267ee3c9a": {
    "128GB": 938,
    "256GB": 1150,
  },

  // Samsung Galaxy A25 (id: fe98364d)
  "fe98364d-6170-4a44-9d21-07efbcb511ba": {
    "128GB": 849,
    "256GB": 989,
  },

  // Samsung Galaxy A17 (id: 402f7329)
  "402f7329-b59a-4078-bf97-ff312ba911cc": {
    "128GB": 659,
    "256GB": 799,
  },

  // Samsung Galaxy A16 (id: d9ebfd0f)
  "d9ebfd0f-0221-4cba-902b-b5c8a9e216c1": {
    "128GB": 719,
    "256GB": 849,
  },

  // Samsung Galaxy A06 64GB (id: 4254f8a1)
  "4254f8a1-08bd-46c2-9d99-70ca39e64bd3": {
    "64GB": 507,
    "128GB": 599,
  },

  // Samsung Galaxy A06 (id: 8e00e89a)
  "8e00e89a-353a-46ea-a086-4f3427932cd3": {
    "64GB": 507,
    "128GB": 599,
  },

  // Samsung Galaxy A07 (Samsung AOT models seem to be in the image too)

  // ========== Google ==========

  // Google Pixel 9 (id: 2ae692bc)
  "2ae692bc-7913-44af-9516-8634479e66f0": {
    "128GB": 3135,
    "256GB": 3499,
  },

  // Google Pixel 9 Pro XL (id: 4c89a46a)
  "4c89a46a-fc14-4577-94f9-38f577594e06": {
    "128GB": 4264,
    "256GB": 4699,
    "512GB": 5199,
    "1TB": 5699,
  },

  // ========== Oppo ==========

  // Oppo A76 (id: 29413f38)
  "29413f38-e5e5-4953-a9f2-e99ebf91c4ef": {
    "128GB": 1049,
  },

  // Oppo Reno 6 (id: 92580c49)
  "92580c49-ecc5-48a9-b1b6-97319fc467b4": {
    "128GB": 1753,
    "256GB": 2069,
  },

  // Oppo Reno 7 (id: 36ef24dc)
  "36ef24dc-17de-4d73-902b-44fe787f5b1d": {
    "128GB": 1889,
    "256GB": 2199,
  },

  // ========== Xiaomi ==========

  // Xiaomi 15T SG 12-256GB (id: bc837e6a)
  "bc837e6a-817e-40dc-b063-cf652e5691f9": {
    "256GB": 1894,
    "512GB": 2348,
    "1TB": 2799,
  },

  // Xiaomi 15T (id: 956230ae)
  "956230ae-4657-4d9a-90cb-a601beb910d2": {
    "256GB": 1894,
    "512GB": 2348,
  },

  // Xiaomi 15T (id: ab2905b9) - second entry
  "ab2905b9-e6c6-4bf4-a408-6387294b6050": {
    "256GB": 1894,
    "512GB": 2348,
  },

  // Xiaomi Redmi Note 14 Pro (id: fb8102e3)
  "fb8102e3-cd6a-4e79-9d7a-c442c0026992": {
    "128GB": 1459,
    "256GB": 1721,
  },

  // Xiaomi Redmi Note 14 Pro (id: e334d2f4)
  "e334d2f4-7992-424b-b7a1-55a908705a5d": {
    "128GB": 1459,
    "256GB": 1721,
  },

  // Xiaomi POCO X7 Pro (id: 212ed2e3)
  "212ed2e3-dad2-4933-8231-f5e1b3c8c328": {
    "128GB": 1651,
    "256GB": 2143,
  },

  // Xiaomi Redmi Note 13 (id: 470c6c6e)
  "470c6c6e-e87b-44d3-b5d0-ee559b1bc863": {
    "128GB": 553,
    "256GB": 699,
  },

  // Xiaomi Redmi Note 13 Pro (id: 9c917698)
  "9c917698-8c6d-4ff5-a84d-bd91607bfbbf": {
    "128GB": 1349,
    "256GB": 1549,
    "512GB": 2990,
  },
};

async function main() {
  console.log("=== Updating product prices from HOT Mobile price list ===\n");

  const productIds = Object.keys(PRICE_UPDATES);
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const productId of productIds) {
    const newPrices = PRICE_UPDATES[productId];

    const { data: product, error: fetchErr } = await db
      .from("products")
      .select("id, brand, name_ar, name_en, price, old_price, variants, storage_options")
      .eq("id", productId)
      .single();

    if (fetchErr || !product) {
      console.log(`SKIP: ${productId} - not found`);
      skipped++;
      continue;
    }

    const name = product.name_en || product.name_ar;
    const variants = [...(product.variants || [])];
    let changed = false;

    for (const [storage, newPrice] of Object.entries(newPrices)) {
      const idx = variants.findIndex(
        (v) => v.storage?.toUpperCase().replace(/\s/g, "") === storage.toUpperCase().replace(/\s/g, "")
      );

      if (idx >= 0) {
        const oldP = variants[idx].price;
        if (oldP !== newPrice) {
          variants[idx] = {
            ...variants[idx],
            old_price: oldP,
            price: newPrice,
            monthly_price: Math.round(newPrice / 36),
          };
          console.log(`  ${name} ${storage}: ₪${oldP} → ₪${newPrice}`);
          changed = true;
        }
      } else {
        variants.push({
          storage,
          price: newPrice,
          monthly_price: Math.round(newPrice / 36),
        });
        console.log(`  ${name} ${storage}: NEW → ₪${newPrice}`);
        changed = true;
      }
    }

    if (!changed) {
      skipped++;
      continue;
    }

    const prices = variants.map((v) => v.price).filter((p) => p > 0);
    const minPrice = prices.length > 0 ? Math.min(...prices) : product.price;

    const { error: updateErr } = await db
      .from("products")
      .update({
        variants,
        old_price: product.price,
        price: minPrice,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId);

    if (updateErr) {
      console.log(`ERROR: ${name} - ${updateErr.message}`);
      errors++;
    } else {
      console.log(`✓ ${name}: base price ₪${product.price} → ₪${minPrice}`);
      updated++;
    }
  }

  console.log(`\n=== DONE: ${updated} updated, ${skipped} skipped, ${errors} errors ===`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
