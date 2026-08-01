"use client";

import { Forward } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { joinCampaPitch } from "@/lib/share-message";

export interface ShareButtonProps {
  postId: string;
  content: string;
}

const SHARE_TEXT_MAX_LENGTH = 100;

// window.location.origin, not a getSiteUrl()-style env lookup -- this
// only ever runs client-side (the Web Share API and clipboard both
// require it), and the browser's own origin is always correct for
// whatever deployment/preview URL the visitor is actually on, with no
// dependency on NEXT_PUBLIC_SITE_URL being set right.
function buildShareUrl(postId: string): string {
  return `${window.location.origin}/buzz/${postId}`;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// No database change, no count -- sharing doesn't track or store
// anything (per the brief). Native share sheet where available
// (primarily how students will actually share -- straight to WhatsApp),
// clipboard-copy + toast fallback everywhere else.
export function ShareButton({ postId, content }: ShareButtonProps) {
  const { showToast } = useToast();

  async function handleTap(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const url = buildShareUrl(postId);
    const text = `${truncate(content, SHARE_TEXT_MAX_LENGTH)}${joinCampaPitch()}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Check out this post on Campa Buzz",
          text,
          url,
        });
      } catch (err) {
        // AbortError just means the user closed the native share sheet
        // without picking anything -- not a failure worth a toast over.
        if (err instanceof Error && err.name !== "AbortError") {
          showToast({ message: "Couldn't share — try again?", variant: "error" });
        }
      }
      return;
    }

    try {
      // Clipboard has no separate text/url fields -- fold the pitch in
      // ahead of the link so pasting elsewhere still carries the message.
      await navigator.clipboard.writeText(`${text}\n${url}`);
      showToast({ message: "Link copied!", variant: "success" });
    } catch {
      showToast({ message: "Couldn't copy the link — try again?", variant: "error" });
    }
  }

  return (
    <button
      type="button"
      aria-label="Share this post"
      onClick={handleTap}
      className="flex items-center gap-1 rounded-pill px-2 py-1 text-caption font-medium text-[#94A3B8] transition-colors"
    >
      <Forward className="size-4" strokeWidth={1.75} />
    </button>
  );
}
