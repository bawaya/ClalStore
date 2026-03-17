/**
 * Update product prices from HOT Mobile price list (price_list_vat18.js)
 * Uses price_1_18_vat_18 as retail price and monthly_36_vat_18 as monthly installment
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

const priceList = [
  { model: "iPhone 17 256GB", price: 3798, monthly: 169 },
  { model: "iPhone 17 512GB", price: 4698, monthly: 192 },
  { model: "iPhone 17 Air 256GB", price: 3949, monthly: 170 },
  { model: "iPhone 17 Air 512GB", price: 4949, monthly: 199 },
  { model: "iPhone 17 Air 1TB", price: 5849, monthly: 219 },
  { model: "iPhone 17 Pro 256GB", price: 5148, monthly: 207 },
  { model: "iPhone 17 Pro 512GB", price: 6048, monthly: 225 },
  { model: "iPhone 17 Pro 1TB", price: 6998, monthly: 250 },
  { model: "iPhone 17 Pro Max 256GB", price: 5598, monthly: 219 },
  { model: "iPhone 17 Pro Max 512GB", price: 6498, monthly: 239 },
  { model: "iPhone 17 Pro Max 1TB", price: 7398, monthly: 269 },
  { model: "iPhone 17 Pro Max 2TB", price: 9198, monthly: 315 },
  { model: "Samsung Galaxy S26 12-256GB", price: 3199, monthly: 155 },
  { model: "Samsung Galaxy S26 12-512GB", price: 3849, monthly: 172 },
  { model: "Samsung Galaxy S26 Plus 12-256GB", price: 3749, monthly: 169 },
  { model: "Samsung Galaxy S26 Plus 12-512GB", price: 4445, monthly: 185 },
  { model: "Samsung Galaxy S26 Ultra 12-256GB", price: 4519, monthly: 189 },
  { model: "Samsung Galaxy S26 Ultra 12-512GB", price: 5199, monthly: 215 },
  { model: "Samsung Galaxy S26 Ultra 16-1TB", price: 6199, monthly: 239 },
  { model: "Samsung Galaxy S25 12-128GB", price: 2829, monthly: 129 },
  { model: "Samsung Galaxy S25 12-256GB", price: 2949, monthly: 139 },
  { model: "Samsung Galaxy S25 Plus 12-256GB", price: 3398, monthly: 149 },
  { model: "Samsung Galaxy S25 Plus 12-512GB", price: 3799, monthly: 159 },
  { model: "Samsung Galaxy S25 Ultra 12-256GB", price: 4049, monthly: 169 },
  { model: "Samsung Galaxy S25 Ultra 12-512GB", price: 4390, monthly: 179 },
  { model: "Samsung Galaxy S25 Ultra 12-1TB", price: 5599, monthly: 209 },
  { model: "Samsung Galaxy S25 Edge 12-256GB", price: 2399, monthly: 109 },
  { model: "Samsung Galaxy S25 Edge 12-512GB", price: 2999, monthly: 129 },
  { model: "Samsung Galaxy S25 FE 8GB-128GB", price: 2248, monthly: 115 },
  { model: "Samsung Galaxy S25 FE 8GB-256GB", price: 2598, monthly: 123 },
  { model: "Samsung Galaxy S24 Ultra 12-512GB", price: 4899, monthly: 169 },
  { model: "Samsung Galaxy S24 Ultra 12-256GB", price: 4519, monthly: 169 },
  { model: "Samsung Galaxy S24 Plus 12-512GB", price: 3899, monthly: 139 },
  { model: "Samsung Galaxy S24 Plus 12-256GB", price: 3599, monthly: 129 },
  { model: "Samsung Galaxy S24 FE 8GB-256GB", price: 2450, monthly: 115 },
  { model: "Samsung Galaxy S24 FE 8GB-128GB", price: 2299, monthly: 103 },
  { model: "Samsung Galaxy S24 8-256GB", price: 3099, monthly: 119 },
  { model: "Samsung Galaxy S24 8-128GB", price: 3049, monthly: 99 },
  { model: "Samsung Galaxy Z Flip7 12-256GB", price: 4049, monthly: 169 },
  { model: "Samsung Galaxy Z Flip7 12-512GB", price: 4549, monthly: 189 },
  { model: "Samsung Galaxy Z Flip6 12GB-512GB", price: 4639, monthly: 179 },
  { model: "Samsung Galaxy Z Flip6 12GB-256GB", price: 3929, monthly: 139 },
  { model: "Samsung Galaxy Z Fold7 12-256GB", price: 7335, monthly: 259 },
  { model: "Samsung Galaxy Z Fold7 12-512GB", price: 7949, monthly: 279 },
  { model: "Samsung Galaxy Z Fold6 12GB-512GB", price: 7359, monthly: 249 },
  { model: "Samsung Galaxy Z Fold6 12GB-256GB", price: 6799, monthly: 229 },
  { model: "Samsung Galaxy Z Fold5 12GB-256GB", price: 5949, monthly: 199 },
  { model: "Samsung Galaxy Z Fold4 12GB-256GB", price: 4539, monthly: 159 },
  { model: "Samsung Galaxy A73 5G 8-128GB", price: 1969, monthly: 89 },
  { model: "Samsung Galaxy A72 8+128GB", price: 1809, monthly: 75 },
  { model: "Samsung Galaxy A56 8-128GB 5G", price: 1569, monthly: 85 },
  { model: "Samsung Galaxy A56 8-256GB 5G", price: 1799, monthly: 89 },
  { model: "Samsung Galaxy A55 8-128GB", price: 1869, monthly: 93 },
  { model: "Samsung Galaxy A55 5G 8-256GB", price: 1899, monthly: 99 },
  { model: "Samsung Galaxy A54 8-128GB", price: 1769, monthly: 95 },
  { model: "Samsung Galaxy A53 5G 8-128GB", price: 1669, monthly: 69 },
  { model: "Samsung Galaxy A36 6-128GB 5G", price: 1249, monthly: 79 },
  { model: "Samsung Galaxy A34 6-128GB", price: 1309, monthly: 69 },
  { model: "Samsung Galaxy A26 6-128GB 5G", price: 1099, monthly: 64 },
  { model: "Samsung Galaxy A25 6-128GB", price: 1109, monthly: 65 },
  { model: "Samsung Galaxy A17 4-128GB", price: 699, monthly: 49 },
  { model: "Samsung Galaxy A16 4-128GB", price: 849, monthly: 49 },
  { model: "Samsung Galaxy A14 4-64GB", price: 709, monthly: 49 },
  { model: "Samsung Galaxy A07 4-64GB", price: 449, monthly: 29 },
  { model: "Samsung Galaxy A07 4-128GB", price: 499, monthly: 32 },
  { model: "Samsung Galaxy A06 4-64GB", price: 599, monthly: 33 },
  { model: "Samsung Galaxy A06 4-128GB", price: 699, monthly: 37 },
  { model: "Samsung Galaxy M54 8-256GB", price: 1519, monthly: 89 },
  { model: "Oppo A76 6-128GB", price: 1109, monthly: 55 },
  { model: "Oppo A94 5G 8-128GB", price: 1619, monthly: 70 },
  { model: "Oppo Reno 6 5G 8-128GB", price: 2069, monthly: 85 },
  { model: "Oppo Reno 7 8-256GB 5G", price: 2219, monthly: 85 },
  { model: "Oppo Reno 7z 8-128GB 5G", price: 1819, monthly: 75 },
  { model: "Google Pixel 9 12-128GB", price: 2649, monthly: 119 },
  { model: "Google Pixel 9 Pro XL 16-256GB", price: 3899, monthly: 169 },
  { model: "XIAOMI 15T 5G 12-256GB", price: 1999, monthly: 109 },
  { model: "XIAOMI 15T 5G 12-512GB", price: 2349, monthly: 129 },
  { model: "XIAOMI 15T PRO 5G 12-512GB", price: 2999, monthly: 149 },
  { model: "Xiaomi Poco X6 Pro 5G 12-512GB", price: 1499, monthly: 59 },
  { model: "XIAOMI Redmi 15C NFC 4-128GB", price: 539, monthly: 49 },
  { model: "XIAOMI Redmi 15C NFC 8-256GB", price: 649, monthly: 59 },
  { model: "Xiaomi Redmi Note 14 pro Plus 5G 12-512GB", price: 2087, monthly: 109 },
  { model: "Xiaomi Redmi Note 13 4G 8-256GB", price: 849, monthly: 37 },
  { model: "Xiaomi Redmi note 13 Pro 5G 12-512GB", price: 1499, monthly: 59 },
  { model: "Xiaomi POCO F2 Pro 8-256GB 5G", price: 2529, monthly: 99 },
  { model: "Xiaomi Poco X7 Pro 5G 12-512GB", price: 1949, monthly: 99 },
  { model: "Xiaomi Redmi Note 14 pro 5G 12-512GB", price: 1722, monthly: 87 },
  { model: "ZTE F100 kosher phone", price: 299, monthly: 13 },
];

function extractStorage(model) {
  const m = model.match(/(\d+)\s*(GB|TB)/i);
  if (!m) return null;
  // Get the LAST storage match (the actual storage, not RAM)
  const matches = [...model.matchAll(/(\d+)\s*(GB|TB)/gi)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  return last[1] + last[2].toUpperCase();
}

function extractModel(model) {
  return model
    .replace(/\d+\s*(GB|TB)/gi, "")
    .replace(/\d+-/g, "")
    .replace(/5G/gi, "")
    .replace(/NFC/gi, "")
    .replace(/\+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .replace(/samsung\s+galaxy\s+/i, "")
    .replace(/samsung\s+/i, "")
    .replace(/جالكسي\s*/g, "")
    .replace(/آيفون|ايفون/g, "iphone")
    .replace(/\s*5g\s*/gi, " ")
    .replace(/i\s+phone/gi, "iphone")
    .replace(/\s+/g, " ")
    .trim();
}

