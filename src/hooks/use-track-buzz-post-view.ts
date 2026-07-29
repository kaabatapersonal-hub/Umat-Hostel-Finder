"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { incrementBuzzView } from "@/lib/queries/buzz";
import { useAuth } from "@/providers/auth-provider";

// Module-level, not component/hook state -- deliberately not localStorage/
// sessionStorage either (the brief wants this to reset on every page
// refresh, not persist across visits), and shared across every card's own
// hook instance for the life of this page load, so scrolling back up past
// an already-counted post never double-fires it.
const seenPostIds = new Set<string>();

// Collects post ids for a short window before actually firing anything,
// so scrolling quickly past 10 posts fires one small burst of calls
// together rather than 10 the instant each one crosses the 50% threshold.
// The brief's own RPC is single-post (increment_buzz_view(post_id)), not
// a batch endpoint, so "batching" here means debouncing *when* the calls
// go out, not collapsing them into fewer requests -- the simpler half of
// the brief's explicitly-allowed "individual calls are fine at this
// scale" fallback.
const pendingIds = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(supabase: ReturnType<typeof createClient>) {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const ids = [...pendingIds];
    pendingIds.clear();
    for (const id of ids) {
      // Fire-and-forget -- a failed view-count increment must never
      // surface as an error anywhere in the UI.
      incrementBuzzView(supabase, id).catch(() => {});
    }
  }, 500);
}

// Attach the returned ref to the card element whose visibility should
// count as a view. Only meaningful on feed-rendered cards -- the caller
// passes `enabled: false` for the post detail page's own single-post
// rendering (see buzz-post-card.tsx), since the brief scopes this to
// "each post card in the feed."
export function useTrackBuzzPostView(postId: string, authorId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const { user } = useAuth();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    if (seenPostIds.has(postId)) return;
    // Never count the author's own views of their own post.
    if (user && user.id === authorId) return;

    const supabase = createClient();
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          seenPostIds.add(postId);
          pendingIds.add(postId);
          scheduleFlush(supabase);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [postId, authorId, enabled, user]);

  return ref;
}
