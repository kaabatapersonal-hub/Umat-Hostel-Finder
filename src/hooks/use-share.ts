"use client";

import { useState } from "react";

// Native share sheet where available, clipboard-copy fallback otherwise --
// pulled out once a second page (the seller sale page) needed the exact
// same behavior the listing detail page already had.
export function useShare() {
  const [copied, setCopied] = useState(false);

  async function share(title: string, url: string, text?: string) {
    if (navigator.share) {
      try {
        await navigator.share({ title, url, text });
      } catch {
        // User dismissed the share sheet -- not an error worth surfacing.
      }
      return;
    }
    try {
      // Clipboard has no separate title/text/url fields the way the Web
      // Share API does -- fold text in ahead of the url (if given) so
      // pasting into WhatsApp/anywhere else still carries the full
      // message, not just a bare link.
      await navigator.clipboard.writeText(text ? `${text}\n${url}` : url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (permissions, insecure context) --
      // silently do nothing rather than show a broken share affordance.
    }
  }

  return { share, copied };
}
