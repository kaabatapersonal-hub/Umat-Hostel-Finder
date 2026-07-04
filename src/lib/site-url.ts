// Shared between the root layout's `metadataBase` (so generated OG/Twitter
// image URLs resolve to the real deployed domain, not localhost) and the
// Session 11 email templates' "view your listing" links.
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
