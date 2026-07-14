"use client";

import { useState } from "react";

// Native share sheet where available, clipboard-copy fallback otherwise --
// pulled out once a second page (the seller sale page) needed the exact
// same behavior the listing detail page already had.
export function useShare() {
  const [copied, setCopied] = useState(false);

  async function share(title: string, url: string) {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User dismissed the share sheet -- not an error worth surfacing.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (permissions, insecure context) --
      // silently do nothing rather than show a broken share affordance.
    }
  }

  return { share, copied };
}