function storageNorm(s) {
  return (s || "").toUpperCase().replace(/\s/g, "");
}

async function main() {
  console.log("=== Updating prices from price_list_vat18.js ===\n");

  const { data: products, error } = await db
    .from("products")
    .select("*")
    .eq("type", "device");

  if (error) {
    console.error("DB error:", error.message);
    return;
  }

  console.log(`Found ${products.length} products in DB\n`);

  let totalUpdated = 0;
  let totalSkipped = 0;

  // Group price list by base model
  const priceByModelStorage = new Map();
  for (const item of priceList) {
    const storage = extractStorage(item.model);
    const baseModel = extractModel(item.model);
    const key = normalize(baseModel) + "|" + storageNorm(storage || "");
    priceByModelStorage.set(key, item);
  }

  // For each DB product, try to match price list entries
  for (const product of products) {
    const pName = normalize(product.name_en || product.name_ar || "");
    const variants = [...(product.variants || [])];
    let changed = false;

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const stNorm = storageNorm(v.storage || "");
      const key = pName + "|" + stNorm;

      let match = priceByModelStorage.get(key);

      // Fuzzy match: try without exact key
      if (!match) {
        for (const [k, item] of priceByModelStorage) {
          const [kModel, kStorage] = k.split("|");
          if (kStorage !== stNorm) continue;
          // Check if model names overlap significantly
          if (
            pName.includes(kModel) ||
            kModel.includes(pName) ||
            levenshteinSimilar(pName, kModel, 0.6)
          ) {
            match = item;
            break;
          }
        }
      }

      if (match) {
        const newPrice = Math.round(match.price);
        const newMonthly = Math.round(match.monthly);
        const oldPrice = v.price;

        if (oldPrice !== newPrice || v.monthly_price !== newMonthly) {
          variants[i] = {
            ...v,
            old_price: oldPrice,
            price: newPrice,
            monthly_price: newMonthly,
          };
          console.log(
            `  ${product.name_en || product.name_ar} ${v.storage}: ₪${oldPrice} → ₪${newPrice} (×36: ₪${newMonthly})`
          );
          changed = true;
        }
      }
    }

    if (!changed) {
      totalSkipped++;
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
      .eq("id", product.id);

    if (updateErr) {
      console.log(`  ERROR ${product.name_en || product.name_ar}: ${updateErr.message}`);
    } else {
      console.log(`  ✓ ${product.name_en || product.name_ar}: base ₪${product.price} → ₪${minPrice}\n`);
      totalUpdated++;
    }
  }

  console.log(`\n=== DONE: ${totalUpdated} updated, ${totalSkipped} unchanged ===`);
}

function levenshteinSimilar(a, b, threshold) {
  if (!a || !b) return false;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return true;

  const costs = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastVal = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newVal = costs[j - 1];
        if (longer[i - 1] !== shorter[j - 1]) {
          newVal = Math.min(Math.min(newVal, lastVal), costs[j]) + 1;
        }
        costs[j - 1] = lastVal;
        lastVal = newVal;
      }
    }
    if (i > 0) costs[shorter.length] = lastVal;
  }
  return (longer.length - costs[shorter.length]) / longer.length >= threshold;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
