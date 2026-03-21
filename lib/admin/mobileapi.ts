// =====================================================
// ClalMobile — MobileAPI.dev Product Data Provider
// Fetches accurate specs, colors, images from mobileapi.dev
// Used by admin auto-fill feature
// Replaces GSMArena scraper with a proper API
// =====================================================

const API_BASE = "https://api.mobileapi.dev";
const API_KEY = process.env.MOBILEAPI_KEY || "";

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
    return { hex: c.hex, name_ar: c.ar, name_he: c.he };
  }

  // Fallback — use original name
  return { hex: "#808080", name_ar: colorStr.trim(), name_he: colorStr.trim() };
}

// ===== Exported types =====
export interface AutoFillColor {
  hex: string;
  name_ar: string;
  name_he: string;
  name_en: string;
  image?: string;
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

// ===== MobileAPI response types =====
interface MobileAPIDevice {
  id: number;
  match_certainty: string;
  match_type: string;
  name: string;
  manufacturer_name: string;
  device_type: string;
  model_numbers: string | null;
  colors: string;
  storage: string;
  screen_resolution: string;
  weight: string;
  thickness: string;
  release_date: string;
  camera: string;
  battery_capacity: string;
  hardware: string;
  image_url: string;
  image_b64?: string;
}

interface MobileAPISearchResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
  devices: MobileAPIDevice[];
}

interface MobileAPIImage {
  id: number;
  type: string;
  image_url: string;
  caption: string;
  is_official: boolean;
  order: number;
}

interface MobileAPIImagesResponse {
  value: MobileAPIImage[];
  Count: number;
}

/**
 * Search MobileAPI.dev for a device by name and manufacturer
 * Tries multiple search strategies to find the best match
 */
