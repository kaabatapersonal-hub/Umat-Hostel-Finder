"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmartImage } from "@/components/ui/smart-image";
import { SaveHeartButton } from "@/components/hostels/save-heart-button";
import type { UploadedImage } from "@/lib/images";
import type { SaveableHostelInput } from "@/lib/queries/saved-hostels";

export interface ImageGalleryProps {
  images: UploadedImage[];
  hostel: SaveableHostelInput;
}

export function ImageGallery({ images, hostel }: ImageGalleryProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

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
    <div className="relative aspect-[4/3] w-full bg-brand-50 sm:aspect-video">
      {hasImages ? (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((image, i) => (
            <div key={image.url + i} className="relative h-full w-full shrink-0 snap-center">
              <SmartImage
                src={image.url}
                blurDataURL={image.blurDataURL}
                alt={`${hostel.name} — photo ${i + 1}`}
                sizeHint="large"
                priority={i === 0}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      ) : (
        <SmartImage src={null} alt={hostel.name} className="h-full w-full" />
      )}

      <button
        type="button"
        aria-label="Go back"
        onClick={() => router.back()}
        className="absolute left-3 top-3 flex size-11 items-center justify-center rounded-full bg-ink-900/40 text-white backdrop-blur-sm"
      >
        <ArrowLeft className="size-5" />
      </button>

      <SaveHeartButton hostel={hostel} className="absolute right-3 top-3" />

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
    </div>
  );
}
