"use client";

import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useSavedHostels } from "@/hooks/use-saved-hostels";
import { useToggleSave } from "@/hooks/use-toggle-save";
import type { SaveableHostelInput } from "@/lib/queries/saved-hostels";

export interface SaveHeartButtonProps {
  hostel: SaveableHostelInput;
  className?: string;
}

export function SaveHeartButton({ hostel, className }: SaveHeartButtonProps) {
  const { user, requireAuth } = useAuth();
  const { data: saved = [] } = useSavedHostels();
  const toggle = useToggleSave();

  const isSaved = !!user && saved.some((h) => h.hostelId === hostel.id);

  function handleTap(e: React.MouseEvent) {
    // Cards wrap this in a <Link> — don't let the tap also navigate.
    e.preventDefault();
    e.stopPropagation();
    requireAuth(() => {
      toggle.mutate({ hostel, isSaved });
    });
  }

  return (
    <motion.button
      type="button"
      aria-label={isSaved ? "Remove from saved" : "Save hostel"}
      aria-pressed={isSaved}
      onClick={handleTap}
      whileTap={{ scale: [1, 1.25, 1] }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex size-11 items-center justify-center rounded-full bg-ink-900/40 text-white backdrop-blur-sm",
        className
      )}
    >
      <Heart className={cn("size-5", isSaved && "fill-gold-500 text-gold-500")} />
    </motion.button>
  );
}
