"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useToggleBuzzBookmark } from "@/hooks/use-toggle-buzz-bookmark";
import { triggerHaptic } from "@/lib/haptics";

export interface BookmarkButtonProps {
  postId: string;
  bookmarkCount: number;
  // Resolved by the caller (one batched useMyBookmarkedPosts call for
  // every post on screen), same pattern as LikeButton's isLiked.
  isBookmarked: boolean;
}

const BUZZ_BOOKMARK_JOIN_MESSAGE = "Join Campa to save posts";

// Same short-lived local-override optimistic pattern as LikeButton --
// see that component's own comment for the full reasoning.
export function BookmarkButton({ postId, bookmarkCount, isBookmarked }: BookmarkButtonProps) {
  const { requireAuth } = useAuth();
  const toggle = useToggleBuzzBookmark(postId);
  const [localOverride, setLocalOverride] = useState<boolean | null>(null);

  const bookmarked = localOverride ?? isBookmarked;
  const displayCount =
    bookmarkCount + (localOverride === null || localOverride === isBookmarked ? 0 : localOverride ? 1 : -1);

  function handleTap(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    requireAuth(
      () => {
        triggerHaptic();
        const next = !bookmarked;
        setLocalOverride(next);
        toggle.mutate(next, { onSettled: () => setLocalOverride(null) });
      },
      { message: BUZZ_BOOKMARK_JOIN_MESSAGE }
    );
  }

  return (
    <button
      type="button"
      aria-label={bookmarked ? "Remove bookmark" : "Save this post"}
      aria-pressed={bookmarked}
      onClick={handleTap}
      className="flex items-center gap-1 rounded-pill px-2 py-1 text-caption font-medium transition-colors"
    >
      <Bookmark className={cn("size-4", bookmarked ? "fill-gold-500 text-gold-500" : "text-[#94A3B8]")} strokeWidth={1.75} />
      {displayCount > 0 && <span className={bookmarked ? "text-gold-600" : "text-ink-500"}>{displayCount}</span>}
    </button>
  );
}
