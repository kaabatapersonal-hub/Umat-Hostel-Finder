// An uploaded, stored image: a public Storage URL plus its blur placeholder
// generated at upload time (see lib/image-compression.ts). blurDataURL is
// null for images seeded/stored before this existed — SmartImage falls back
// to a brand-tinted shimmer in that case rather than a true blur.
export interface UploadedImage {
  url: string;
  blurDataURL: string | null;
}

// Defensive parse of the jsonb `images` column — old rows might still be
// bare URL strings (pre-Session-5 data that missed the migration backfill,
// or hand-inserted test data), so tolerate both shapes rather than crash.
export function parseUploadedImages(value: unknown): UploadedImage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry): UploadedImage | null => {
      if (typeof entry === "string") return { url: entry, blurDataURL: null };
      if (entry && typeof entry === "object" && "url" in entry && typeof entry.url === "string") {
        const blurDataURL =
          "blurDataURL" in entry && typeof entry.blurDataURL === "string" ? entry.blurDataURL : null;
        return { url: entry.url, blurDataURL };
      }
      return null;
    })
    .filter((entry): entry is UploadedImage => entry !== null);
}
