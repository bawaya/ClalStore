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
 * @param imageUrl — public URL of the image
 * @returns PNG buffer with transparent background
 */
export async function removeBackground(imageUrl: string): Promise<RemoveBgResult> {
  const apiKey = process.env.REMOVEBG_API_KEY;
  if (!apiKey) throw new Error("REMOVEBG_API_KEY not configured");

  const res = await fetch(REMOVEBG_API, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      image_url: imageUrl,
      size: "auto",        // auto-detect best resolution
      type: "product",     // optimized for product images
      format: "png",       // transparent background
      scale: "fit",        // fit within bounds
      crop: true,          // crop to subject
      crop_margin: "5%",   // small margin around device
    }),
    signal: AbortSignal.timeout(30000), // 30s timeout
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Remove.bg error ${res.status}: ${errText}`);
  }

  const data = await res.json();

  if (!data.data?.result_b64) {
    throw new Error("Remove.bg: no result returned");
  }

  // Decode base64 result
  const binaryStr = atob(data.data.result_b64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  return {
    imageBuffer: bytes.buffer,
    contentType: "image/png",
    width: data.data.output_width || 800,
    height: data.data.output_height || 800,
  };
}

/**
 * Remove background from raw image buffer
 * @param buffer — image file data
 * @param filename — original filename
 * @returns PNG buffer with transparent background
 */
export async function removeBackgroundFromBuffer(
  buffer: ArrayBuffer,
  contentType: string
): Promise<RemoveBgResult> {
  const apiKey = process.env.REMOVEBG_API_KEY;
  if (!apiKey) throw new Error("REMOVEBG_API_KEY not configured");

  // Convert to base64 for API
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);

  const res = await fetch(REMOVEBG_API, {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      image_file_b64: base64,
      size: "auto",
      type: "product",
      format: "png",
      scale: "fit",
      crop: true,
      crop_margin: "5%",
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Remove.bg error ${res.status}: ${errText}`);
  }

  const data = await res.json();

  if (!data.data?.result_b64) {
    throw new Error("Remove.bg: no result returned");
  }

  const binaryStr = atob(data.data.result_b64);
  const resultBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    resultBytes[i] = binaryStr.charCodeAt(i);
  }

  return {
    imageBuffer: resultBytes.buffer,
    contentType: "image/png",
    width: data.data.output_width || 800,
    height: data.data.output_height || 800,
  };
}
