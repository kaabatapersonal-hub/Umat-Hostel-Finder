"use client";

import { useState } from "react";
import Image from "next/image";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

// A hint for how large this image will render, mapped to next/image's
// `sizes` attribute so the browser (and Next's built-in optimizer) requests
// an appropriately small variant — free-tier-safe today, and the same prop
// a future Supabase transform param would key off, so call sites never need
// to change when that's turned on.
export type ImageSizeHint = "thumbnail" | "medium" | "large" | "full";

const SIZE_HINT_SIZES: Record<ImageSizeHint, string> = {
  thumbnail: "(min-width: 640px) 50vw, 100vw",
  medium: "(min-width: 640px) 33vw, 50vw",
  large: "100vw",
  full: "100vw",
};

export interface SmartImageProps {
  src: string | null;
  blurDataURL?: string | null;
  alt: string;
  sizeHint?: ImageSizeHint;
  priority?: boolean;
  // Aspect ratio / rounding / etc — SmartImage doesn't assume a shape, the
  // caller does (aspect-video, aspect-square, aspect-[4/3], ...).
  className?: string;
  // Overlay content (price pill, badges, back button, ...) — rendered
  // inside the same relative container as the image, so it positions with
  // simple `absolute` classes regardless of load/fallback state.
  children?: React.ReactNode;
}

// The single image component used everywhere in the app: blurs up from a
// zero-network-cost placeholder, lazy-loads off-screen, reserves its own
// space (no layout shift), and never shows a broken-image glyph — a missing
// or failed src gets the same branded fallback used everywhere else.
export function SmartImage({
  src,
  blurDataURL,
  alt,
  sizeHint = "medium",
  priority = false,
  className,
  children,
}: SmartImageProps) {
  const [hasError, setHasError] = useState(false);
  const showFallback = !src || hasError;

  return (
    <div className={cn("relative overflow-hidden bg-brand-50", className)}>
      {showFallback ? (
        <div className="flex h-full w-full items-center justify-center">
          <Building2 className="size-10 text-brand-800/40" strokeWidth={1.5} />
        </div>
      ) : (
        <>
          {/* No blurDataURL (pre-Session-5 data) -> brand-tinted shimmer
              instead of a true blur, per the session's fallback allowance. */}
          {!blurDataURL && <Skeleton className="absolute inset-0 rounded-none" />}
          <Image
            src={src}
            alt={alt}
            fill
            sizes={SIZE_HINT_SIZES[sizeHint]}
            className="object-cover"
            priority={priority}
            loading={priority ? undefined : "lazy"}
            placeholder={blurDataURL ? "blur" : "empty"}
            blurDataURL={blurDataURL ?? undefined}
            onError={() => setHasError(true)}
          />
        </>
      )}
      {children}
    </div>
  );
}
