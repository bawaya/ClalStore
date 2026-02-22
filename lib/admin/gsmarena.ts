// =====================================================
// ClalMobile — GSMArena Product Data Scraper
// Fetches accurate specs, colors, images from gsmarena.com
// Used by admin auto-fill feature
// =====================================================

const BASE = "https://www.gsmarena.com";
const HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// ===== Comprehensive color mapping =====
const COLORS: Record<string, { hex: string; ar: string; he: string }> = {
  // Basic
  "black": { hex: "#1a1a2e", ar: "أسود", he: "שחור" },
  "white": { hex: "#f5f5f5", ar: "أبيض", he: "לבן" },
  "silver": { hex: "#c0c0c0", ar: "فضي", he: "כסף" },
  "gold": { hex: "#d4af37", ar: "ذهبي", he: "זהב" },
  "gray": { hex: "#808080", ar: "رمادي", he: "אפור" },
  "grey": { hex: "#808080", ar: "رمادي", he: "אפור" },
  // Blues
  "blue": { hex: "#4a6fa5", ar: "أزرق", he: "כחול" },
  "navy": { hex: "#1a3a5a", ar: "أزرق بحري", he: "כחול כהה" },
  "navy blue": { hex: "#1a3a5a", ar: "أزرق بحري", he: "כחול כהה" },
  "deep blue": { hex: "#1a3a6a", ar: "أزرق غامق", he: "כחול עמוק" },
  "light blue": { hex: "#87ceeb", ar: "أزرق فاتح", he: "כחול בהיר" },
  "icy blue": { hex: "#a0d2e7", ar: "أزرق جليدي", he: "כחול קרחי" },
  "mist blue": { hex: "#7eb0c9", ar: "أزرق ضبابي", he: "כחול ערפילי" },
  "sky blue": { hex: "#87ceeb", ar: "أزرق سماوي", he: "תכלת" },
  "ultramarine": { hex: "#3f00ff", ar: "أزرق فائق", he: "כחול אולטרה" },
  "teal": { hex: "#008080", ar: "أزرق مخضر", he: "טורקיז" },
  // Reds / Pinks
  "red": { hex: "#c41040", ar: "أحمر", he: "אדום" },
  "pink": { hex: "#d8a0c8", ar: "وردي", he: "ורוד" },
  "rose": { hex: "#ff007f", ar: "وردي", he: "ורוד" },
  "rose gold": { hex: "#b76e79", ar: "ذهبي وردي", he: "זהב ורוד" },
  "coral": { hex: "#ff7f50", ar: "مرجاني", he: "אלמוג" },
  "cosmic orange": { hex: "#d4722a", ar: "برتقالي كوني", he: "כתום קוסמי" },
  "burgundy": { hex: "#722f37", ar: "عنابي", he: "בורגנדי" },
  // Greens
  "green": { hex: "#5a9a7a", ar: "أخضر", he: "ירוק" },
  "mint": { hex: "#98fb98", ar: "نعناعي", he: "מנטה" },
  "olive": { hex: "#808000", ar: "زيتوني", he: "זית" },
  "sage": { hex: "#b2ac88", ar: "أخضر مريمي", he: "ירוק מרווה" },
  "jade green": { hex: "#00a86b", ar: "أخضر يشمي", he: "ירוק ירקן" },
  // Purples
  "purple": { hex: "#7b5ea7", ar: "بنفسجي", he: "סגול" },
  "lavender": { hex: "#e0e0ff", ar: "لافندر", he: "לבנדר" },
  "violet": { hex: "#8b00ff", ar: "بنفسجي", he: "סגול" },
  "lilac": { hex: "#c8a2c8", ar: "أرجواني فاتح", he: "לילך" },
  // Oranges / Yellows
  "orange": { hex: "#e67e22", ar: "برتقالي", he: "כתום" },
  "yellow": { hex: "#f0e68c", ar: "أصفر", he: "צהוב" },
  "amber": { hex: "#ffbf00", ar: "عنبري", he: "ענבר" },
  "peach": { hex: "#ffcba4", ar: "خوخي", he: "אפרסק" },
  // Browns / Earthy
  "brown": { hex: "#8b4513", ar: "بني", he: "חום" },
  "bronze": { hex: "#cd7f32", ar: "برونزي", he: "ברונזה" },
  "beige": { hex: "#f5f0e0", ar: "بيج", he: "בז'" },
  "sand": { hex: "#d0c0a0", ar: "رملي", he: "חולי" },
  "cream": { hex: "#fffdd0", ar: "كريمي", he: "קרם" },
  "mocha": { hex: "#967969", ar: "موكا", he: "מוקה" },
  // Titanium variants
  "titanium": { hex: "#8a8a8a", ar: "تيتانيوم", he: "טיטניום" },
  "natural titanium": { hex: "#c0b8a8", ar: "تيتانيوم طبيعي", he: "טיטניום טבעי" },
  "black titanium": { hex: "#2d2d2d", ar: "تيتانيوم أسود", he: "טיטניום שחור" },
  "white titanium": { hex: "#e8e8e8", ar: "تيتانيوم أبيض", he: "טיטניום לבן" },
  "desert titanium": { hex: "#c4a57b", ar: "تيتانيوم صحراوي", he: "טיטניום מדברי" },
  "blue titanium": { hex: "#4a6a8a", ar: "تيتانيوم أزرق", he: "טיטניום כחול" },
  "titanium silver blue": { hex: "#a8b8c8", ar: "تيتانيوم فضي أزرق", he: "טיטניום כסוף כחול" },
  "titanium black": { hex: "#2d2d2d", ar: "تيتانيوم أسود", he: "טיטניום שחור" },
  "titanium white silver": { hex: "#e0e0e5", ar: "تيتانيوم أبيض فضي", he: "טיטניום לבן כסוף" },
  "titanium gray": { hex: "#7a7a7a", ar: "تيتانيوم رمادي", he: "טיטניום אפור" },
  "titanium grey": { hex: "#7a7a7a", ar: "تيتانيوم رمادي", he: "טיטניום אפור" },
  "titanium jade green": { hex: "#5a9a7a", ar: "تيتانيوم أخضر يشمي", he: "טיטניום ירוק ירקן" },
  "titanium jet black": { hex: "#0a0a0a", ar: "تيتانيوم أسود لامع", he: "טיטניום שחור מבריק" },
  "titanium pink gold": { hex: "#b76e79", ar: "تيتانيوم ذهبي وردي", he: "טיטניום זהב ורוד" },
  // Apple special
  "midnight": { hex: "#191970", ar: "منتصف الليل", he: "חצות" },
  "starlight": { hex: "#f0e8d8", ar: "أبيض نجمي", he: "אור כוכבים" },
  "space gray": { hex: "#4a4a4a", ar: "رمادي فلكي", he: "אפור חלל" },
  "space black": { hex: "#1a1a1a", ar: "أسود فلكي", he: "שחור חלל" },
  "cloud white": { hex: "#f0f0f0", ar: "أبيض سحابي", he: "לבן ענן" },
  "light gold": { hex: "#d4c48a", ar: "ذهبي فاتح", he: "זהב בהיר" },
  "alpine green": { hex: "#3a6b35", ar: "أخضر ألبي", he: "ירוק אלפיני" },
  "deep purple": { hex: "#5c3a6e", ar: "بنفسجي غامق", he: "סגול עמוק" },
  "sierra blue": { hex: "#69abce", ar: "أزرق سييرا", he: "כחול סיירה" },
  "pacific blue": { hex: "#2d5e8a", ar: "أزرق باسيفيكي", he: "כחול פסיפי" },
  // Samsung special
  "phantom black": { hex: "#1a1a1a", ar: "أسود فانتوم", he: "שחור פנטום" },
  "phantom white": { hex: "#f5f5f0", ar: "أبيض فانتوم", he: "לבן פנטום" },
  "graphite": { hex: "#4a4a4a", ar: "جرافيت", he: "גרפיט" },
  "mystic bronze": { hex: "#c49558", ar: "برونزي أسطوري", he: "ברונזה מיסטית" },
  "arctic blue": { hex: "#7eb8d8", ar: "أزرق قطبي", he: "כחול ארקטי" },
  "ice blue": { hex: "#a0d2e7", ar: "أزرق جليدي", he: "כחול קרחי" },
  // Xiaomi special
  "glacier blue": { hex: "#7eb8d8", ar: "أزرق جليدي", he: "כחול קרחוני" },
  "obsidian black": { hex: "#0a0a0a", ar: "أسود سبج", he: "שחור אובסידיאן" },
};

