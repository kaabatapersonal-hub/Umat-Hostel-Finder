"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQueryClient, type InfiniteData, type UseMutationResult } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { createBuzzPost, type BuzzPost, type GetBuzzFeedResult } from "@/lib/queries/buzz";
import { useAuth } from "@/providers/auth-provider";
import { useToast } from "@/components/ui/toast";
import { captureEvent } from "@/lib/analytics";

type BuzzFeedCache = InfiniteData<GetBuzzFeedResult>;

function replaceFirstPagePosts(
  cache: BuzzFeedCache | undefined,
  updater: (posts: BuzzPost[]) => BuzzPost[]
): BuzzFeedCache | undefined {
  if (!cache) return cache;
  const [firstPage, ...rest] = cache.pages;
  return { ...cache, pages: [{ ...firstPage, posts: updater(firstPage.posts) }, ...rest] };
}

// Genuinely optimistic -- the post appears in the feed the instant Post
// is tapped (tagged with an `optimistic-` id, the same placeholder-id
// convention useToggleSave already uses for an optimistic saved-hostel
// row), swapped for the real row on success, and rolled back with a
// retryable toast on failure. Never makes the user wait on the network
// round trip before seeing their own post.
export function useCreateBuzzPost() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  // onError needs to trigger a retry of this same mutation, but it's
  // defined as part of the config passed *into* useMutation below --
  // there's no `mutation` reference to close over yet at that point. A
  // ref sidesteps the chicken-and-egg: it's populated right after
  // useMutation returns, and onError only ever reads it once a real
  // error has actually happened, by which point every render has already
  // set it.
  const mutationRef = useRef<UseMutationResult<BuzzPost, unknown, string> | null>(null);

  const mutation = useMutation({
    mutationFn: async (content: string) => {
      const {
        data: { user: freshUser },
      } = await supabase.auth.getUser();
      if (!freshUser) throw new Error("Not signed in");
      return createBuzzPost(supabase, { authorId: freshUser.id, content });
    },
    onMutate: async (content: string) => {
      await queryClient.cancelQueries({ queryKey: ["buzz-feed"] });
      const previous = queryClient.getQueryData<BuzzFeedCache>(["buzz-feed"]);
      const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      const optimisticPost: BuzzPost = {
        id: tempId,
        authorId: user?.id ?? "",
        authorName: profile?.fullName ?? null,
        content,
        isAdminPost: profile?.role === "admin",
        isPinned: false,
        replyCount: 0,
        likeCount: 0,
        bookmarkCount: 0,
        viewCount: 0,
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<BuzzFeedCache>(["buzz-feed"], (old) =>
        replaceFirstPagePosts(old, (posts) => [optimisticPost, ...posts])
      );

      return { previous, tempId };
    },
    onError: (err, content, context) => {
      if (context?.previous) queryClient.setQueryData(["buzz-feed"], context.previous);

      // The server-side rate limit (enforce_buzz_post_rate_limit,
      // Buzz v2) is the one failure mode where "Retry" would just fail
      // again immediately -- it's not a transient error, so it gets its
      // own friendlier copy and no retry action, instead of the generic
      // network-failure toast every other error gets.
      const message = err instanceof Error ? err.message : "";
      const isRateLimited = message.includes("Rate limit");

      showToast(
        isRateLimited
          ? { message: "You're posting a lot! Try again in a bit.", variant: "error" }
          : {
              message: "Couldn't post — try again?",
              variant: "error",
              actionLabel: "Retry",
              onAction: () => mutationRef.current?.mutate(content),
            }
      );
    },
    onSuccess: (newPost, _content, context) => {
      queryClient.setQueryData<BuzzFeedCache>(["buzz-feed"], (old) =>
        replaceFirstPagePosts(old, (posts) => posts.map((p) => (p.id === context?.tempId ? newPost : p)))
      );
      // Hot's own ranking is server-computed (time-decay), so the new
      // post isn't spliced in directly the way the New feed's cache is --
      // just invalidate so it refetches into whatever position it
      // actually scores once confirmed.
      queryClient.invalidateQueries({ queryKey: ["buzz-feed-hot"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      captureEvent("posted_buzz", { post_id: newPost.id });
    },
  });

  // Not a render-phase ref write (disallowed) -- onError only ever fires
  // from a user-initiated mutate() call, which can't happen before this
  // effect has already run at least once, so the ref is always current
  // by the time it's actually read.
  useEffect(() => {
    mutationRef.current = mutation;
  });

  return mutation;
}
