// =====================================================
// ClalMobile — Remove.bg Integration
// Removes image background using Remove.bg API
// Returns PNG with transparent background
// =====================================================

const REMOVEBG_API = "https://api.remove.bg/v1.0/removebg";

interface RemoveBgResult {
  imageBuffer: ArrayBuffer;
  contentType: string;
  width: number;
  height: number;
}

/**
 * Remove background from an image URL
 * Uses binary response mode (simpler, more reliable on Edge)
 */
export async function removeBackground(imageUrl: string): Promise<RemoveBgResult> {
  const apiKey = process.env.REMOVEBG_API_KEY;
  if (!apiKey) throw new Error("REMOVEBG_API_KEY not configured");

  // Use form-data with binary response — most reliable on Edge runtime
  const formBody = new URLSearchParams({
    image_url: imageUrl,
    size: "auto",
    type: "product",
    format: "png",
    crop: "true",
    crop_margin: "5%",
  });

  const res = await fetch(REMOVEBG_API, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      Accept: "image/png",
    },
    body: formBody,
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Remove.bg error ${res.status}: ${errText}`);
  }

  const imageBuffer = await res.arrayBuffer();
  const w = parseInt(res.headers.get("x-width") || "0", 10);
  const h = parseInt(res.headers.get("x-height") || "0", 10);

  return {
    imageBuffer,
    contentType: "image/png",
    width: w || 800,
    height: h || 800,
  };
}

/**
 * Remove background from raw image buffer
 * Uploads as multipart/form-data file, binary response
 */
export async function removeBackgroundFromBuffer(
  buffer: ArrayBuffer,
  contentType: string
): Promise<RemoveBgResult> {
  const apiKey = process.env.REMOVEBG_API_KEY;
  if (!apiKey) throw new Error("REMOVEBG_API_KEY not configured");

  const blob = new Blob([buffer], { type: contentType });
  const formData = new FormData();
  formData.append("image_file", blob, "image.png");
  formData.append("size", "auto");
  formData.append("type", "product");
  formData.append("format", "png");
  formData.append("crop", "true");
  formData.append("crop_margin", "5%");

  const res = await fetch(REMOVEBG_API, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      Accept: "image/png",
    },
    body: formData,
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Remove.bg error ${res.status}: ${errText}`);
  }

  const imageBuffer = await res.arrayBuffer();
  const w = parseInt(res.headers.get("x-width") || "0", 10);
  const h = parseInt(res.headers.get("x-height") || "0", 10);

  return {
    imageBuffer,
    contentType: "image/png",
    width: w || 800,
    height: h || 800,
  };
}