/**
 * Match a color string to hex + bilingual names
 */
function matchColor(colorStr: string): { hex: string; name_ar: string; name_he: string } {
  const lower = colorStr.toLowerCase().trim();

  // Exact match
  if (COLORS[lower]) {
    return { hex: COLORS[lower].hex, name_ar: COLORS[lower].ar, name_he: COLORS[lower].he };
  }

  // Try partial match — longest match wins
  let bestMatch: { key: string; len: number } | null = null;
  for (const key of Object.keys(COLORS)) {
    if (lower.includes(key) && (!bestMatch || key.length > bestMatch.len)) {
      bestMatch = { key, len: key.length };
    }
  }
  if (bestMatch) {
    const c = COLORS[bestMatch.key];
    // Use the original name but mapped hex
    return { hex: c.hex, name_ar: c.ar, name_he: c.he };
  }

  // Fallback — use original name
  return { hex: "#808080", name_ar: colorStr.trim(), name_he: colorStr.trim() };
}

/**
 * Strip HTML tags from a string
 */
function stripHTML(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").trim();
}

// ===== Exported types =====
export interface AutoFillResult {
  phone_name: string;
  description_ar: string;
  description_he: string;
  specs: Record<string, string>;
  colors: Array<{ hex: string; name_ar: string; name_he: string }>;
  storage_options: string[];
  image_url: string;
  gallery: string[];
}

