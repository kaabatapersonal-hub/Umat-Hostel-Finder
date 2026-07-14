"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartImage } from "@/components/ui/smart-image";
import type { UploadedImage } from "@/lib/images";

// Same code-splitting reasoning as the hostel gallery -- the lightbox
// library only matters once someone taps a photo.
const PhotoLightbox = dynamic(() => import("@/components/hostel-details/photo-lightbox").then((m) => m.PhotoLightbox), {
  ssr: false,
});

export interface MarketGalleryProps {
  images: UploadedImage[];
  title: string;
}

// Same shape as hostel-details/image-gallery.tsx, minus the SaveHeartButton
// overlay -- saved/favorited listings are explicitly out of scope this
// session.
export function MarketGallery({ images, title }: MarketGalleryProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const hasImages = images.length > 0;

  function handleScroll() {
    const node = scrollRef.current;
    if (!node || node.clientWidth === 0) return;
    setActiveIndex(Math.round(node.scrollLeft / node.clientWidth));
  }

  function scrollToIndex(index: number) {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTo({ left: index * node.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden bg-brand-50 sm:aspect-video lg:rounded-lg">
      {hasImages ? (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((image, i) => (
            <button
              key={image.url + i}
              type="button"
              aria-label={`View photo ${i + 1} fullscreen`}
              onClick={() => setLightboxOpen(true)}
              className="relative h-full w-full shrink-0 snap-center appearance-none p-0 text-left"
            >
              <SmartImage
                src={image.url}
                blurDataURL={image.blurDataURL}
                alt={`${title} — photo ${i + 1}`}
                sizeHint="large"
                priority={i === 0}
                className="h-full w-full"
              />
            </button>
          ))}
        </div>
      ) : (
        <SmartImage src={null} alt={title} className="h-full w-full" />
      )}

      <button
        type="button"
        aria-label="Go back"
        onClick={() => router.back()}
        className="absolute left-3 top-3 flex size-11 items-center justify-center rounded-full bg-ink-900/40 text-white backdrop-blur-sm"
      >
        <ArrowLeft className="size-5" />
      </button>

      {hasImages && images.length > 1 && (
        <>
          <div className="absolute right-3 bottom-3 rounded-pill bg-ink-900/50 px-2.5 py-1 text-caption text-white backdrop-blur-sm">
            {activeIndex + 1} / {images.length}
          </div>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to photo ${i + 1}`}
                onClick={() => scrollToIndex(i)}
                className="relative flex items-center justify-center before:absolute before:-inset-2.5 before:content-['']"
              >
                <span
                  className={cn(
                    "h-1.5 rounded-pill transition-all",
                    i === activeIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"
                  )}
                />
              </button>
            ))}
          </div>
        </>
      )}

      {hasImages && (
        <PhotoLightbox images={images} alt={title} open={lightboxOpen} startIndex={activeIndex} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  );
}
