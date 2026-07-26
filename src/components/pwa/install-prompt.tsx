"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Share, SquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstallPrompt } from "@/hooks/use-pwa-install-prompt";

// The same house-in-pin mark as the cold-launch splash (layout.tsx) --
// one brand icon, not a second logo asset to keep in sync.
function AppMark() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="size-14 shrink-0">
      <rect width="512" height="512" rx="118" fill="#0E4A34" />
      <path
        d="M256 79 C177 79 118 138 118 217 C118 310 256 443 256 443 C256 443 394 310 394 217 C394 138 335 79 256 79 Z"
        fill="#E8A33D"
      />
      <path d="M256 148 L335 217 L310 217 L310 286 L202 286 L202 217 L177 217 Z" fill="#0E4A34" />
    </svg>
  );
}

// A centered modal, deliberately not the app's usual bottom Sheet -- this
// interrupts a first visit rather than a mid-browse action, and reads more
// like "here's a suggestion" front-and-center than "you tapped something."
export function InstallPrompt() {
  const { open, platform, install, dismiss } = usePwaInstallPrompt();
  const shouldReduceMotion = useReducedMotion();

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
              role="dialog"
              aria-modal="true"
              aria-label="Install Campa"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 8 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-sm rounded-lg bg-surface p-6 shadow-md"
            >
              <button
                type="button"
                aria-label="Close"
                onClick={dismiss}
                className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full text-ink-500 hover:bg-surface-muted"
              >
                <X className="size-5" />
              </button>

              <div className="flex flex-col items-center gap-3 pt-2 text-center">
                <AppMark />
                <h2 className="font-display text-h1 text-ink-900">Install Campa</h2>

                {platform === "ios" ? (
                  <>
                    <p className="text-body-sm text-ink-500">
                      Add Campa to your Home Screen for quick access, full-screen, next time.
                    </p>
                    <div className="mt-1 flex w-full flex-col gap-2 rounded-md bg-surface-muted p-3 text-left text-body-sm text-ink-900">
                      <span className="flex items-center gap-2">
                        <Share className="size-4 shrink-0 text-brand-800" />
                        Tap the Share icon in your browser bar
                      </span>
                      <span className="flex items-center gap-2">
                        <SquarePlus className="size-4 shrink-0 text-brand-800" />
                        Then choose &quot;Add to Home Screen&quot;
                      </span>
                    </div>
                    <Button variant="secondary" size="lg" onClick={dismiss} className="mt-2 w-full">
                      Got it
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-body-sm text-ink-500">
                      Add Campa to your home screen for quick access, faster loading, and no browser address bar.
                    </p>
                    <Button variant="primary" size="lg" onClick={install} className="mt-2 w-full">
                      Install app
                    </Button>
                    <Button variant="ghost" size="md" onClick={dismiss} className="w-full">
                      Not now
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
