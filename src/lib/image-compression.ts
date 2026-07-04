import imageCompression from "browser-image-compression";

// Never let a raw phone photo hit the network at full size. Resize + compress
// client-side before upload — smaller uploads on slow Tarkwa connections,
// smaller Storage footprint, faster delivery. EXIF/GPS metadata is stripped
// by default (browser-image-compression's `preserveExif` defaults to false)
// — a manager's phone photo shouldn't silently leak their home location.
//
// Session 12.5: a single 1600px/q0.8 variant was a compromise that made
// full-width details/lightbox views look soft. Two variants now, generated
// client-side from the same source file so nothing extra hits the network
// beyond one additional (small) upload per photo:
//   - thumb: feed cards, saved rows, admin lists, map popups -- smaller and
//     faster than the old single variant, not just "as fast".
//   - full: details hero/gallery, room-type galleries, the lightbox --
//     visibly sharper than the old single variant.
const THUMB_DIMENSION_PX = 640;
const THUMB_QUALITY = 0.75;

const FULL_DIMENSION_PX = 1920;
const FULL_QUALITY = 0.85;

// A huge input (e.g. a 6000px, 15MB phone photo) is never rejected for
// size -- maxWidthOrHeight/maxSizeMB below make browser-image-compression
// downscale it like anything else. The only ceiling lives in the uploader
// UI (an absurd-input safety net), not here.

// The blur placeholder: a ~20px-wide, heavily compressed version encoded as
// a base64 data URL. It travels with the record (see lib/images.ts), so
// SmartImage can blur-up with zero extra network round-trips.
const BLUR_DIMENSION_PX = 20;
const BLUR_QUALITY = 0.5;

export interface CompressedImage {
  fullFile: File;
  thumbFile: File;
  blurDataURL: string;
}

// onProgress reports 0-100 across all three compression passes (full, thumb,
// blur) combined, so the uploader's progress bar reads as one continuous
// operation rather than restarting twice.
export async function compressImageForUpload(
  file: File,
  onProgress?: (progress: number) => void
): Promise<CompressedImage> {
  const fullFile = await imageCompression(file, {
    maxWidthOrHeight: FULL_DIMENSION_PX,
    initialQuality: FULL_QUALITY,
    fileType: "image/webp",
    useWebWorker: true,
    onProgress: (p) => onProgress?.(Math.round(p * 0.6)),
  });

  const thumbFile = await imageCompression(file, {
    maxWidthOrHeight: THUMB_DIMENSION_PX,
    initialQuality: THUMB_QUALITY,
    fileType: "image/webp",
    useWebWorker: true,
    onProgress: (p) => onProgress?.(60 + Math.round(p * 0.3)),
  });

  const tinyBlurSource = await imageCompression(file, {
    maxWidthOrHeight: BLUR_DIMENSION_PX,
    initialQuality: BLUR_QUALITY,
    fileType: "image/webp",
    useWebWorker: true,
  });
  const blurDataURL = await imageCompression.getDataUrlFromFile(tinyBlurSource);
  onProgress?.(100);

  return { fullFile, thumbFile, blurDataURL };
}
