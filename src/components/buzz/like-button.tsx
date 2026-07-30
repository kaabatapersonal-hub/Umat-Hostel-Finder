"use client";

import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LikeButtonProps {
  liked: boolean;
  displayCount: number;
  // Bumped by the parent card every time a fresh *like* (never an unlike)
  // lands, whether triggered by tapping this button or by double-tapping
  // the card -- both need to share one pulse trigger, so the card owns
  // the toggle mutation and this component is purely presentational (see
  // buzz-post-card.tsx's handleLikeToggle).
  pulseKey: number;
  onTap: (e: React.MouseEvent) => void;
}

export const BUZZ_LIKE_JOIN_MESSAGE = "Join Campa to like posts on Buzz";

export function LikeButton({ liked, displayCount, pulseKey, onTap }: LikeButtonProps) {
  return (
    <button
      type="button"
      aria-label={liked ? "Unlike this post" : "Like this post"}
      aria-pressed={liked}
      onClick={onTap}
      className="flex items-center gap-1 rounded-pill px-2 py-1 text-caption font-medium transition-colors"
    >
      <motion.span
        key={pulseKey}
        initial={pulseKey > 0 ? { scale: 1 } : false}
        animate={pulseKey > 0 ? { scale: [1, 1.35, 1] } : undefined}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex"
      >
        {/* Deliberately bigger than every other action-row icon -- liking
            is the primary action here, and should read as the visual
            anchor of the row, not just another same-sized icon. */}
        <Flame className={cn("size-6", liked ? "fill-gold-500 text-gold-500" : "text-[#94A3B8]")} strokeWidth={1.75} />
      </motion.span>
      {displayCount > 0 && <span className={liked ? "text-gold-600" : "text-ink-500"}>{displayCount}</span>}
    </button>
  );
}
