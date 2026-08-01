"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { shouldShowUsernameNudge, dismissUsernameNudge } from "@/lib/nudges";

// Same visual/interaction shape as BrowsingNudgeBanner -- gentle,
// dismissible, never a wall. Only ever relevant for accounts created
// before username-at-signup existed (or anyone who skipped it back when
// it was still optional at signup); a brand new account already has one.
export function UsernameNudgeBanner() {
  const { user, profile } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!user || !profile || dismissed || !shouldShowUsernameNudge(!!profile.username)) return null;

  function handleDismiss() {
    dismissUsernameNudge();
    setDismissed(true);
  }

  return (
    <div className="flex items-center gap-3 rounded-md bg-gold-50 px-4 py-3 shadow-card">
      <span className="flex-1 text-body-sm text-ink-900">
        💛 Add a username so other students recognize you on Buzz and Marketplace.
      </span>
      <Link href="/profile/edit" className="shrink-0 rounded-pill bg-brand-800 px-3.5 py-1.5 text-body-sm font-medium text-white">
        Set it up
      </Link>
      <button type="button" aria-label="Dismiss" onClick={handleDismiss} className="shrink-0 text-ink-300">
        <X className="size-4" />
      </button>
    </div>
  );
}
