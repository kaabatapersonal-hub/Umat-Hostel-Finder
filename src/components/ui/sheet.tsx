"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

// A bottom sheet, not a centered modal — thumb-reachable, matches the app's
// mobile-first ethos. Used for anything that interrupts a mid-browse
// moment (the auth prompt today, others later) rather than yanking the
// user to a separate page.
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden
            className="fixed inset-0 z-[60] bg-ink-900/50"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={shouldReduceMotion ? { opacity: 0 } : { y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { y: "100%", opacity: 0.6 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "fixed inset-x-0 bottom-0 z-[61] max-h-[85vh] overflow-y-auto rounded-t-lg bg-surface p-6 shadow-md",
              className
            )}
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-pill bg-line" />
            <div className="mb-4 flex items-center justify-between gap-3">
              {title && <h2 className="font-display text-h1 text-ink-900">{title}</h2>}
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="ml-auto flex size-8 items-center justify-center rounded-full text-ink-500 hover:bg-surface-muted"
              >
                <X className="size-5" />
              </button>
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
