// =====================================================
// Image search — multi-source candidate fetching
//   • Google Custom Search (images) — broadest catalog
//   • Pexels — already wired into the project (stock_images)
//   • Bing — optional secondary
// Returns a unified list of image candidates that the
// curator can hand to a vision model.
// =====================================================

import { getIntegrationConfig } from "@/lib/integrations/hub";

export interface ImageCandidate {
  url: string;
  thumbnail: string;
  source: "google" | "pexels" | "bing";
  title?: string;
  width?: number;
  height?: number;
  /** Site that hosts the image — useful to deprioritize unofficial sources. */
  domain?: string;
}

/** Run all configured search sources in parallel, dedupe by URL hash, return up to `limit`. */
export async function findImageCandidates(
  query: string,
  opts: { limit?: number; preferOfficial?: boolean } = {},
): Promise<ImageCandidate[]> {
  const limit = opts.limit ?? 30;
  const tasks: Promise<ImageCandidate[]>[] = [];

  const googleCfg = await safeConfig("image_search");
  if (googleCfg?.api_key && googleCfg?.cx) {
    tasks.push(
      searchGoogleImages(query, String(googleCfg.api_key), String(googleCfg.cx)).catch(() => []),
    );
  }
  if (googleCfg?.bing_key) {
    tasks.push(searchBing(query, String(googleCfg.bing_key)).catch(() => []));
  }

  const pexelsCfg = await safeConfig("stock_images");
  if (pexelsCfg?.api_key) {
    tasks.push(searchPexels(query, String(pexelsCfg.api_key)).catch(() => []));
  }

  // Env-var fallback if no integrations configured
  if (tasks.length === 0) {
    if (process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_CX) {
      tasks.push(
        searchGoogleImages(
          query,
          process.env.GOOGLE_CSE_API_KEY,
          process.env.GOOGLE_CSE_CX,
        ).catch(() => []),
      );
    }
    if (process.env.PEXELS_API_KEY) {
      tasks.push(searchPexels(query, process.env.PEXELS_API_KEY).catch(() => []));
    }
  }

  const results = await Promise.all(tasks);
  const merged = results.flat();

  // Dedupe by URL
  const seen = new Set<string>();
  const unique: ImageCandidate[] = [];
  for (const c of merged) {
    if (seen.has(c.url)) continue;
    seen.add(c.url);
    unique.push(c);
  }

  // Optional ranking: official-looking domains first
  if (opts.preferOfficial) {
    unique.sort((a, b) => officialScore(b) - officialScore(a));
  }

  return unique.slice(0, limit);
}

async function safeConfig(type: string): Promise<Record<string, unknown> | null> {
  try {
    return await getIntegrationConfig(type);
  } catch {
    return null;
  }
}

function officialScore(c: ImageCandidate): number {
  const d = (c.domain || "").toLowerCase();
  if (!d) return 0;
  // Manufacturer / official retail = highest
  if (
    d.includes("apple.com") ||
    d.includes("samsung.com") ||
    d.includes("dyson.") ||
    d.includes("philips.") ||
    d.includes("lg.com") ||
    d.includes("sony.com") ||
    d.includes("xiaomi.") ||
    d.includes("huawei.") ||
    d.includes("microsoft.com") ||
    d.includes("anker.com") ||
    d.includes("logitech.com")
  ) {
    return 100;
  }
  // Major retail with reliable product shots
  if (
    d.includes("amazon.") ||
    d.includes("bestbuy.") ||
    d.includes("payngo.") ||
    d.includes("ksp.") ||
    d.includes("ivory.") ||
    d.includes("gsmarena.com")
  ) {
    return 60;
  }
  // Stock photo / generic
  if (d.includes("pexels.com") || d.includes("unsplash.com")) return 20;
  return 30;
}

// ─────────────────────────────────────────────
// Google Custom Search (Images)
// ─────────────────────────────────────────────

async function searchGoogleImages(
  query: string,
  apiKey: string,
  cx: string,
): Promise<ImageCandidate[]> {
  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", query);
  url.searchParams.set("searchType", "image");
  url.searchParams.set("num", "10");
  url.searchParams.set("safe", "active");
  url.searchParams.set("imgType", "photo");

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Google CSE ${res.status}`);
  }
  const data = (await res.json()) as {
    items?: Array<{
      link: string;
      title?: string;
      image?: {
        thumbnailLink?: string;
        width?: number;
        height?: number;
      };
      displayLink?: string;
    }>;
  };
  return (data.items || []).map((it) => ({
    url: it.link,
    thumbnail: it.image?.thumbnailLink || it.link,
    source: "google" as const,
    title: it.title,
    width: it.image?.width,
    height: it.image?.height,
    domain: it.displayLink,
  }));
}

// ─────────────────────────────────────────────
// Pexels
// ─────────────────────────────────────────────

async function searchPexels(query: string, apiKey: string): Promise<ImageCandidate[]> {
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "12");
  url.searchParams.set("orientation", "portrait");

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  const data = (await res.json()) as {
    photos?: Array<{
      id: number;
      width: number;
      height: number;
      alt?: string;
      src: { large?: string; medium?: string; original?: string };
      photographer?: string;
    }>;
  };
  return (data.photos || []).map((p) => ({
    url: p.src.large || p.src.original || "",
    thumbnail: p.src.medium || p.src.large || "",
    source: "pexels" as const,
    title: p.alt,
    width: p.width,
    height: p.height,
    domain: "pexels.com",
  })).filter((c) => c.url);
}

// ─────────────────────────────────────────────
// Bing Image Search (v7)
// ─────────────────────────────────────────────

async function searchBing(query: string, apiKey: string): Promise<ImageCandidate[]> {
  const url = new URL("https://api.bing.microsoft.com/v7.0/images/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "15");
  url.searchParams.set("safeSearch", "Strict");
  url.searchParams.set("imageType", "Photo");

  const res = await fetch(url.toString(), {
    headers: { "Ocp-Apim-Subscription-Key": apiKey },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Bing ${res.status}`);
  const data = (await res.json()) as {
    value?: Array<{
      contentUrl: string;
      thumbnailUrl: string;
      name?: string;
      width?: number;
      height?: number;
      hostPageDisplayUrl?: string;
    }>;
  };
  return (data.value || []).map((it) => ({
    url: it.contentUrl,
    thumbnail: it.thumbnailUrl,
    source: "bing" as const,
    title: it.name,
    width: it.width,
    height: it.height,
    domain: it.hostPageDisplayUrl,
  }));
}
