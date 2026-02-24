import { ImageResponse } from "next/og";
import { createAdminSupabase } from "@/lib/supabase";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

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

export default async function AppleIcon() {
  const logoUrl = await getLogoUrl();

  if (logoUrl) {
    return new ImageResponse(
      (
        <div
          style={{
            width: 180,
            height: 180,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#09090b",
            borderRadius: 36,
          }}
        >
          <img
            src={logoUrl}
            width={140}
            height={140}
            style={{ objectFit: "contain" }}
          />
        </div>
      ),
      { ...size }
    );
  }

  // Fallback
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          borderRadius: 36,
          background: "#09090b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 70,
            background: "linear-gradient(135deg, #c41040 0%, #e91e63 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: 80,
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
