// =====================================================
// ClalMobile — GSMArena Product Data Scraper
// Fetches accurate specs, colors, images from gsmarena.com
// Used by admin auto-fill feature
// =====================================================

const BASE = "https://www.gsmarena.com";
const HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,ar;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Referer": "https://www.google.com/",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "cross-site",
  "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "max-age=0",
};

/**
 * Fetch a URL directly, falling back to a CORS proxy if blocked
 */
async function smartFetch(url: string): Promise<string | null> {
  // Attempt 1: Direct fetch with realistic headers
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) {
      const html = await res.text();
      // Check for CloudFlare challenge page
      if (html.includes("cf-browser-verification") || html.includes("cf_chl_opt") || html.includes("Just a moment...")) {
        console.log("[GSMArena] CloudFlare challenge detected, trying proxy...");
      } else {
        return html;
      }
    }
  } catch (e) {
    console.log("[GSMArena] Direct fetch failed:", e);
  }

  // Attempt 2: CORS proxy fallbacks
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`,
  ];

  for (const proxyUrl of proxies) {
    try {
      const res = await fetch(proxyUrl, {
        headers: { "User-Agent": HEADERS["User-Agent"] },
      });
      if (res.ok) {
        const html = await res.text();
        if (!html.includes("cf-browser-verification") && !html.includes("Just a moment...") && html.length > 1000) {
          return html;
        }
      }
    } catch {
      // Try next proxy
    }
  }

  return null;
}

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
export interface AutoFillColor {
  hex: string;
  name_ar: string;
  name_he: string;
  name_en: string;
  image?: string;            // صورة الجهاز بهذا اللون
}

export interface AutoFillResult {
  phone_name: string;
  description_ar: string;
  description_he: string;
  specs: Record<string, string>;
  colors: AutoFillColor[];
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

  const html = await smartFetch(url);
  if (!html) return null;

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
  const html = await smartFetch(url);
  if (!html) return null;

  // ── Phone name ──
  const nameMatch = html.match(/<h1[^>]*class="specs-phone-name-title"[^>]*>([^<]+)/);
  const phone_name = nameMatch ? nameMatch[1].trim() : "";

  // ── Specs via data-spec attributes ──
  const specs: Record<string, string> = {};

  const specMap: Record<string, string> = {
    displaysize: "screen",
    displaytype: "screen_type",
    camerapixels: "camera",
    cam2pixels: "front_camera",
    batsize: "battery",
    chipset: "cpu",
    internalmemory: "memory",
    weight: "weight",
    os: "os",
    nfc: "nfc",
    gps: "gps",
    usb: "usb",
    sensors: "sensors",
    bodyother: "waterproof_raw",
    sim: "sim",
    nettech: "network",
    charging: "charging",
    bluetooth: "bluetooth",
    dimensions: "dimensions",
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

  // Extract water resistance from bodyother
  if (specs.waterproof_raw) {
    const ipMatch = specs.waterproof_raw.match(/(IP\d+)/i);
    if (ipMatch) specs.waterproof = ipMatch[1];
    delete specs.waterproof_raw;
  }

  // Clean up charging spec — try to extract watt info
  if (specs.charging) {
    const wattMatch = specs.charging.match(/(\d+W)/i);
    if (wattMatch) specs.charging = specs.charging;
  }

  // Clean up bluetooth — just version
  if (specs.bluetooth) {
    const btMatch = specs.bluetooth.match(/(\d+\.\d+)/i);
    if (btMatch) specs.bluetooth = `Bluetooth ${btMatch[1]}`;
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
  let colors: AutoFillColor[] = [];
  const colorNamesEn: string[] = [];
  if (colorsSpec) {
    const colorNames = colorsSpec[1].split(/,\s*/);
    colors = colorNames.map((c) => {
      const matched = matchColor(c);
      colorNamesEn.push(c.trim().toLowerCase());
      return { ...matched, name_en: c.trim() };
    });
  }

  // ── Main image (bigpic URL) ──
  let image_url = "";
  const bigpicMatch = html.match(/(https?:\/\/fdn2?\.gsmarena\.com\/vv\/bigpic\/[^"'\s>]+\.(?:jpg|png|webp))/);
  if (bigpicMatch) {
    image_url = bigpicMatch[1];
  }

  // ── Gallery link & images + color-specific images ──
  let gallery: string[] = [];
  const colorImages: Map<number, string> = new Map(); // colorIndex → image URL
  const galleryLinkMatch = html.match(/href=([^\s>"]+pictures[^\s>"]+\.php)/);
  if (galleryLinkMatch) {
    const galleryUrl = `${BASE}/${galleryLinkMatch[1].replace(/^"/, "")}`;
    try {
      const galleryHtml = await smartFetch(galleryUrl);
      if (galleryHtml) {
        // Extract official product images (pics/ URLs, not reviews)
        const picMatches = galleryHtml.matchAll(/(https?:\/\/fdn2?\.gsmarena\.com\/vv\/pics\/[^"'\s>]+\.(?:jpg|png|webp))/g);
        for (const pm of picMatches) {
          if (!gallery.includes(pm[1])) gallery.push(pm[1]);
        }

        // ── Map gallery images to colors ──
        // GSMArena gallery pages have sections/labels per color.
        // Strategy 1: Look for color name in image URL or nearby text
        // Strategy 2: Look for labeled groups <a title="Color Name"> near images
        if (colors.length > 0 && gallery.length > 0) {
          // Method A: Match by image URL containing color keywords
          // e.g. "samsung-galaxy-s25-ultra-titanium-black-1.jpg"
          for (let ci = 0; ci < colors.length; ci++) {
            if (colorImages.has(ci)) continue;
            const colorWords = colorNamesEn[ci].split(/\s+/);
            // Find first gallery image whose URL contains color keywords
            for (const imgUrl of gallery) {
              const urlLower = imgUrl.toLowerCase();
              const matched = colorWords.every(w => w.length > 2 ? urlLower.includes(w) : true);
              // At least one substantial color word must match
              const hasSubstantial = colorWords.some(w => w.length > 2 && urlLower.includes(w));
              if (matched && hasSubstantial && !Array.from(colorImages.values()).includes(imgUrl)) {
                colorImages.set(ci, imgUrl);
                break;
              }
            }
          }

          // Method B: Parse labeled color groups from gallery HTML
          // GSMArena uses <a id="..." title="Color Name"> sections
          const colorGroupPattern = /title="([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+\.(?:jpg|png|webp))"/gi;
          let groupMatch;
          while ((groupMatch = colorGroupPattern.exec(galleryHtml)) !== null) {
            const label = groupMatch[1].toLowerCase().trim();
            const imgSrc = groupMatch[2];
            // Find which color this label matches
            for (let ci = 0; ci < colors.length; ci++) {
              if (colorImages.has(ci)) continue;
              const colorWords = colorNamesEn[ci].split(/\s+/).filter(w => w.length > 2);
              if (colorWords.length > 0 && colorWords.every(w => label.includes(w))) {
                // Upgrade to full-size image if it's a thumbnail
                const fullImg = imgSrc.replace(/\/thumb\//, "/").replace(/-s\d+\./, ".");
                colorImages.set(ci, fullImg);
              }
            }
          }

          // Method C: If fewer gallery images than colors, distribute evenly
          // This handles pages that show one image per color in order
          if (colorImages.size === 0 && gallery.length >= colors.length) {
            for (let ci = 0; ci < colors.length; ci++) {
              colorImages.set(ci, gallery[ci]);
            }
          }

          // Assign matched images to colors
          for (const [ci, imgUrl] of colorImages) {
            colors[ci].image = imgUrl;
          }
        }
      }
    } catch {
      // Gallery fetch failed, continue without
    }
  }

  // ── Generate bilingual description ──
  const descParts_ar: string[] = [`${phone_name} — تصميم أنيق وأداء مذهل!`];
  const descParts_he: string[] = [`${phone_name} — עיצוב אלגנטי וביצועים מרשימים!`];

  if (specs.screen) {
    const size = specs.screen.match(/([\d.]+)\s*inches/i);
    const type = specs.screen.match(/(OLED|AMOLED|Super Retina|LTPO|Dynamic AMOLED)/i);
    if (size) {
      descParts_ar.push(`شاشة ${size[1]} بوصة${type ? ` ${type[1]}` : ""} بجودة خارقة`);
      descParts_he.push(`מסך ${size[1]} אינץ'${type ? ` ${type[1]}` : ""} באיכות מדהימה`);
    }
  }
  if (specs.camera) {
    const mp = specs.camera.match(/([\d.]+)\s*MP/i);
    const frontMp = specs.front_camera?.match(/([\d.]+)\s*MP/i);
    if (mp) {
      const frontAr = frontMp ? ` وأمامية ${frontMp[1]}MP` : "";
      const frontHe = frontMp ? ` וקדמית ${frontMp[1]}MP` : "";
      descParts_ar.push(`كاميرا مذهلة ${mp[1]}MP${frontAr}`);
      descParts_he.push(`מצלמה מרשימה ${mp[1]}MP${frontHe}`);
    }
  }
  if (specs.cpu) {
    const cpuShort = specs.cpu.split("(")[0].trim();
    if (cpuShort.length < 60) {
      descParts_ar.push(`معالج ${cpuShort} القوي`);
      descParts_he.push(`מעבד ${cpuShort} עוצמתי`);
    }
  }
  if (specs.ram) {
    descParts_ar.push(`ذاكرة ${specs.ram}`);
    descParts_he.push(`זיכרון ${specs.ram}`);
  }
  if (specs.battery) {
    const batNum = specs.battery.match(/([\d,]+)\s*mAh/i);
    if (batNum) {
      const watt = specs.charging?.match(/(\d+)\s*W/i);
      const chargeAr = watt ? ` مع شحن سريع ${watt[1]}W` : "";
      const chargeHe = watt ? ` עם טעינה מהירה ${watt[1]}W` : "";
      descParts_ar.push(`بطارية ${batNum[1]} mAh تدوم طول اليوم${chargeAr}`);
      descParts_he.push(`סוללה ${batNum[1]} mAh שמחזיקה כל היום${chargeHe}`);
    }
  }
  if (specs.waterproof) {
    descParts_ar.push(`مقاومة الماء ${specs.waterproof}`);
    descParts_he.push(`עמידות במים ${specs.waterproof}`);
  }

  // Build specs object, filtering out empty values
  const allSpecs: Record<string, string> = {};
  const specKeys = [
    "screen", "camera", "front_camera", "battery", "cpu", "ram", "weight",
    "os", "waterproof", "sim", "network", "charging", "bluetooth", "usb", "nfc", "dimensions",
  ];
  for (const k of specKeys) {
    if (specs[k]) allSpecs[k] = specs[k];
  }

  return {
    phone_name,
    description_ar: descParts_ar.length > 2 ? `${descParts_ar[0]} ${descParts_ar.slice(1).join("، ")}.` : descParts_ar.join(" "),
    description_he: descParts_he.length > 2 ? `${descParts_he[0]} ${descParts_he.slice(1).join(", ")}.` : descParts_he.join(" "),
    specs: allSpecs,
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
    throw new Error(`لم يتم العثور على "${brand} ${name}" — تأكد من الاسم بالإنجليزية (مثال: Galaxy S25 Ultra). إذا استمرت المشكلة، قد يكون الموقع محجوباً مؤقتاً.`);
  }

  // Scrape product page
  const result = await scrapeProductPage(productUrl);
  if (!result) {
    throw new Error(`تم العثور على المنتج لكن فشل قراءة البيانات. حاول مرة أخرى بعد دقيقة.`);
  }

  return result;
}
