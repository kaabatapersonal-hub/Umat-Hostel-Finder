"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Flame, Clock, MessageSquare, Pin, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { BuzzPostCard } from "@/components/buzz/buzz-post-card";
import { ComposeBuzzSheet } from "@/components/buzz/compose-buzz-sheet";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { useBuzzFeed } from "@/hooks/use-buzz-feed";
import { useHotBuzzFeed } from "@/hooks/use-hot-buzz-feed";
import { usePinnedBuzzPosts } from "@/hooks/use-pinned-buzz-posts";
import { useVerifiedProfiles } from "@/hooks/use-verified-profiles";
import { useMyLikedPosts } from "@/hooks/use-my-liked-posts";
import { useMyBuzzReports } from "@/hooks/use-my-buzz-reports";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

const BUZZ_JOIN_MESSAGE = "Join Campa to post on Buzz — share hostel tips, find roommates, ask questions";
const BUZZ_TAB_STORAGE_KEY = "campa-buzz-tab";

type BuzzTab = "hot" | "new";

export default function BuzzPage() {
  const { requireAuth } = useAuth();
  const [composeOpen, setComposeOpen] = useState(false);
  // Starts at "hot" (the default, and what a static/SSR render always
  // produces) and only ever syncs from sessionStorage inside an effect --
  // reading it during the initial render would make the client's first
  // render disagree with the server-rendered HTML the moment a returning
  // visitor's stored tab differs from the default, which React treats as
  // a hydration mismatch. A one-frame flash to the stored tab is the
  // accepted tradeoff, same posture as every other client-only-state read
  // in this app (see use-pwa-install-prompt.ts).
  const [activeTab, setActiveTab] = useState<BuzzTab>("hot");

  useEffect(() => {
    const stored = window.sessionStorage.getItem(BUZZ_TAB_STORAGE_KEY);
    if (stored === "hot" || stored === "new") setActiveTab(stored);
  }, []);

  function handleTabChange(tab: BuzzTab) {
    setActiveTab(tab);
    window.sessionStorage.setItem(BUZZ_TAB_STORAGE_KEY, tab);
  }

  // Same first-paint / infinite-scroll guards as home-feed.tsx.
  const isFirstPaintRef = useRef(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchingRef = useRef(false);

  const pinnedQuery = usePinnedBuzzPosts();
  // Only the active tab's query is enabled -- no reason to double the
  // network cost fetching both feeds' first pages when only one is ever
  // on screen (see useBuzzFeed/useHotBuzzFeed's own comments).
  const newFeed = useBuzzFeed({ enabled: activeTab === "new" });
  const hotFeed = useHotBuzzFeed({ enabled: activeTab === "hot" });
  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    activeTab === "hot" ? hotFeed : newFeed;

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
  const pinnedPosts = useMemo(() => pinnedQuery.data ?? [], [pinnedQuery.data]);

  const authorIds = useMemo(() => [...pinnedPosts, ...posts].map((p) => p.authorId), [pinnedPosts, posts]);
  const postIds = useMemo(() => [...pinnedPosts, ...posts].map((p) => p.id), [pinnedPosts, posts]);
  const { data: verifiedMap } = useVerifiedProfiles(authorIds);
  const { data: likedPostIds } = useMyLikedPosts(postIds);
  const { data: myReports } = useMyBuzzReports();

  async function handleRefresh() {
    await Promise.all([refetch(), pinnedQuery.refetch()]);
  }

  function renderPost(post: (typeof posts)[number], i: number) {
    return (
      <BuzzPostCard
        key={post.id}
        post={post}
        index={i}
        animateIn={!isFirstPaintRef.current}
        isAuthorVerified={verifiedMap?.has(post.authorId) ?? false}
        authorVerificationLabel={verifiedMap?.get(post.authorId) ?? null}
        isLiked={likedPostIds?.has(post.id) ?? false}
        isReported={myReports?.postIds.has(post.id) ?? false}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <PullToRefresh onRefresh={handleRefresh}>
        <div className="flex flex-col gap-4 px-4 py-5">
          <h1 className="font-display text-h1 text-ink-900">Buzz</h1>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => handleTabChange("hot")}
              className={cn(
                "flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-body-sm font-medium transition-colors",
                activeTab === "hot" ? "bg-brand-800 text-white" : "bg-surface-muted text-ink-500"
              )}
            >
              <Flame className="size-3.5" />
              Hot
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("new")}
              className={cn(
                "flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-body-sm font-medium transition-colors",
                activeTab === "new" ? "bg-brand-800 text-white" : "bg-surface-muted text-ink-500"
              )}
            >
              <Clock className="size-3.5" />
              New
            </button>
          </div>

          {pinnedPosts.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wide text-ink-500">
                <Pin className="size-3.5" />
                Pinned
              </div>
              <div className="flex flex-col gap-3">{pinnedPosts.map((post, i) => renderPost(post, i))}</div>
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
              onAction={() => requireAuth(() => setComposeOpen(true), { message: BUZZ_JOIN_MESSAGE })}
              className="bg-surface shadow-card"
            />
          ) : (
            <>
              <div className="flex flex-col gap-3">{posts.map((post, i) => renderPost(post, i))}</div>

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
        onClick={() => requireAuth(() => setComposeOpen(true), { message: BUZZ_JOIN_MESSAGE })}
        className="fixed right-4 z-40 flex size-14 items-center justify-center rounded-full bg-gold-500 text-ink-900 shadow-md transition-transform active:scale-95"
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }}
      >
        <Plus className="size-6" />
      </button>

      <ComposeBuzzSheet open={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  );
}
