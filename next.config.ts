import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Session 4 verification only (placeholder photos for the gallery /
      // room-type tabs, since the real upload pipeline is Session 5).
      // Remove once real Supabase Storage images are seeded.
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
};

export default nextConfig;
