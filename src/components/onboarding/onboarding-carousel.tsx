"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Building2, MessageSquare, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useFocusTrap } from "@/hooks/use-focus-trap";

const SLIDES = [
  {
    icon: Building2,
    title: "Find your next hostel",
    description: "Browse hostels near UMaT, compare prices and facilities, and save your favorites for later.",
  },
  {
    icon: MessageSquare,
    title: "Join the conversation",
    description: "Buzz is UMaT's own housing community — ask questions, share tips, and find roommates.",
  },
  {
    icon: ShoppingBag,
    title: "Buy, sell, and trade",
    description: "The Marketplace is where students trade textbooks, furniture, and more with each other.",
  },
];

// A centered modal, same posture as InstallPrompt -- this interrupts a
// first visit rather than a mid-browse action.
export function OnboardingCarousel() {
  const { open, dismiss } = useOnboarding();
  const [index, setIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const dialogRef = useFocusTrap<HTMLDivElement>(open);
  useBodyScrollLock(open);
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  function handleClose() {
    setIndex(0);
    dismiss();
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden
            className="fixed inset-0 z-[70] bg-ink-900/50"
          />
          <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Welcome to Campa"
              tabIndex={-1}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex w-full max-w-sm flex-col items-center gap-5 rounded-lg bg-surface p-6 text-center shadow-md"
            >
              <button
                type="button"
                aria-label="Skip"
                onClick={handleClose}
                className="absolute right-3 top-3 text-body-sm font-medium text-ink-500"
              >
                Skip
              </button>

              <div className="flex size-16 items-center justify-center rounded-full bg-brand-50 text-brand-800">
                <slide.icon className="size-8" strokeWidth={1.75} />
              </div>

              <div className="flex flex-col gap-1.5">
                <h2 className="font-display text-h1 text-ink-900">{slide.title}</h2>
                <p className="text-body text-ink-500">{slide.description}</p>
              </div>

              <div className="flex items-center gap-1.5">
                {SLIDES.map((_, i) => (
                  <span
                    key={i}
                    className={cn("h-1.5 rounded-pill transition-all", i === index ? "w-4 bg-brand-800" : "w-1.5 bg-line")}
                  />
                ))}
              </div>

              <Button
                variant="accent"
                size="lg"
                className="w-full"
                onClick={() => (isLast ? handleClose() : setIndex((i) => i + 1))}
              >
                {isLast ? "Get Started" : "Next"}
              </Button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
