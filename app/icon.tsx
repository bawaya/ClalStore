import { ImageResponse } from "next/og";
import { createAdminSupabase } from "@/lib/supabase";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Re-generate every 5 minutes so logo changes in admin are picked up
export const revalidate = 300;

async function getLogoUrl(): Promise<string | null> {
  try {
    const s = createAdminSupabase();
    if (!s) return null;
    const { data } = await s
      .from("settings")
      .select("value")
      .eq("key", "logo_url")
      .single();
    return data?.value || null;
  } catch {
    return null;
  }
}

export default async function Icon() {
  const logoUrl = await getLogoUrl();

  // If a custom logo is uploaded in admin, use it
  if (logoUrl) {
    return new ImageResponse(
      (
        <div
          style={{
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
          }}
        >
          <img
            src={logoUrl}
            width={32}
            height={32}
            style={{ objectFit: "contain" }}
          />
        </div>
      ),
      { ...size }
    );
  }

  // Fallback: gradient "C" icon
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: "#09090b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            background: "linear-gradient(135deg, #c41040 0%, #e91e63 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: 15,
              fontWeight: 900,
              fontFamily: "Arial, Helvetica, sans-serif",
              lineHeight: 1,
            }}
          >
            C
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
