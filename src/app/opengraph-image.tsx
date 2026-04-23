import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#15803d",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "32px",
        }}
      >
        <div style={{ fontSize: "200px", lineHeight: 1 }}>⚽</div>
        <div
          style={{
            color: "white",
            fontSize: "96px",
            fontWeight: "bold",
            letterSpacing: "-2px",
            lineHeight: 1,
          }}
        >
          fijo
        </div>
        <div
          style={{
            color: "rgba(255,255,255,0.75)",
            fontSize: "40px",
            letterSpacing: "0px",
          }}
        >
          Turnos de futbol
        </div>
      </div>
    ),
    size
  );
}
