"use client";

import { useState } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useToggleBuzzLike } from "@/hooks/use-toggle-buzz-like";
import { triggerHaptic } from "@/lib/haptics";

export interface LikeButtonProps {
  postId: string;
  likeCount: number;
  // Resolved by the caller (one batched useMyLikedPosts call for every
  // post on screen, same shape as isAuthorVerified) rather than fetched
  // per-card.
  isLiked: boolean;
}

const BUZZ_LIKE_JOIN_MESSAGE = "Join Campa to like posts on Buzz";

// A short-lived local override, same pattern the 5-emoji reaction pills
// this replaces used -- optimistic feel without hand-patching the feed's/
// hot feed's/pinned-posts'/single-post's four independent query caches.
// Cleared once the mutation settles, at which point useToggleBuzzLike's
// own invalidation has already brought the server's true state back in.
export function LikeButton({ postId, likeCount, isLiked }: LikeButtonProps) {
  const { requireAuth } = useAuth();
  const toggle = useToggleBuzzLike(postId);
  const [localOverride, setLocalOverride] = useState<boolean | null>(null);

  const liked = localOverride ?? isLiked;
  const displayCount = likeCount + (localOverride === null || localOverride === isLiked ? 0 : localOverride ? 1 : -1);

  function handleTap(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    requireAuth(
      () => {
        triggerHaptic();
        const next = !liked;
        setLocalOverride(next);
        toggle.mutate(next, { onSettled: () => setLocalOverride(null) });
      },
      { message: BUZZ_LIKE_JOIN_MESSAGE }
    );
  }

  return (
    <button
      type="button"
      aria-label={liked ? "Unlike this post" : "Like this post"}
      aria-pressed={liked}
      onClick={handleTap}
      className="flex items-center gap-1 rounded-pill px-2 py-1 text-caption font-medium transition-colors"
    >
      <Flame className={cn("size-4", liked ? "fill-gold-500 text-gold-500" : "text-[#94A3B8]")} strokeWidth={1.75} />
      {displayCount > 0 && <span className={liked ? "text-gold-600" : "text-ink-500"}>{displayCount}</span>}
    </button>
  );
}
