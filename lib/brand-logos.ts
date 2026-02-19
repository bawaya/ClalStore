/**
 * Brand logo URLs — using official CDN logos (SimpleIcons via unpkg)
 * These are lightweight SVG logos rendered at small sizes in product cards.
 */

const BRAND_LOGOS: Record<string, string> = {
  Samsung: "https://cdn.simpleicons.org/samsung/ffffff",
  Apple: "https://cdn.simpleicons.org/apple/ffffff",
  Xiaomi: "https://cdn.simpleicons.org/xiaomi/ffffff",
  Huawei: "https://cdn.simpleicons.org/huawei/ffffff",
  OnePlus: "https://cdn.simpleicons.org/oneplus/ffffff",
  Google: "https://cdn.simpleicons.org/google/ffffff",
  Sony: "https://cdn.simpleicons.org/sony/ffffff",
  LG: "https://cdn.simpleicons.org/lg/ffffff",
  Motorola: "https://cdn.simpleicons.org/motorola/ffffff",
  Nokia: "https://cdn.simpleicons.org/nokia/ffffff",
  OPPO: "https://cdn.simpleicons.org/oppo/ffffff",
  Realme: "https://cdn.simpleicons.org/realme/ffffff",
  Nothing: "https://cdn.simpleicons.org/nothing/ffffff",
  JBL: "https://cdn.simpleicons.org/jbl/ffffff",
  Beats: "https://cdn.simpleicons.org/beats/ffffff",
  Anker: "https://cdn.simpleicons.org/anker/ffffff",
};

export function getBrandLogo(brand: string): string | null {
  // Try exact match first, then case-insensitive
  if (BRAND_LOGOS[brand]) return BRAND_LOGOS[brand];
  const key = Object.keys(BRAND_LOGOS).find(
    (k) => k.toLowerCase() === brand.toLowerCase()
  );
  return key ? BRAND_LOGOS[key] : null;
}