async function searchDevice(name: string, brand: string): Promise<MobileAPIDevice | null> {
  // Avoid duplicating brand in search query
  // e.g. if name="Oppo Reno 7z" and brand="Oppo", search "Oppo Reno 7z" not "Oppo Oppo Reno 7z"
  const nameLower = name.toLowerCase().trim();
  const brandLower = brand.toLowerCase().trim();
  const searchName = nameLower.startsWith(brandLower)
    ? name.trim()
    : `${brand} ${name}`.trim();

  // Strip brand from name for alternate queries
  const nameWithoutBrand = nameLower.startsWith(brandLower)
    ? name.trim().slice(brand.length).trim()
    : name.trim();

  // Build list of search queries to try (in order of priority)
  const queries: { name: string; manufacturer?: string }[] = [
    // Try 1: Full name with manufacturer filter
    { name: searchName, manufacturer: brand },
    // Try 2: Full name without manufacturer filter
    { name: searchName },
    // Try 3: Just model name with manufacturer filter (e.g. "Reno 7z" + Oppo)
    { name: nameWithoutBrand, manufacturer: brand },
    // Try 4: Model name with spaces removed between letters and numbers
    //   e.g. "Reno 7z" → "Reno7 Z" (common naming variation)
    { name: nameWithoutBrand.replace(/(\D)\s+(\d)/g, "$1$2").replace(/(\d)\s*([a-zA-Z])/g, "$1 $2").toUpperCase(), manufacturer: brand },
  ];

  // Deduplicate queries
  const seen = new Set<string>();
  const uniqueQueries = queries.filter((q) => {
    const key = `${q.name.toLowerCase()}|${q.manufacturer?.toLowerCase() || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  for (const q of uniqueQueries) {
    const device = await doSearch(q.name, q.manufacturer);
    if (device) return device;
  }

  return null;
}

/**
 * Execute a single search request against MobileAPI
 */
async function doSearch(searchName: string, manufacturer?: string): Promise<MobileAPIDevice | null> {
  const params = new URLSearchParams({
    key: API_KEY,
    name: searchName,
  });
  if (manufacturer) {
    params.set("manufacturer", manufacturer);
  }

  const url = `${API_BASE}/devices/search/?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: {
        "Authorization": `Token ${API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.log(`[MobileAPI] Search failed with status ${res.status}`);
      return null;
    }

    const data: MobileAPISearchResponse = await res.json();

    if (!data.devices || data.devices.length === 0) {
      return null;
    }

    // Pick best match: prefer highest certainty
    let best = data.devices[0];
    for (const device of data.devices) {
      const currentCert = parseFloat(device.match_certainty);
      const bestCert = parseFloat(best.match_certainty);
      if (currentCert > bestCert) {
        best = device;
      } else if (currentCert === bestCert) {
        // Prefer shorter name (more exact match)
        if (device.name.length < best.name.length) {
          best = device;
        }
      }
    }

    // Accept exact+ matches (≥100%), or fuzzy matches (≥92%) if device name
    // contains key words from the search query
    const bestCertainty = parseFloat(best.match_certainty);
    if (bestCertainty >= 100) return best;

    if (bestCertainty >= 92) {
      // Check if major words from search overlap with the device name
      const searchWords = searchName.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter((w) => w.length >= 2);
      const deviceWords = best.name.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/);
      const matchCount = searchWords.filter((w) => deviceWords.some((dw) => dw.includes(w) || w.includes(dw))).length;
      if (matchCount >= Math.ceil(searchWords.length * 0.5)) {
        return best;
      }
    }

    console.log(`[MobileAPI] Best match "${best.name}" (${best.match_certainty}) not confident enough for "${searchName}"`);
    return null;
  } catch (e) {
    console.log("[MobileAPI] Search error:", e);
    return null;
  }
}

/**
 * Fetch device images from MobileAPI.dev
 */
async function fetchDeviceImages(deviceId: number): Promise<string[]> {
  const url = `${API_BASE}/devices/${deviceId}/images/?key=${API_KEY}&limit=20`;

  try {
    const res = await fetch(url, {
      headers: {
        "Authorization": `Token ${API_KEY}`,
      },
    });

    if (!res.ok) return [];

    const data: MobileAPIImagesResponse = await res.json();
    if (!data.value || data.value.length === 0) return [];

    return data.value
      .sort((a, b) => a.order - b.order)
      .map((img) => img.image_url)
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Parse specs from MobileAPI device data
 */
function parseSpecs(device: MobileAPIDevice): Record<string, string> {
  const specs: Record<string, string> = {};

  // Screen
  if (device.screen_resolution) {
    specs.screen = device.screen_resolution;
  }

  // Camera
  if (device.camera) {
    specs.camera = device.camera;
  }

  // Battery
  if (device.battery_capacity) {
    specs.battery = device.battery_capacity;
  }

  // Weight
  if (device.weight) {
    specs.weight = device.weight.includes("g") ? device.weight : `${device.weight}g`;
  }

  // Hardware (contains RAM + CPU)
  if (device.hardware) {
    const hw = device.hardware;
    // Extract RAM
    const ramMatch = hw.match(/(\d+)\s*(?:GB)?\s*RAM/i);
    if (ramMatch) {
      specs.ram = hw.includes("GB RAM") ? `${ramMatch[1]}GB` : ramMatch[1];
    }
    // Extract CPU/chipset
    const cpuParts = hw.split(",").map((s) => s.trim());
    const cpuPart = cpuParts.find((p) => !p.match(/\d+\s*GB\s*RAM/i));
    if (cpuPart) {
      specs.cpu = cpuPart;
    }
  }

  // Thickness → dimensions
  if (device.thickness) {
    specs.dimensions = `Thickness: ${device.thickness}`;
  }

  return specs;
}

/**
 * Parse storage options from MobileAPI storage field
 */
function parseStorageOptions(storage: string): string[] {
  if (!storage) return [];

  // Split by comma and clean up
  return storage
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      // Normalize: remove weird characters, ensure uppercase
      const clean = s.replace(/[Â\u00A0]/g, "").trim().toUpperCase();
      // Ensure it ends with GB or TB
      if (/^\d+$/.test(clean)) return `${clean}GB`;
      return clean;
    })
    .filter((s) => /^\d+\s*(GB|TB)$/i.test(s));
}

/**
 * Parse colors from MobileAPI colors field
 */
function parseColors(colorsStr: string): AutoFillColor[] {
  if (!colorsStr) return [];

  return colorsStr
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
    .map((c) => {
      const matched = matchColor(c);
      return {
        ...matched,
        name_en: c.trim(),
      };
    });
}

/**
 * Generate bilingual descriptions from device data
 */
function generateDescriptions(device: MobileAPIDevice, specs: Record<string, string>): { ar: string; he: string } {
  const name = device.name;

  const descParts_ar: string[] = [`${name} — تصميم أنيق وأداء مذهل!`];
  const descParts_he: string[] = [`${name} — עיצוב אלגנטי וביצועים מרשימים!`];

  if (specs.screen) {
    const size = specs.screen.match(/([\d.]+)"/);
    if (size) {
      descParts_ar.push(`شاشة ${size[1]} بوصة بجودة خارقة`);
      descParts_he.push(`מסך ${size[1]} אינץ' באיכות מדהימה`);
    }
  }

  if (specs.camera) {
    const mp = specs.camera.match(/([\d.]+)\s*MP/i);
    if (mp) {
      descParts_ar.push(`كاميرا مذهلة ${mp[1]}MP`);
      descParts_he.push(`מצלמה מרשימה ${mp[1]}MP`);
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
      descParts_ar.push(`بطارية ${batNum[1]} mAh تدوم طول اليوم`);
      descParts_he.push(`סוללה ${batNum[1]} mAh שמחזיקה כל היום`);
    }
  }

  return {
    ar: descParts_ar.length > 2 ? `${descParts_ar[0]} ${descParts_ar.slice(1).join("، ")}.` : descParts_ar.join(" "),
    he: descParts_he.length > 2 ? `${descParts_he[0]} ${descParts_he.slice(1).join(", ")}.` : descParts_he.join(" "),
  };
}

/**
 * Main entry: search + fetch product data by name + brand
 * Drop-in replacement for the old GSMArena fetchProductData
 */
export async function fetchProductData(name: string, brand: string): Promise<AutoFillResult> {
  // Search MobileAPI
  const device = await searchDevice(name, brand);
  if (!device) {
    throw new Error(`لم يتم العثور على "${brand} ${name}" — تأكد من الاسم بالإنجليزية (مثال: Galaxy S25 Ultra).`);
  }

  // Parse specs from device data
  const specs = parseSpecs(device);

  // Parse storage options
  const storage_options = parseStorageOptions(device.storage);

  // Parse colors
  const colors = parseColors(device.colors);

  // Get main image
  const image_url = device.image_url || "";

  // Fetch gallery images 
  const allImages = await fetchDeviceImages(device.id);
  // Filter out thumbnails for gallery, keep main + gallery images
  const gallery = allImages.filter((url) => !url.includes("/thumb."));

  // Generate descriptions
  const descriptions = generateDescriptions(device, specs);

  return {
    phone_name: device.name,
    description_ar: descriptions.ar,
    description_he: descriptions.he,
    specs,
    colors,
    storage_options,
    image_url,
    gallery,
  };
}
