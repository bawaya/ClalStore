import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