/**
 * Search GSMArena for a phone and return the product page URL
 * Uses smart matching to pick the best result (exact name match preferred)
 */
async function searchGSMArena(name: string, brand: string): Promise<string | null> {
  const query = encodeURIComponent(`${brand} ${name}`);
  const url = `${BASE}/results.php3?sQuickSearch=yes&sName=${query}`;

  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return null;

  const html = await res.text();

  // Find all result links inside <div class="makers">
  const makersMatch = html.match(/<div class="makers">([\s\S]*?)<\/div>/);
  if (!makersMatch) return null;

  const linkMatches = [...makersMatch[1].matchAll(/href="([^"]+\.php)"/g)];
  if (linkMatches.length === 0) return null;

  // Smart match: prefer URL slug that best matches the query
  const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const targetSlug = slugify(`${brand} ${name}`);

  let bestLink = linkMatches[0][1];
  let bestScore = 0;

  for (const lm of linkMatches) {
    const href = lm[1];
    const slug = href.replace(/-\d+\.php$/, "").replace(/_/g, " ").toLowerCase();

    // Score based on keyword overlap
    let score = 0;
    const nameWords = name.toLowerCase().split(/\s+/);
    for (const w of nameWords) {
      if (slug.includes(w.toLowerCase())) score += 10;
    }
    if (slug.includes(brand.toLowerCase())) score += 5;

    // Penalty for extra words in slug that aren't in query (e.g., "max" when searching "pro")
    const slugWords = slug.split(/[\s_-]+/);
    const queryWords = `${brand} ${name}`.toLowerCase().split(/\s+/);
    for (const sw of slugWords) {
      if (sw.length > 2 && !queryWords.some(qw => qw.includes(sw) || sw.includes(qw))) {
        score -= 3;
      }
    }

    // Bonus for exact-ish length match
    if (Math.abs(slug.length - targetSlug.length) < 5) score += 3;

    if (score > bestScore) {
      bestScore = score;
      bestLink = href;
    }
  }

  return `${BASE}/${bestLink}`;
}

/**
 * Scrape a GSMArena product page for specs, colors, images
 */
