"use client";

import { useEffect, useRef } from "react";
import Lightbox, { type SlideImage } from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Counter from "yet-another-react-lightbox/plugins/counter";
import { useReducedMotion } from "framer-motion";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import type { UploadedImage } from "@/lib/images";

const SIGNATURE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

interface HostelSlide extends SlideImage {
  blurDataURL?: string | null;
}

export interface PhotoLightboxProps {
  images: UploadedImage[];
  alt: string;
  open: boolean;
  startIndex: number;
  onClose: () => void;
}

// A thin wrapper around yet-another-react-lightbox (pinch/double-tap zoom
// and swipe are its job, not ours to hand-roll) that adds: the app's
// signature motion easing, a blur-up backdrop behind each slide (via
// render.slideContainer, which *wraps* the library's own zoomable <img>
// rather than replacing it -- overriding render.slide instead would strip
// the zoom plugin of the image element it attaches to), and back-button
// history handling so Android's back gesture closes the viewer instead of
// leaving the page.
export function PhotoLightbox({ images, alt, open, startIndex, onClose }: PhotoLightboxProps) {
  const shouldReduceMotion = useReducedMotion();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Push one history entry for the lifetime of "open" (not per-photo-swipe)
  // so a single back-button press closes the whole viewer. Popping that
  // entry -- whether by the physical back button or by our own close
  // button routing through history.back() -- fires this same listener,
  // so there's exactly one path that actually flips `open` closed.
  useEffect(() => {
    if (!open) return;
    window.history.pushState({ photoViewer: true }, "");
    function handlePopState() {
      onCloseRef.current();
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [open]);

  function requestClose() {
    window.history.back();
  }

  const slides: HostelSlide[] = images.map((image) => ({
    src: image.url,
    alt,
    blurDataURL: image.blurDataURL,
  }));

  return (
    <Lightbox
      open={open}
      close={requestClose}
      index={startIndex}
      slides={slides}
      plugins={[Zoom, Counter]}
      animation={{
        fade: shouldReduceMotion ? 0 : 280,
        swipe: shouldReduceMotion ? 0 : 280,
        easing: { fade: SIGNATURE_EASE, swipe: SIGNATURE_EASE, navigation: SIGNATURE_EASE },
      }}
      controller={{ closeOnPullDown: true, closeOnBackdropClick: true }}
      render={{
        slideContainer: ({ slide, children }) => {
          const blurDataURL = (slide as HostelSlide).blurDataURL;
          return (
            <div
              style={{
                width: "100%",
                height: "100%",
                backgroundImage: blurDataURL ? `url(${blurDataURL})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              {children}
            </div>
          );
        },
      }}
    />
  );
}
