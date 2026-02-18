// =====================================================
// ClalMobile — Supabase Storage Helper
// Upload / Delete / Get public URL for product images
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";

const BUCKET = "products";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Upload an image to Supabase Storage
 * @returns public URL of the uploaded image
 */
export async function uploadImage(
  file: Buffer | Uint8Array,
  filename: string,
  contentType: string
): Promise<string> {
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw new Error(`نوع غير مدعوم: ${contentType} — المسموح: JPG, PNG, WebP`);
  }
  if (file.byteLength > MAX_SIZE) {
    throw new Error(`حجم الملف ${(file.byteLength / 1024 / 1024).toFixed(1)}MB أكبر من الحد الأقصى 5MB`);
  }

  const supabase = createAdminSupabase();

  // Ensure bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b: any) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE,
    });
  }

  // Generate unique path
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `products/${uniqueName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      contentType,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) {
    throw new Error(`فشل رفع الصورة: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Delete an image from Supabase Storage by its public URL
 */
export async function deleteImage(url: string): Promise<void> {
  if (!url || url.startsWith("data:")) return; // Skip base64 URLs

  const supabase = createAdminSupabase();

  // Extract path from URL: .../storage/v1/object/public/products/path/file.jpg
  const match = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
  if (!match) return;

  const filePath = match[1];
  const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
  if (error) {
    console.error("Delete image error:", error.message);
  }
}

/**
 * Get public URL for a storage path
 */
export function getPublicUrl(path: string): string {
  const supabase = createAdminSupabase();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ===== Logo Upload (brand bucket) =====

const BRAND_BUCKET = "brand";
const LOGO_MAX_SIZE = 2 * 1024 * 1024; // 2MB
const LOGO_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/svg+xml"];

/**
 * Upload a brand logo to Supabase Storage
 * @returns public URL of the uploaded logo
 */
export async function uploadLogo(
  file: Buffer | Uint8Array,
  filename: string,
  contentType: string
): Promise<string> {
  if (!LOGO_ALLOWED_TYPES.includes(contentType)) {
    throw new Error(`نوع غير مدعوم: ${contentType} — المسموح: JPG, PNG, WebP, SVG`);
  }
  if (file.byteLength > LOGO_MAX_SIZE) {
    throw new Error(`حجم الملف ${(file.byteLength / 1024 / 1024).toFixed(1)}MB أكبر من الحد الأقصى 2MB`);
  }

  const supabase = createAdminSupabase();

  // Ensure brand bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find((b: any) => b.name === BRAND_BUCKET)) {
    await supabase.storage.createBucket(BRAND_BUCKET, {
      public: true,
      fileSizeLimit: LOGO_MAX_SIZE,
    });
  }

  // Remove old logo files before uploading new one
  const { data: existing } = await supabase.storage.from(BRAND_BUCKET).list("logo");
  if (existing && existing.length > 0) {
    await supabase.storage.from(BRAND_BUCKET).remove(existing.map((f: any) => `logo/${f.name}`));
  }

  const ext = filename.split(".").pop()?.toLowerCase() || "png";
  const uniqueName = `${Date.now()}.${ext}`;
  const filePath = `logo/${uniqueName}`;

  const { error } = await supabase.storage
    .from(BRAND_BUCKET)
    .upload(filePath, file, { contentType, cacheControl: "31536000", upsert: true });

  if (error) {
    throw new Error(`فشل رفع الشعار: ${error.message}`);
  }

  const { data } = supabase.storage.from(BRAND_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Delete the brand logo from storage
 */
export async function deleteLogo(url: string): Promise<void> {
  if (!url) return;
  const supabase = createAdminSupabase();
  const match = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
  if (!match) return;
  const filePath = match[1];
  await supabase.storage.from(BRAND_BUCKET).remove([filePath]);
}
