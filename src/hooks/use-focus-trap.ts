"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Keeps Tab/Shift+Tab cycling inside the dialog instead of escaping into
// the page behind it -- the body scroll lock stops background *scrolling*,
// but without this, keyboard/screen-reader users could still Tab their way
// into content that's supposed to be inert while the dialog is open.
// Moves focus in on open and restores it to whatever triggered the dialog
// on close, matching standard role="dialog" behavior.
export function useFocusTrap<T extends HTMLElement = HTMLElement>(active: boolean) {
  const containerRef = useRef<T | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    triggerRef.current = document.activeElement as HTMLElement | null;

    // Respect focus an element already grabbed on mount (e.g. a field
    // with autoFocus) -- only move focus ourselves if nothing inside the
    // dialog is focused yet, so this never fights a sheet's own explicit
    // "focus the input" behavior. Otherwise focus the dialog container
    // itself (it's given tabIndex={-1} for exactly this), not "the first
    // focusable descendant" -- every sheet in this app renders its own
    // Close (X) button before any real content, so grabbing the first
    // focusable element would land there instead of announcing the
    // dialog and letting the next Tab reach real content naturally.
    const container = containerRef.current;
    if (container && !container.contains(document.activeElement)) {
      container.focus({ preventScroll: true });
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !containerRef.current) return;
      const focusable = Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus({ preventScroll: true });
    };
  }, [active]);

  return containerRef;
}
