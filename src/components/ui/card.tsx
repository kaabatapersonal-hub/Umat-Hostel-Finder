"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export interface CardProps extends Omit<HTMLMotionProps<"div">, "ref" | "children"> {
  interactive?: boolean;
  children?: React.ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive = false, children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        whileTap={interactive ? { scale: 0.98 } : undefined}
        whileHover={interactive ? { y: -2, boxShadow: "var(--shadow-md)" } : undefined}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "bg-surface rounded-lg shadow-card overflow-hidden",
          interactive && "cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = "Card";
