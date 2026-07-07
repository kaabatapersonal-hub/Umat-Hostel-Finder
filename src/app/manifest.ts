import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "UMaT Hostel Finder",
    short_name: "Hostel Finder",
    description: "Find your next hostel near UMaT — fast, trusted, and built for students.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e4a34",
    theme_color: "#0e4a34",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
