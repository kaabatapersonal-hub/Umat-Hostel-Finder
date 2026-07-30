"use client";

import { createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { useToast } from "@/components/ui/toast";
import { playSound } from "@/lib/sounds";
import { BuzzPostExportCard } from "@/components/buzz/buzz-post-export-card";
import type { BuzzPost } from "@/lib/queries/buzz";

const EXPORT_WIDTH_PX = 1080;

// "Save" on a Buzz post means "download it as a shareable image," not a
// private bookmark (see BuzzPostExportCard's own comment) -- captures a
// clean, branded, off-screen render of the post with html2canvas, then
// hands the result to the native share sheet (mobile, so it can go
// straight to WhatsApp status / Instagram stories) or a plain download
// link (desktop). No database changes -- purely client-side.
export function useSaveBuzzPostImage() {
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  async function saveAsImage(post: BuzzPost, options: { isAuthorVerified?: boolean } = {}) {
    if (isSaving) return;
    setIsSaving(true);

    // Rendered off-screen (not display:none -- html2canvas needs real
    // layout to measure) rather than in a visible modal, since there's
    // nothing for the user to look at during capture.
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = `${EXPORT_WIDTH_PX}px`;
    container.style.pointerEvents = "none";
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      const { default: html2canvas } = await import("html2canvas");

      await new Promise<void>((resolve) => {
        root.render(createElement(BuzzPostExportCard, { post, isAuthorVerified: options.isAuthorVerified }));
        // Two animation frames: one for React's commit, one for the
        // browser to finish layout/paint (fonts, computed styles) before
        // html2canvas snapshots the DOM.
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      const target = container.firstElementChild as HTMLElement | null;
      if (!target) throw new Error("Export card failed to render");

      const canvas = await html2canvas(target, { backgroundColor: "#ffffff", scale: 2, useCORS: true });
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Failed to render image");

      const file = new File([blob], "campa-buzz-post.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        playSound("save");
        showToast({ message: "Post saved!", variant: "success" });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "campa-buzz-post.png";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        playSound("save");
        showToast({ message: "Post downloaded!", variant: "success" });
      }
    } catch (err) {
      // A cancelled native share sheet throws AbortError -- not a failure.
      if (!(err instanceof Error && err.name === "AbortError")) {
        showToast({ message: "Couldn't save the image — try again?", variant: "error" });
      }
    } finally {
      root.unmount();
      container.remove();
      setIsSaving(false);
    }
  }

  return { saveAsImage, isSaving };
}
