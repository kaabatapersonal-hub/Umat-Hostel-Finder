import { ImageResponse } from "next/og";

// Generated at build time (no Request-time API used), same as the static
// PNG this replaces -- switched to codegen specifically so the brand name
// baked into the pixels can change without needing an image-editing tool.
export const alt = "Campa — find your next hostel near campus";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
          background: "#0E4A34",
        }}
      >
        <svg width="140" height="140" viewBox="0 0 512 512">
          <path
            d="M256 79 C177 79 118 138 118 217 C118 310 256 443 256 443 C256 443 394 310 394 217 C394 138 335 79 256 79 Z"
            fill="#E8A33D"
          />
          <path d="M256 148 L335 217 L310 217 L310 286 L202 286 L202 217 L177 217 Z" fill="#0E4A34" />
        </svg>
        <div style={{ fontSize: 96, fontWeight: 800, color: "#ffffff", letterSpacing: -1 }}>Campa</div>
        <div style={{ fontSize: 32, color: "#E8A33D" }}>Find your next hostel near campus</div>
      </div>
    ),
    { ...size }
  );
}
