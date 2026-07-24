"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useMyPostReactions } from "@/hooks/use-my-post-reactions";
import { useToggleBuzzReaction } from "@/hooks/use-toggle-buzz-reaction";
import { BUZZ_REACTION_EMOJIS, type BuzzReactionEmoji } from "@/lib/queries/buzz";

export interface ReactionPillsProps {
  postId: string;
  reactionCounts: Partial<Record<BuzzReactionEmoji, number>>;
}

// All 5 pills always render (so a post with zero reactions still has
// something to tap -- otherwise nobody could ever be the first reactor);
// the count number itself only shows once it's above zero, matching the
// "hide zero counts" instruction without making the button disappear.
export function ReactionPills({ postId, reactionCounts }: ReactionPillsProps) {
  const { requireAuth } = useAuth();
  const { data: myReactions = [] } = useMyPostReactions(postId);
  const toggle = useToggleBuzzReaction(postId);
  // A short-lived local override per emoji -- optimistic feel without
  // hand-patching the feed/pinned/single-post query caches this pill's
  // data could have come from. Cleared once the mutation settles, at
  // which point the underlying queries have already been invalidated and
  // refetch with the server's true state (see useToggleBuzzReaction).
  const [localOverride, setLocalOverride] = useState<Partial<Record<BuzzReactionEmoji, boolean>>>({});

  function isActive(emoji: BuzzReactionEmoji): boolean {
    return emoji in localOverride ? !!localOverride[emoji] : myReactions.includes(emoji);
  }

  function displayCount(emoji: BuzzReactionEmoji): number {
    const base = reactionCounts[emoji] ?? 0;
    if (!(emoji in localOverride)) return base;
    const wasActive = myReactions.includes(emoji);
    const nowActive = !!localOverride[emoji];
    return wasActive === nowActive ? base : base + (nowActive ? 1 : -1);
  }

  function handleTap(emoji: BuzzReactionEmoji) {
    requireAuth(() => {
      const next = !isActive(emoji);
      setLocalOverride((prev) => ({ ...prev, [emoji]: next }));
      toggle.mutate(emoji, {
        onSettled: () =>
          setLocalOverride((prev) => {
            const rest = { ...prev };
            delete rest[emoji];
            return rest;
          }),
      });
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {BUZZ_REACTION_EMOJIS.map((emoji) => {
        const active = isActive(emoji);
        const count = displayCount(emoji);
        return (
          <button
            key={emoji}
            type="button"
            aria-label={`React with ${emoji}`}
            aria-pressed={active}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleTap(emoji);
            }}
            className={cn(
              "flex items-center gap-1 rounded-pill px-2 py-1 text-caption font-medium transition-colors",
              active ? "bg-gold-50 text-gold-600" : "bg-surface-muted text-ink-500"
            )}
          >
            <span>{emoji}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
