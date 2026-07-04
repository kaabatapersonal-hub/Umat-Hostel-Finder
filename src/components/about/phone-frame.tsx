import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/utils";

export interface PhoneFrameProps {
  src: StaticImageData;
  alt: string;
  className?: string;
  priority?: boolean;
}

// A simple rounded-rect device silhouette, not a fussy 3D mockup that
// dates fast -- real product screenshots do the selling, the frame just
// keeps them from looking like a stray image floating on the page.
export function PhoneFrame({ src, alt, className, priority }: PhoneFrameProps) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[300px] rounded-[2.5rem] border-[6px] border-ink-900 bg-ink-900 shadow-md",
        className
      )}
    >
      <div className="absolute left-1/2 top-0 z-10 h-5 w-28 -translate-x-1/2 rounded-b-xl bg-ink-900" />
      <div className="overflow-hidden rounded-[2rem]">
        <Image
          src={src}
          alt={alt}
          placeholder="blur"
          priority={priority}
          sizes="(min-width: 640px) 300px, 80vw"
          className="w-full h-auto"
        />
      </div>
    </div>
  );
}
