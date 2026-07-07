"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, MessageSquare, Pin, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { BuzzPostCard } from "@/components/buzz/buzz-post-card";
import { ComposeBuzzSheet } from "@/components/buzz/compose-buzz-sheet";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useBuzzFeed } from "@/hooks/use-buzz-feed";
import { usePinnedBuzzPosts } from "@/hooks/use-pinned-buzz-posts";
import { useAuth } from "@/providers/auth-provider";

export default function BuzzPage() {
  const { requireAuth } = useAuth();
  const [composeOpen, setComposeOpen] = useState(false);

  // Same first-paint / infinite-scroll guards as home-feed.tsx.
  const isFirstPaintRef = useRef(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);

  const pinnedQuery = usePinnedBuzzPosts();
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useBuzzFeed();

  useEffect(() => {
    isFirstPaintRef.current = false;
  }, []);

  useEffect(() => {
    fetchingRef.current = isFetchingNextPage;
  }, [isFetchingNextPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !fetchingRef.current) fetchNextPage();
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, fetchNextPage]);

  const posts = useMemo(() => data?.pages.flatMap((page) => page.posts) ?? [], [data]);
  const pinnedPosts = pinnedQuery.data ?? [];

  async function handleRefresh() {
    await Promise.all([refetch(), pinnedQuery.refetch()]);
  }

  return (
    <div className="mx-auto max-w-lg">
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="flex flex-col gap-4 px-4 py-5">
          <h1 className="font-display text-h1 text-ink-900">Buzz</h1>

          {pinnedPosts.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-ink-500">
                <Pin className="size-3.5" />
                Pinned
              </div>
              <div className="flex flex-col gap-3">
                {pinnedPosts.map((post, i) => (
                  <BuzzPostCard key={post.id} post={post} index={i} animateIn={!isFirstPaintRef.current} />
                ))}
              </div>
            </div>
          )}

          {isPending ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <EmptyState
              icon={<AlertCircle className="size-7" strokeWidth={1.75} />}
              title="Couldn't load Buzz"
              description="Check your connection and try again."
              actionLabel="Retry"
              onAction={() => refetch()}
              className="bg-surface shadow-card"
            />
          ) : posts.length === 0 && pinnedPosts.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="size-7" strokeWidth={1.75} />}
              title="No posts yet"
              description="Be the first to share something about hostels near UMaT."
              actionLabel="Post something"
              onAction={() => requireAuth(() => setComposeOpen(true))}
              className="bg-surface shadow-card"
            />
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {posts.map((post, i) => (
                  <BuzzPostCard key={post.id} post={post} index={i} animateIn={!isFirstPaintRef.current} />
                ))}
              </div>

              <div ref={sentinelRef} aria-hidden className="h-1" />

              {isFetchingNextPage && (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-32 w-full rounded-lg" />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </PullToRefresh>

      <button
        type="button"
        aria-label="New post"
        onClick={() => requireAuth(() => setComposeOpen(true))}
        className="fixed right-4 z-40 flex size-14 items-center justify-center rounded-full bg-gold-500 text-ink-900 shadow-md transition-transform active:scale-95"
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        <Plus className="size-6" />
      </button>

      <ComposeBuzzSheet open={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  );
}
