import type { MetadataRoute } from "next";
import { createStaticClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "hourly", priority: 1 },
    { url: `${siteUrl}/about`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/about#managers`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${siteUrl}/map`, changeFrequency: "daily", priority: 0.5 },
  ];

  try {
    const supabase = createStaticClient();
    const { data } = await supabase.from("hostels").select("id, updated_at");

    const hostelRoutes: MetadataRoute.Sitemap = (data ?? []).map((hostel) => ({
      url: `${siteUrl}/hostel/${hostel.id}`,
      lastModified: hostel.updated_at,
      changeFrequency: "daily",
      priority: 0.7,
    }));

    return [...staticRoutes, ...hostelRoutes];
  } catch {
    // A Supabase hiccup shouldn't take the whole sitemap down -- fall
    // back to the static routes alone.
    return staticRoutes;
  }
}
