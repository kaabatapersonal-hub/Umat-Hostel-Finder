import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Session 15 security hardening. HSTS is Vercel's job (added at the
  // edge for every HTTPS deploy); a real CSP is a stretch goal deliberately
  // skipped here -- Leaflet's inline-styled markers and Supabase/CARTO
  // tile origins would need a carefully-tuned policy, and a broken CSP
  // (blocked map tiles, blocked WhatsApp contact) is worse than none.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Blocks the whole app (admin panel included) from being framed
          // by another site -- clickjacking mitigation.
          { key: "X-Frame-Options", value: "DENY" },
          // Stops browsers from MIME-sniffing a response into something
          // other than its declared Content-Type.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Send full origin+path to our own links, only the origin to
          // other sites -- balances analytics against leaking full URLs
          // (which can carry query params) to third parties.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
