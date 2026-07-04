// An uploaded, stored image: a public Storage URL (the "full" variant, ~1920px
// — details/gallery/lightbox) plus its blur placeholder generated at upload
// time (see lib/image-compression.ts). blurDataURL is null for images
// seeded/stored before this existed — SmartImage falls back to a
// brand-tinted shimmer in that case rather than a true blur.
//
// thumbUrl (Session 12.5) is the smaller ~640px variant used anywhere an
// image renders small (feed cards, saved rows, admin lists, map popups).
// It's null for every image uploaded before this session — there's only
// ever been the one file for those, so every consumer must fall back to
// `url` rather than assume thumbUrl exists. No backfill/migration: old
// photos keep rendering exactly as before, just without the extra-small
// variant.
export interface UploadedImage {
  url: string;
  thumbUrl: string | null;
  blurDataURL: string | null;
}

// Defensive parse of the jsonb `images` column — old rows might still be
// bare URL strings (pre-Session-5 data that missed the migration backfill,
// or hand-inserted test data), so tolerate both shapes rather than crash.
export function parseUploadedImages(value: unknown): UploadedImage[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry): UploadedImage | null => {
      if (typeof entry === "string") return { url: entry, thumbUrl: null, blurDataURL: null };
      if (entry && typeof entry === "object" && "url" in entry && typeof entry.url === "string") {
        const thumbUrl = "thumbUrl" in entry && typeof entry.thumbUrl === "string" ? entry.thumbUrl : null;
        const blurDataURL =
          "blurDataURL" in entry && typeof entry.blurDataURL === "string" ? entry.blurDataURL : null;
        return { url: entry.url, thumbUrl, blurDataURL };
      }
      return null;
    })
    .filter((entry): entry is UploadedImage => entry !== null);
}

// The URL to use for a small (~64-256px) rendering context -- prefers the
// dedicated thumb variant, falling back to the full variant for images
// uploaded before it existed. Use directly as SmartImage's `src`.
export function thumbnailSrc(image: UploadedImage | null | undefined): string | null {
  return image?.thumbUrl ?? image?.url ?? null;
}
