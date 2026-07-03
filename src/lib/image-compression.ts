import imageCompression from "browser-image-compression";

// Never let a raw phone photo hit the network at full size. Resize + compress
// client-side before upload — smaller uploads on slow Tarkwa connections,
// smaller Storage footprint, faster delivery. EXIF/GPS metadata is stripped
// by default (browser-image-compression's `preserveExif` defaults to false)
// — a manager's phone photo shouldn't silently leak their home location.
const MAX_DIMENSION_PX = 1600;
const TARGET_MAX_SIZE_MB = 0.5;
const INITIAL_QUALITY = 0.8;

// The blur placeholder: a ~20px-wide, heavily compressed version encoded as
// a base64 data URL. It travels with the record (see lib/images.ts), so
// SmartImage can blur-up with zero extra network round-trips.
const BLUR_DIMENSION_PX = 20;
const BLUR_QUALITY = 0.5;

export interface CompressedImage {
  file: File;
  blurDataURL: string;
}

// onProgress reports 0-100 for the main compression pass only — the blur
// pass is comparatively instant and not worth its own progress reporting.
export async function compressImageForUpload(
  file: File,
  onProgress?: (progress: number) => void
): Promise<CompressedImage> {
  const compressed = await imageCompression(file, {
    maxWidthOrHeight: MAX_DIMENSION_PX,
    maxSizeMB: TARGET_MAX_SIZE_MB,
    initialQuality: INITIAL_QUALITY,
    fileType: "image/webp",
    useWebWorker: true,
    onProgress,
  });

  const tinyBlurSource = await imageCompression(file, {
    maxWidthOrHeight: BLUR_DIMENSION_PX,
    initialQuality: BLUR_QUALITY,
    fileType: "image/webp",
    useWebWorker: true,
  });
  const blurDataURL = await imageCompression.getDataUrlFromFile(tinyBlurSource);

  return { file: compressed, blurDataURL };
}
