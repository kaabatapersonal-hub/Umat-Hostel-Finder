"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-lg px-6 py-12 text-center",
        className
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-800">
        {icon}
      </div>
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-h1 text-ink-900">{title}</h2>
        <p className="max-w-xs text-body text-ink-500">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button variant="accent" onClick={onAction} className="mt-1">
          {actionLabel}
        </Button>
      )}
    </motion.div>
  );
}
