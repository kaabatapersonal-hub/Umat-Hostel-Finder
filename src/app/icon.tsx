import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// A plain gold-on-deep-green monogram -- legible at 16-32px where any
// finer shape (a pin, a house) turns to mush; apple-icon.tsx uses the same
// mark with more room to breathe.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0e4a34",
          color: "#e8a33d",
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        U
      </div>
    ),
    size
  );
}
