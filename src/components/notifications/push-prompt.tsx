"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushPrompt } from "@/hooks/use-push-prompt";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { useFocusTrap } from "@/hooks/use-focus-trap";

// A centered modal, same posture as InstallPrompt/OnboardingCarousel --
// this interrupts an app open, not a mid-browse action. Deliberately
// never says "push notifications" -- that's a technical term, not
// something a student reads and immediately understands the value of.
export function PushPrompt() {
  const { open, dismiss, accept } = usePushPrompt();
  const shouldReduceMotion = useReducedMotion();
  const dialogRef = useFocusTrap<HTMLDivElement>(open);
  useBodyScrollLock(open);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            onClick={dismiss}
            aria-hidden
            className="fixed inset-0 z-[70] bg-ink-900/50"
          />
          <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label="Turn on notifications"
              tabIndex={-1}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex w-full max-w-sm flex-col items-center gap-4 rounded-lg bg-surface p-6 text-center shadow-md"
            >
              <div className="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-800">
                <Bell className="size-7" strokeWidth={1.75} />
              </div>

              <div className="flex flex-col gap-1.5">
                <h2 className="font-display text-h1 text-ink-900">Stay in the loop?</h2>
                <p className="text-body text-ink-500">
                  Get a heads-up when someone replies to you or when there&apos;s something new on Campa — even when
                  the app isn&apos;t open. You can turn this off anytime.
                </p>
              </div>

              <Button variant="accent" size="lg" className="w-full" onClick={accept}>
                Yes, notify me
              </Button>
              <Button variant="ghost" size="md" className="w-full" onClick={dismiss}>
                Not now
              </Button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
