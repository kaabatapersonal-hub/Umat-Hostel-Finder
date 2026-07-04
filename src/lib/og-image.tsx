// Shared visual for the two social-preview image routes (opengraph-image.tsx
// and twitter-image.tsx) -- `next/og`'s ImageResponse renders via Satori, a
// small CSS subset (flexbox + a handful of properties, no Tailwind classes,
// no external fonts/emoji without extra setup), so this stays plain style
// objects and pure color/type -- the same restraint the rest of the app
// applies, no new dependencies.

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export function OgImageContent() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "90px 100px",
        background: "linear-gradient(135deg, #0e4a34 0%, #0a3325 100%)",
      }}
    >
      <span
        style={{
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: 6,
          textTransform: "uppercase",
          color: "#e8a33d",
        }}
      >
        UMaT · Tarkwa
      </span>
      <span
        style={{
          marginTop: 28,
          fontSize: 84,
          fontWeight: 700,
          lineHeight: 1.1,
          color: "#ffffff",
        }}
      >
        UMaT Hostel Finder
      </span>
      <div
        style={{
          display: "flex",
          marginTop: 32,
          width: 160,
          height: 8,
          borderRadius: 999,
          background: "#e8a33d",
        }}
      />
      <span
        style={{
          marginTop: 32,
          fontSize: 36,
          color: "rgba(255,255,255,0.85)",
        }}
      >
        Find your next hostel near campus
      </span>
    </div>
  );
}
