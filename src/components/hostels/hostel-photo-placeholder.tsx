import { cn } from "@/lib/utils";

// Same gold-pin-on-deep-green mark as the cold-launch splash and the OG
// image (see app/layout.tsx and app/opengraph-image.tsx) -- a hostel with
// no photos yet should look like an intentional brand moment, never a
// grey box with a broken-image glyph. Used instead of SmartImage's own
// (much more subtle) empty-state specifically where a photo is the very
// first thing a student sees for a given hostel -- the feed card
// thumbnail and the details gallery.
export function HostelPhotoPlaceholder({
  name,
  className,
  children,
}: {
  name: string;
  className?: string;
  // Same overlay pattern as SmartImage -- lets callers render the price
  // pill/availability badge/save heart on top of this exactly as they
  // would over a real photo, so the placeholder swaps in as a drop-in
  // replacement rather than needing its own bespoke layout.
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden bg-brand-800", className)}>
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <svg width="48" height="48" viewBox="0 0 512 512" className="shrink-0">
          <path
            d="M256 79 C177 79 118 138 118 217 C118 310 256 443 256 443 C256 443 394 310 394 217 C394 138 335 79 256 79 Z"
            fill="#E8A33D"
          />
          <path d="M256 148 L335 217 L310 217 L310 286 L202 286 L202 217 L177 217 Z" fill="#0E4A34" />
        </svg>
        <span className="line-clamp-2 font-display text-body-strong text-white">{name}</span>
      </div>
      {children}
    </div>
  );
}
