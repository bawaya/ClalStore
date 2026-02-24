import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
