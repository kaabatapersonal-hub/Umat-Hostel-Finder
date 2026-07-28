"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  actionLabel?: string;
  onAction?: () => void;
}

export interface ShowToastInput {
  message: string;
  variant?: ToastVariant;
  // An optional inline action -- e.g. "Retry" on a failed optimistic post.
  // Tapping it both runs the callback and dismisses the toast.
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (input: ShowToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 3500;

// A fixed-position stack at the top of the screen, same non-portal "fixed
// + framer-motion AnimatePresence" idiom as Sheet -- top rather than
// bottom so it never fights with BottomNav, an open Sheet, or the
// on-screen keyboard docking the reply bar, all of which already own the
// bottom of the viewport. One provider, mounted once in the root layout;
// every mutation/action in the app calls useToast() rather than each
// owning its own notification UI.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const shouldReduceMotion = useReducedMotion();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback<ToastContextValue["showToast"]>(
    ({ message, variant = "info", actionLabel, onAction, durationMs = DEFAULT_DURATION_MS }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, message, variant, actionLabel, onAction }]);
      const timer = setTimeout(() => dismiss(id), durationMs);
      timersRef.current.set(id, timer);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex flex-col items-center gap-2 px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.96 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-md bg-ink-900 px-4 py-3 text-body-sm text-white shadow-md"
            >
              {toast.variant === "success" ? (
                <CheckCircle2 className="size-4 shrink-0 text-gold-500" />
              ) : toast.variant === "error" ? (
                // Not text-danger (#c4462f) -- that shade is tuned for
                // dark text on a light card, not an icon on this toast's
                // dark ink-900 surface, where it reads too muted. A
                // lighter coral keeps it legible without needing a whole
                // second danger token just for this one dark context.
                <AlertCircle className="size-4 shrink-0 text-[#e8735a]" />
              ) : null}
              <span className="flex-1">{toast.message}</span>
              {toast.actionLabel && toast.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    toast.onAction?.();
                    dismiss(toast.id);
                  }}
                  className="shrink-0 font-medium text-gold-500 underline underline-offset-2"
                >
                  {toast.actionLabel}
                </button>
              )}
              <button type="button" aria-label="Dismiss" onClick={() => dismiss(toast.id)} className="shrink-0 text-white/60">
                <X className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
