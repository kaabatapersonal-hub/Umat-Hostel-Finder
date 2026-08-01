"use client";

import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useSavedMarketListings } from "@/hooks/use-saved-market-listings";
import { useToggleMarketSave } from "@/hooks/use-toggle-market-save";
import { triggerHaptic } from "@/lib/haptics";
import type { SaveableListingInput } from "@/lib/queries/saved-market-listings";

export interface SaveListingHeartButtonProps {
  listing: SaveableListingInput;
  className?: string;
  // "sm" for the denser feed grid cards, "lg" to match the full-bleed
  // detail gallery's own back-button size (same size-11/size-5 hostels'
  // SaveHeartButton uses everywhere, since that gallery has more room).
  size?: "sm" | "lg";
}

export function SaveListingHeartButton({ listing, className, size = "sm" }: SaveListingHeartButtonProps) {
  const { user, requireAuth } = useAuth();
  const { data: saved = [] } = useSavedMarketListings();
  const toggle = useToggleMarketSave();

  const isSaved = !!user && saved.some((l) => l.listingId === listing.id);

  function handleTap(e: React.MouseEvent) {
    // Cards wrap this in a <Link> -- don't let the tap also navigate.
    e.preventDefault();
    e.stopPropagation();
    triggerHaptic();
    requireAuth(() => {
      toggle.mutate({ listing, isSaved });
    });
  }

  return (
    <motion.button
      type="button"
      aria-label={isSaved ? "Remove from saved" : "Save listing"}
      aria-pressed={isSaved}
      onClick={handleTap}
      whileTap={{ scale: [1, 1.25, 1] }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex items-center justify-center rounded-full bg-ink-900/40 text-white backdrop-blur-sm",
        size === "lg" ? "size-11" : "size-9",
        className
      )}
    >
      <Heart className={cn(size === "lg" ? "size-5" : "size-4", isSaved && "fill-gold-500 text-gold-500")} />
    </motion.button>
  );
}
