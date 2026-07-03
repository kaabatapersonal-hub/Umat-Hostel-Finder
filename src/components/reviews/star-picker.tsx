"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface StarPickerProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export function StarPicker({ value, onChange, className }: StarPickerProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value;

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="radiogroup"
      aria-label="Rating"
      onMouseLeave={() => setHovered(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          whileTap={{ scale: 1.2 }}
          onMouseEnter={() => setHovered(star)}
          onClick={() => onChange(star)}
          className="p-0.5"
        >
          <Star className={cn("size-8", star <= display ? "fill-gold-500 text-gold-500" : "text-ink-300")} />
        </motion.button>
      ))}
    </div>
  );
}