async function scrapeProductPage(url: string): Promise<AutoFillResult | null> {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return null;

  const html = await res.text();

  // ── Phone name ──
  const nameMatch = html.match(/<h1[^>]*class="specs-phone-name-title"[^>]*>([^<]+)/);
  const phone_name = nameMatch ? nameMatch[1].trim() : "";

  // ── Specs via data-spec attributes ──
  const specs: Record<string, string> = {};

  const specMap: Record<string, string> = {
    displaysize: "screen",
    displaytype: "screen_type",
    camerapixels: "camera",
    batsize: "battery",
    chipset: "cpu",
    internalmemory: "memory",
    weight: "weight",
    os: "os",
  };

  for (const [dataSpec, key] of Object.entries(specMap)) {
    const m = html.match(new RegExp(`data-spec="${dataSpec}"[^>]*>([^<]+)`));
    if (m) {
      specs[key] = stripHTML(m[1]);
    }
  }

  // Merge display size + type into screen
  if (specs.screen && specs.screen_type) {
    specs.screen = `${specs.screen} ${specs.screen_type}`;
    delete specs.screen_type;
  } else if (specs.screen_type) {
    specs.screen = specs.screen_type;
    delete specs.screen_type;
  }

  // Extract RAM from memory field
  if (specs.memory) {
    const ramMatch = specs.memory.match(/(\d+)\s*GB\s*RAM/i);
    if (ramMatch) specs.ram = `${ramMatch[1]}GB`;
    delete specs.memory;
  }

  // ── Storage options ──
  const storage_options: string[] = [];
  const memSpec = html.match(/data-spec="internalmemory"[^>]*>([^<]+)/);
  if (memSpec) {
    const memText = memSpec[1];
    // Parse patterns: "128GB 6GB RAM, 256GB 8GB RAM, 512GB 8GB RAM"
    const storageMatches = memText.match(/(\d+(?:GB|TB))\s+\d+\s*GB\s*RAM/gi);
    if (storageMatches) {
      const seen = new Set<string>();
      for (const sm of storageMatches) {
        const s = sm.match(/(\d+(?:GB|TB))/i);
        if (s && !seen.has(s[1].toUpperCase())) {
          seen.add(s[1].toUpperCase());
          storage_options.push(s[1].toUpperCase());
        }
      }
    }
  }

  // ── Colors ──
  const colorsSpec = html.match(/data-spec="colors"[^>]*>([^<]+)/);
  let colors: Array<{ hex: string; name_ar: string; name_he: string }> = [];
  if (colorsSpec) {
    const colorNames = colorsSpec[1].split(/,\s*/);
    colors = colorNames.map((c) => matchColor(c));
  }

  // ── Main image (bigpic URL) ──
  let image_url = "";
  const bigpicMatch = html.match(/(https?:\/\/fdn2?\.gsmarena\.com\/vv\/bigpic\/[^"'\s>]+\.(?:jpg|png|webp))/);
  if (bigpicMatch) {
    image_url = bigpicMatch[1];
  }

  // ── Gallery link & images ──
  let gallery: string[] = [];
  const galleryLinkMatch = html.match(/href=([^\s>"]+pictures[^\s>"]+\.php)/);
  if (galleryLinkMatch) {
    const galleryUrl = `${BASE}/${galleryLinkMatch[1].replace(/^"/, "")}`;
    try {
      const galleryRes = await fetch(galleryUrl, { headers: HEADERS });
      if (galleryRes.ok) {
        const galleryHtml = await galleryRes.text();
        // Extract official product images (pics/ URLs, not reviews)
        const picMatches = galleryHtml.matchAll(/(https?:\/\/fdn2?\.gsmarena\.com\/vv\/pics\/[^"'\s>]+\.(?:jpg|png|webp))/g);
        for (const pm of picMatches) {
          if (!gallery.includes(pm[1])) gallery.push(pm[1]);
        }
      }
    } catch {
      // Gallery fetch failed, continue without
    }
  }

  // ── Generate bilingual description ──
  const descParts_ar: string[] = [phone_name];
  const descParts_he: string[] = [phone_name];

  if (specs.screen) {
    const size = specs.screen.match(/([\d.]+)\s*inches/i);
    if (size) {
      descParts_ar.push(`شاشة ${size[1]} بوصة`);
      descParts_he.push(`מסך ${size[1]} אינץ'`);
    }
  }
  if (specs.camera) {
    descParts_ar.push(`كاميرا ${specs.camera}`);
    descParts_he.push(`מצלמה ${specs.camera}`);
  }
  if (specs.battery) {
    const batNum = specs.battery.match(/([\d,]+)\s*mAh/i);
    if (batNum) {
      descParts_ar.push(`بطارية ${batNum[1]} mAh`);
      descParts_he.push(`סוללה ${batNum[1]} mAh`);
    }
  }
  if (specs.cpu) {
    descParts_ar.push(specs.cpu.split("(")[0].trim());
    descParts_he.push(specs.cpu.split("(")[0].trim());
  }

  return {
    phone_name,
    description_ar: descParts_ar.join(" - "),
    description_he: descParts_he.join(" - "),
    specs: {
      screen: specs.screen || "",
      camera: specs.camera || "",
      battery: specs.battery || "",
      cpu: specs.cpu || "",
      ram: specs.ram || "",
      weight: specs.weight || "",
    },
    colors,
    storage_options,
    image_url,
    gallery,
  };
}

/**
 * Main entry: search + scrape a product by name + brand
 */
export async function fetchProductData(name: string, brand: string): Promise<AutoFillResult> {
  // Search GSMArena
  const productUrl = await searchGSMArena(name, brand);
  if (!productUrl) {
    throw new Error(`لم يتم العثور على "${brand} ${name}" في GSMArena`);
  }

  // Scrape product page
  const result = await scrapeProductPage(productUrl);
  if (!result) {
    throw new Error("فشل في قراءة بيانات المنتج من GSMArena");
  }

  return result;
}
